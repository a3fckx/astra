import { julepEnv } from "@/lib/julep";
import { createOrGetSession } from "@/lib/julep-docs";
import { getSessions, getUsers } from "@/lib/mongo";

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

export async function getUserByEmail(email: string) {
	const usersCollection = getUsers();
	const user = await usersCollection.findOne({ email });
	return user;
}
