#!/usr/bin/env bun
import { logger } from "@/lib/logger";
import {
	getElevenLabsConversations,
	getUsers,
	type ElevenLabsConversation,
} from "@/lib/mongo";
import { processTranscriptConversation } from "@/lib/transcript-processor";

const scriptLogger = logger.child("scripts:run-transcript-task");

type CliArgs = {
	conversationIds: string[];
	limit: number;
};

const DEFAULT_LIMIT = 3;

function parseArgs(): CliArgs {
	const args = process.argv.slice(2);
	const conversationIds: string[] = [];
	let limit = DEFAULT_LIMIT;

	for (let index = 0; index < args.length; index += 1) {
		const current = args[index];
		if (!current) continue;

		if (current === "--conversation" || current === "-c") {
			const id = args[index + 1];
			if (id) {
				conversationIds.push(id);
				index += 1;
			}
			continue;
		}

		if (current === "--limit" || current === "-l") {
			const value = Number.parseInt(args[index + 1] ?? "", 10);
			if (!Number.isNaN(value) && value > 0) {
				limit = value;
			}
			index += 1;
		}
	}

	return { conversationIds, limit };
}

async function loadConversations(
	conversationIds: string[],
	limit: number,
): Promise<ElevenLabsConversation[]> {
	const conversations = getElevenLabsConversations();

	if (conversationIds.length > 0) {
		return conversations
			.find({ conversation_id: { $in: conversationIds } })
			.toArray();
	}

	return conversations
		.find({})
		.sort({ updated_at: -1 })
		.limit(limit)
		.toArray();
}

async function main() {
	const { conversationIds, limit } = parseArgs();

	const conversations = await loadConversations(conversationIds, limit);
	if (conversations.length === 0) {
		scriptLogger.warn("No conversations found to process", {
			conversationIds,
			limit,
		});
		return;
	}

	const usersCollection = getUsers();

	for (const conversation of conversations) {
		if (!conversation.user_id) {
			scriptLogger.warn("Conversation missing user_id; skipping", {
				conversationId: conversation.conversation_id,
			});
			continue;
		}

		const user = await usersCollection.findOne({ id: conversation.user_id });
		if (!user) {
			scriptLogger.error("User record not found; skipping conversation", {
				conversationId: conversation.conversation_id,
				userId: conversation.user_id,
			});
			continue;
		}

		if (!user.julep_user_id) {
			scriptLogger.error("User missing julep_user_id; skipping conversation", {
				conversationId: conversation.conversation_id,
				userId: conversation.user_id,
			});
			continue;
		}

		try {
			scriptLogger.info("Processing conversation", {
				conversationId: conversation.conversation_id,
				userId: user.id,
			});

			const result = await processTranscriptConversation({
				user,
				conversation,
			});

			scriptLogger.info("Transcript processed", {
				conversationId: result.conversation_id,
				taskId: result.task_id,
				executionId: result.execution_id,
				memoriesCount: result.memories_count,
				hasSummary: !!result.conversation_summary,
			});
		} catch (error) {
			scriptLogger.error(
				"Failed to process conversation transcript",
				error as Error,
			);
		}
	}
}

main()
	.then(() => {
		scriptLogger.info("Transcript task run completed");
		process.exit(0);
	})
	.catch((error) => {
		scriptLogger.error("Transcript task run failed", error as Error);
		process.exit(1);
	});
