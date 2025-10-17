import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
	findIntegrationToken,
	type IntegrationName,
} from "@/lib/integration-tokens";
import { julepEnv } from "@/lib/julep";
import { getOrCreateJulepSession } from "@/lib/julep-docs";
import { logger } from "@/lib/logger";
import { getUsers, type IntegrationToken } from "@/lib/mongo";
import { getResponderPromptTemplate } from "@/lib/prompt-loader";

const routeLogger = logger.child("responder-session-route");
const KNOWN_INTEGRATIONS: IntegrationName[] = ["elevenlabs"];
const DEFAULT_WORKFLOW_ID = "astra-responder";

const normalizeMetadata = (input: IntegrationToken["metadata"]) =>
	input && typeof input === "object"
		? (input as Record<string, unknown>)
		: null;

const tokenPayload = (record: IntegrationToken | null) =>
	record
		? {
				token: record.token,
				expiresAt: record.expiresAt?.toISOString() ?? null,
				metadata: normalizeMetadata(record.metadata),
			}
		: null;

const isExpired = (record: IntegrationToken | null) =>
	!!(record?.expiresAt && record.expiresAt.getTime() <= Date.now());

export async function GET(request: Request) {
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const url = new URL(request.url);
	const requestedWorkflow =
		url.searchParams.get("workflowId")?.trim() || DEFAULT_WORKFLOW_ID;

	const users = getUsers();
	const user = await users.findOne({ id: session.user.id });

	if (!user) {
		return NextResponse.json(
			{ error: "User record not found" },
			{ status: 404 },
		);
	}

	const julepUserId = user.julep_user_id ?? null;

	let julepSessionId: string | null = null;
	if (julepEnv.astraAgentId && julepUserId) {
		try {
			julepSessionId = await getOrCreateJulepSession(julepUserId);
		} catch (error) {
			routeLogger.error("Failed to resolve Julep session", {
				userId: user.id,
				julepUserId,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	} else {
		routeLogger.warn(
			"ASTRA_AGENT_ID not configured; skipping Julep session init",
			{
				userId: user.id,
			},
		);
	}

	const integrations: Record<
		IntegrationName,
		ReturnType<typeof tokenPayload>
	> = {
		elevenlabs: null,
	};

	for (const integration of KNOWN_INTEGRATIONS) {
		try {
			const record = await findIntegrationToken(session.user.id, integration);
			if (!record || isExpired(record)) {
				if (record && isExpired(record)) {
					routeLogger.warn("Integration token expired", {
						integration,
						userId: session.user.id,
					});
				}
				integrations[integration] = null;
				continue;
			}

			integrations[integration] = tokenPayload(record);
		} catch (error) {
			routeLogger.error("Failed to fetch integration token", {
				userId: session.user.id,
				integration,
				error: error instanceof Error ? error.message : String(error),
			});
			integrations[integration] = null;
		}
	}

	// ANCHOR:prompt-template-source
	// ElevenLabs prompt lives in app/docs/responder.md; keep this loader aligned with the template.
	let responderPrompt: string | null = null;
	try {
		responderPrompt = await getResponderPromptTemplate();
	} catch (error) {
		routeLogger.error("Failed to load responder prompt template", {
			error: error instanceof Error ? error.message : String(error),
		});
	}

	// Extract key data from user_overview for session context
	const userOverview = user.user_overview;
	const streakDays = userOverview?.gamification?.streak_days ?? 0;
	const birthChart = userOverview?.birth_chart;
	const firstMessage = userOverview?.first_message ?? null;

	return NextResponse.json({
		session: {
			workflowId: requestedWorkflow,
			julep: {
				sessionId: julepSessionId ?? undefined,
				userId: julepUserId ?? undefined,
			},
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				dateOfBirth: user.date_of_birth
					? user.date_of_birth.toISOString().split("T")[0]
					: null,
				birthTime: user.birth_time ?? null,
				birthPlace: user.birth_location ?? null,
			},
			overview: {
				streakDays: streakDays,
				profileSummary: userOverview?.profile_summary ?? null,
				firstMessage: firstMessage,
				vedicSun: birthChart?.vedic?.sun_sign ?? null,
				vedicMoon: birthChart?.vedic?.moon_sign ?? null,
				westernSun: birthChart?.western?.sun_sign ?? null,
			},
		},
		integrations,
		prompt: responderPrompt,
	});
}
