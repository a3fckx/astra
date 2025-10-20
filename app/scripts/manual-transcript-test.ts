/**
 * Manual Transcript Processing Test
 * Triggers transcript processing for specific conversation IDs
 */

import { getElevenLabsConversations, getUsers } from "@/lib/mongo";
import { processTranscriptConversation } from "@/lib/transcript-processor";
import { logger } from "@/lib/logger";

const testLogger = logger.child("manual-transcript-test");

async function processConversation(conversationId: string) {
	testLogger.info("Processing conversation", { conversationId });

	const users = getUsers();
	const conversations = getElevenLabsConversations();

	// Find conversation
	const conversation = await conversations.findOne({ conversation_id: conversationId });
	if (!conversation) {
		testLogger.error("Conversation not found", { conversationId });
		return null;
	}

	// Find user
	const user = await users.findOne({ id: conversation.user_id });
	if (!user) {
		testLogger.error("User not found", { userId: conversation.user_id });
		return null;
	}

	testLogger.info("Found conversation and user", {
		conversationId,
		userId: user.id,
		userName: user.name,
	});

	try {
		const result = await processTranscriptConversation({
			user,
			conversation,
		});

		testLogger.info("Processing completed successfully", {
			conversationId,
			taskId: result.task_id,
			executionId: result.execution_id,
			memoriesCount: result.memories_count,
			overviewUpdates: Object.keys(result.overview_updates),
		});

		return result;
	} catch (error) {
		testLogger.error("Processing failed", {
			conversationId,
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

async function main() {
	const conversationIds = process.argv.slice(2);

	if (conversationIds.length === 0) {
		console.error("Usage: bun run scripts/manual-transcript-test.ts <conversation_id> [<conversation_id2> ...]");
		process.exit(1);
	}

	testLogger.info("Starting manual transcript processing", {
		count: conversationIds.length,
		conversationIds,
	});

	for (const conversationId of conversationIds) {
		console.log("\n=".repeat(80));
		console.log(`Processing: ${conversationId}`);
		console.log("=".repeat(80));

		const result = await processConversation(conversationId);

		if (result) {
			console.log("\n✅ SUCCESS!");
			console.log("Conversation Summary:");
			console.log(JSON.stringify(result.conversation_summary, null, 2));
			console.log("\nOverview Updates:");
			console.log(JSON.stringify(result.overview_updates, null, 2));
			console.log("\nIncident Map:");
			console.log(JSON.stringify(result.merged_overview.incident_map, null, 2));
		} else {
			console.log("\n❌ FAILED!");
		}

		console.log("\n");
	}

	testLogger.info("Manual processing completed");
	process.exit(0);
}

main().catch((error) => {
	testLogger.error("Fatal error", error);
	process.exit(1);
});
