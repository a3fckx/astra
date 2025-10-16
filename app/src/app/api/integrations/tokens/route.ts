import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import {
	findIntegrationToken,
	type IntegrationName,
	resolveIntegrationToken,
} from "@/lib/integration-tokens";
import { logger } from "@/lib/logger";

const KNOWN_INTEGRATIONS: IntegrationName[] = ["memory-store", "elevenlabs"];
const routeLogger = logger.child("integration-token-route");

const fallbackFor = (integration: IntegrationName) => {
	if (integration === "memory-store") {
		return env.memoryStoreDefaultToken;
	}
	return undefined;
};

const normalize = (input: Record<string, unknown> | null | undefined) =>
	!input || typeof input !== "object" ? null : input;

export async function GET(request: Request) {
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const url = new URL(request.url);
	const integrationParam = url.searchParams.get("integration") ?? undefined;

	const integrations = integrationParam
		? KNOWN_INTEGRATIONS.filter(
				(integration) => integration === integrationParam,
			)
		: KNOWN_INTEGRATIONS;

	if (!integrations.length) {
		return NextResponse.json(
			{ error: "Unknown integration token requested" },
			{ status: 400 },
		);
	}

	const results: Record<
		IntegrationName,
		{
			token: string;
			source: "user" | "fallback";
			expiresAt: string | null;
			metadata: Record<string, unknown> | null;
		} | null
	> = {
		"memory-store": null,
		elevenlabs: null,
	};

	for (const integration of integrations) {
		const fallbackToken = fallbackFor(integration);

		try {
			if (fallbackToken) {
				/**
				 * ANCHOR:integration-token-ingress
				 * Memory Store requires an MCP token even before the user rotates theirs.
				 * We resolve the per-user record and fall back to the project-scoped token so
				 * both the dashboard and worker can connect during bootstrap.
				 */
				const lookup = await resolveIntegrationToken({
					userId: session.user.id,
					integration,
					fallbackToken,
				});

				results[integration] = {
					token: lookup.token,
					source: lookup.source,
					expiresAt:
						lookup.record?.expiresAt instanceof Date
							? lookup.record.expiresAt.toISOString()
							: null,
					metadata: normalize(lookup.record?.metadata),
				};
				continue;
			}

			const record = await findIntegrationToken(session.user.id, integration);
			if (!record) {
				results[integration] = null;
				continue;
			}

			if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
				results[integration] = null;
				continue;
			}

			results[integration] = {
				token: record.token,
				source: "user",
				expiresAt: record.expiresAt?.toISOString() ?? null,
				metadata: normalize(record.metadata),
			};
		} catch (error) {
			routeLogger.error("Failed to resolve integration token", {
				userId: session.user.id,
				integration,
				error: error instanceof Error ? error.message : String(error),
			});
			results[integration] = null;
		}
	}

	if (integrationParam) {
		return NextResponse.json({
			integration: integrationParam,
			token: results[integrationParam as IntegrationName],
		});
	}

	return NextResponse.json({
		tokens: results,
	});
}
