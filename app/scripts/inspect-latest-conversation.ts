#!/usr/bin/env bun

import { getElevenLabsConversations, getUsers } from "@/lib/mongo";
import { logger } from "@/lib/logger";

async function main() {
	const conversations = getElevenLabsConversations();
	const latestConversation = await conversations
		.find()
		.sort({ updated_at: -1 })
		.limit(1)
		.next();

	if (!latestConversation) {
		console.log("No ElevenLabs conversations found.");
		return;
	}

	console.log("Latest ElevenLabs Conversation:");
	console.log(
		JSON.stringify(
			{
				conversation_id: latestConversation.conversation_id,
				user_id: latestConversation.user_id,
				agent_id: latestConversation.agent_id ?? null,
				workflow_id: latestConversation.workflow_id ?? null,
				status: latestConversation.status ?? null,
				started_at: latestConversation.started_at,
				ended_at: latestConversation.ended_at ?? null,
				updated_at: latestConversation.updated_at,
				metadata: latestConversation.metadata ?? null,
				overview_snapshot: latestConversation.overview_snapshot ?? null,
			},
			null,
			2,
		),
	);

	const users = getUsers();
	const user = await users.findOne({ id: latestConversation.user_id });

	if (!user) {
		console.warn("User not found for conversation", latestConversation.user_id);
		return;
	}

	const overview = user.user_overview;
	console.log("\nUser Overview Summary:");
	console.log(
		JSON.stringify(
			overview
				? {
					first_message: overview.first_message,
					profile_summary: overview.profile_summary,
					streak_days: overview.gamification?.streak_days ?? null,
					total_incidents: overview.incident_map?.length ?? 0,
					recent_incident:
						overview.incident_map?.[overview.incident_map.length - 1] ?? null,
					recent_conversation_summary:
						overview.recent_conversations?.[overview.recent_conversations.length - 1]
							?.summary ?? null,
				}
			: null,
			null,
			2,
		),
	);
}

main().catch((error) => {
	logger.error("Failed to inspect latest conversation", {
		error: error instanceof Error ? error.message : String(error),
	});
	process.exit(1);
});
