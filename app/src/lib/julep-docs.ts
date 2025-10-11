import { type JulepDocMetadata, julepClient, julepEnv } from "@/lib/julep";

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
		console.error("Failed to create Julep user:", error);
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

		console.log(`Successfully seeded docs for Julep user ${julepUserId}`);
	} catch (error) {
		console.error("Failed to seed user docs:", error);
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
		console.error("Failed to search user docs:", error);
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
		console.error("Failed to write conversation summary:", error);
	}
}

export async function createOrGetSession(julepUserId: string, agentId: string) {
	try {
		const session = await julepClient.sessions.create({
			userId: julepUserId,
			agentId,
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
		console.error("Failed to create Julep session:", error);
		throw error;
	}
}
