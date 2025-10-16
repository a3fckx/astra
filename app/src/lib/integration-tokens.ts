import type { Collection } from "mongodb";
import { logger } from "@/lib/logger";
import { getIntegrationTokens, type IntegrationToken } from "@/lib/mongo";

export type IntegrationName = IntegrationToken["integration"];

const integrationTokensLogger = logger.child("integration-tokens");

type TokenCollection = Pick<
	Collection<IntegrationToken>,
	"findOne" | "insertOne" | "updateOne"
>;

export type IntegrationTokenCollection = TokenCollection;
const now = () => new Date();

const isExpired = (record: IntegrationToken | undefined | null) => {
	if (!record?.expiresAt) {
		return false;
	}
	return record.expiresAt.getTime() <= Date.now();
};

export type IntegrationTokenLookup =
	| {
			token: string;
			source: "user";
			record: IntegrationToken;
	  }
	| {
			token: string;
			source: "fallback";
			record?: IntegrationToken;
	  };

export type TokenMetadata = Record<string, unknown> | null | undefined;

const collectionOrDefault = (override?: TokenCollection): TokenCollection =>
	override ?? getIntegrationTokens();

export async function findIntegrationToken(
	userId: string,
	integration: IntegrationName,
	options?: { collection?: TokenCollection },
) {
	const tokens = collectionOrDefault(options?.collection);
	return tokens.findOne({ userId, integration });
}

export async function upsertIntegrationToken(
	params: {
		userId: string;
		integration: IntegrationName;
		token: string;
		expiresAt?: Date | null;
		metadata?: TokenMetadata;
	},
	options?: { collection?: TokenCollection },
) {
	const { userId, integration, token, expiresAt, metadata } = params;
	const tokens = collectionOrDefault(options?.collection);

	const existing = await tokens.findOne({ userId, integration });
	const timestamp = now();

	if (existing?._id) {
		await tokens.updateOne(
			{ _id: existing._id },
			{
				$set: {
					token,
					expiresAt: expiresAt ?? null,
					metadata: metadata ?? null,
					updatedAt: timestamp,
				},
			},
		);

		const updated: IntegrationToken = {
			...existing,
			token,
			expiresAt: expiresAt ?? null,
			metadata: metadata ?? null,
			updatedAt: timestamp,
		};

		integrationTokensLogger.debug("Updated integration token", {
			userId,
			integration,
			expiresAt: updated.expiresAt?.toISOString() ?? null,
		});

		return updated;
	}

	const record: IntegrationToken = {
		userId,
		integration,
		token,
		expiresAt: expiresAt ?? null,
		metadata: metadata ?? null,
		createdAt: timestamp,
		updatedAt: timestamp,
	};

	await tokens.insertOne(record as Parameters<TokenCollection["insertOne"]>[0]);

	integrationTokensLogger.info("Stored new integration token", {
		userId,
		integration,
		expiresAt: record.expiresAt?.toISOString() ?? null,
	});

	return record;
}

const logMissingToken = (
	userId: string,
	integration: IntegrationName,
	reason: "missing" | "expired",
) => {
	const message =
		reason === "expired"
			? "Existing integration token expired; falling back"
			: "No integration token stored; falling back";
	integrationTokensLogger.warn(message, { userId, integration });
};

/**
 * ANCHOR:integration-token-lifecycle
 * Memory Store and ElevenLabs tokens rotate per user/session. This helper
 * enforces a single lookup path so both the dashboard and background worker
 * can grab scoped credentials without scattering Mongo queries everywhere.
 */
export async function resolveIntegrationToken(
	params: {
		userId: string;
		integration: IntegrationName;
		fallbackToken?: string;
		metadata?: TokenMetadata;
	},
	options?: { collection?: TokenCollection },
): Promise<IntegrationTokenLookup> {
	const { userId, integration, fallbackToken, metadata } = params;
	const tokens = collectionOrDefault(options?.collection);
	const record = await tokens.findOne({ userId, integration });

	if (record && !isExpired(record)) {
		return { token: record.token, source: "user", record };
	}

	if (record && isExpired(record)) {
		logMissingToken(userId, integration, "expired");
	}
	if (!record) {
		logMissingToken(userId, integration, "missing");
	}

	if (!fallbackToken) {
		throw new Error(
			`No ${integration} token available for user ${userId} and no fallback provided`,
		);
	}

	const fallbackRecord = record
		? {
				...record,
				token: fallbackToken,
				expiresAt: record.expiresAt ?? null,
				metadata: metadata ?? record.metadata ?? null,
			}
		: undefined;

	return {
		token: fallbackToken,
		source: "fallback",
		record: fallbackRecord,
	};
}
