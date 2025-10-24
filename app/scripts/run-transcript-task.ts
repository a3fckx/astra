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
	pendingOnly: boolean;
};

const DEFAULT_LIMIT = 3;

/**
 * Parse CLI arguments to collect conversation IDs, a processing limit, and a pending-only flag.
 *
 * Supported options:
 * - `--conversation` or `-c` followed by an ID (can be repeated)
 * - `--limit` or `-l` followed by a positive integer
 * - `--pending` or `--pending-only` (flag)
 *
 * @returns An object containing:
 * - `conversationIds`: an array of provided conversation IDs
 * - `limit`: the parsed positive integer limit (defaults to DEFAULT_LIMIT if not provided or invalid)
 * - `pendingOnly`: `true` if the pending flag was present, `false` otherwise
 */
function parseArgs(): CliArgs {
	const args = process.argv.slice(2);
	const conversationIds: string[] = [];
	let limit = DEFAULT_LIMIT;
	let pendingOnly = false;

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
			continue;
		}

		if (current === "--pending" || current === "--pending-only") {
			pendingOnly = true;
			continue;
		}
	}

	return { conversationIds, limit, pendingOnly };
}

/**
 * Load ElevenLabs conversations either by explicit IDs or by a query with sorting and a result limit.
 *
 * @param conversationIds - If non-empty, return conversations whose `conversation_id` is in this list.
 * @param limit - Maximum number of conversations to return when `conversationIds` is empty.
 * @param pendingOnly - If true, only include conversations where `metadata.transcript_processed` is not `true`.
 * @returns An array of matching ElevenLabsConversation objects.
 */
async function loadConversations(
	conversationIds: string[],
	limit: number,
	pendingOnly: boolean,
): Promise<ElevenLabsConversation[]> {
	const conversations = getElevenLabsConversations();

	if (conversationIds.length > 0) {
		return conversations
			.find({ conversation_id: { $in: conversationIds } })
			.toArray();
	}

	const query: Record<string, unknown> = {};

	if (pendingOnly) {
		query["metadata.transcript_processed"] = { $ne: true };
	}

	return conversations
		.find({})
		.filter(query)
		.sort({ updated_at: -1 })
		.limit(limit)
		.toArray();
}

/**
 * Orchestrates loading and processing of ElevenLabs transcript conversations based on CLI arguments.
 *
 * Parses command-line arguments, loads matching conversations (optionally only pending), and for each
 * conversation validates the associated user and required identifiers before invoking transcript processing.
 * After processing, refreshes the user record and logs processing results (including task/execution IDs,
 * memory count, summary presence, and any change to the user's `user_overview.first_message`). Errors for
 * individual conversations are logged and processing continues with the next conversation.
 */
async function main() {
	const { conversationIds, limit, pendingOnly } = parseArgs();

	const conversations = await loadConversations(
		conversationIds,
		limit,
		pendingOnly,
	);
	if (conversations.length === 0) {
		scriptLogger.warn("No conversations found to process", {
			conversationIds,
			limit,
			pendingOnly,
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
			const previousFirstMessage = user.user_overview?.first_message ?? null;

			scriptLogger.info("Processing conversation", {
				conversationId: conversation.conversation_id,
				userId: user.id,
				pendingOnly,
			});

			const result = await processTranscriptConversation({
				user,
				conversation,
			});

			const updatedUser = await usersCollection.findOne({ id: user.id });
			const updatedFirstMessage =
				updatedUser?.user_overview?.first_message ?? null;

			scriptLogger.info("Transcript processed", {
				conversationId: result.conversation_id,
				taskId: result.task_id,
				executionId: result.execution_id,
				memoriesCount: result.memories_count,
				hasSummary: !!result.conversation_summary,
				firstMessageUpdated:
					previousFirstMessage !== updatedFirstMessage
						? {
								previous: previousFirstMessage,
								next: updatedFirstMessage,
							}
						: null,
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