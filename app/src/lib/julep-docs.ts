import { type JulepDocMetadata, julepClient, julepEnv } from "@/lib/julep";
import { logger } from "@/lib/logger";
import { getSessions } from "@/lib/mongo";

const docsLogger = logger.child("julep-docs");

const DOC_LIST_PARAMS = {
	sort_by: "updated_at",
	direction: "desc",
	limit: 1,
} as const;

export async function createJulepUser(userData: {
	name: string;
	email: string;
	about?: string;
}) {
	try {
		const user = await julepClient.users.create({
			name: userData.name,
			about: userData.about ?? `User email: ${userData.email}`,
			project: julepEnv.project,
			metadata: {
				email: userData.email,
			},
		});

		return user;
	} catch (error) {
		docsLogger.error("Failed to create Julep user", error as Error);
		throw error;
	}
}

export async function seedUserDocs(
	julepUserId: string,
	userData: {
		name: string;
		email: string;
		date_of_birth?: Date;
		birth_time?: string;
		birth_location?: string;
	},
) {
	const timestamp = new Date().toISOString();

	try {
		const profileContent = [
			`Name: ${userData.name}`,
			`Email: ${userData.email}`,
			userData.date_of_birth
				? `Date of Birth: ${userData.date_of_birth.toISOString().split("T")[0]}`
				: null,
			userData.birth_time ? `Birth Time: ${userData.birth_time}` : null,
			userData.birth_location
				? `Birth Location: ${userData.birth_location}`
				: null,
		]
			.filter(Boolean)
			.join("\n");

		await julepClient.users.docs.create(julepUserId, {
			title: "User Profile",
			content: [profileContent],
			metadata: {
				type: "profile",
				scope: "frontline",
				shared: true,
				updated_by: "system",
				timestamp_iso: timestamp,
			} as JulepDocMetadata,
		});

		await julepClient.users.docs.create(julepUserId, {
			title: "User Preferences",
			content: ["No preferences set yet. This will be enriched over time."],
			metadata: {
				type: "preferences",
				scope: "frontline",
				shared: true,
				updated_by: "system",
				timestamp_iso: timestamp,
			} as JulepDocMetadata,
		});

		docsLogger.info("Seeded Julep docs for user", {
			julepUserId,
			email: userData.email,
		});
	} catch (error) {
		docsLogger.error("Failed to seed user docs", error as Error);
		throw error;
	}
}

export async function searchUserDocs(
	julepUserId: string,
	query: string,
	metadataFilter?: Partial<JulepDocMetadata>,
) {
	try {
		const results = await julepClient.users.docs.search({
			userId: julepUserId,
			text: query,
			metadataFilter: metadataFilter as Record<string, unknown>,
			limit: 10,
		});

		return results;
	} catch (error) {
		docsLogger.error("Failed to search user docs", error as Error);
		throw error;
	}
}

export async function writeConversationSummary(
	julepUserId: string,
	summary: string,
	sessionId: string,
) {
	const timestamp = new Date().toISOString();

	try {
		await julepClient.users.docs.create({
			userId: julepUserId,
			title: `Conversation Summary - ${new Date().toLocaleDateString()}`,
			content: [summary],
			metadata: {
				type: "notes",
				scope: "frontline",
				shared: true,
				updated_by: julepEnv.astraAgentId ?? "astra",
				timestamp_iso: timestamp,
				source: sessionId,
			} as JulepDocMetadata,
		});
	} catch (error) {
		docsLogger.error("Failed to write conversation summary", error as Error);
	}
}

export async function createOrGetSession(julepUserId: string, agentId: string) {
	try {
		const session = await julepClient.sessions.create({
			user: julepUserId,
			agent: agentId,
			recall: true,
			recallOptions: {
				mode: "hybrid",
				limit: 10,
				numSearchMessages: 4,
				metadataFilter: {
					scope: "frontline",
					shared: true,
				},
			},
			contextOverflow: "adaptive",
		});

		return session;
	} catch (error) {
		docsLogger.error("Failed to create Julep session", error as Error);
		throw error;
	}
}

export async function getOrCreateJulepSession(
	julepUserId: string,
): Promise<string> {
	if (!julepEnv.astraAgentId) {
		throw new Error("ASTRA_AGENT_ID not configured");
	}

	const sessionsCollection = getSessions();
	const existingSession = await sessionsCollection.findOne({
		user_id: julepUserId,
		agent_id: julepEnv.astraAgentId,
	});

	if (existingSession) {
		return existingSession.julep_session_id;
	}

	const session = await createOrGetSession(julepUserId, julepEnv.astraAgentId);

	await sessionsCollection.insertOne({
		user_id: julepUserId,
		julep_session_id: session.id,
		agent_id: julepEnv.astraAgentId,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	return session.id;
}

type DocListMetadataFilter = Partial<
	Pick<JulepDocMetadata, "type" | "scope" | "shared" | "updated_by">
>;

export async function getLatestDocContent(
	julepUserId: string,
	metadataFilter: DocListMetadataFilter,
): Promise<string | null> {
	try {
		const page = await julepClient.users.docs.list(julepUserId, {
			metadata_filter: metadataFilter,
			...DOC_LIST_PARAMS,
		});

		const doc = (page as unknown as { items?: Array<{ content?: unknown }> })
			.items?.[0];

		if (!doc || typeof doc !== "object") {
			return null;
		}

		const { content } = doc as { content?: unknown };

		if (Array.isArray(content)) {
			return content.join("\n\n");
		}

		if (typeof content === "string") {
			return content;
		}

		return null;
	} catch (error) {
		docsLogger.error("Failed to load latest doc content", {
			julepUserId,
			metadataFilter,
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}
