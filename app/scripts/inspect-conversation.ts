#!/usr/bin/env bun

/**
 * Inspect ElevenLabs conversation + corresponding Mongo user snapshot.
 *
 * Examples:
 *  bun --env-file=.env run scripts/inspect-conversation.ts --conversation conv_123
 *  bun --env-file=.env run scripts/inspect-conversation.ts --user 68ea... --limit 5
 */

import { exit } from "node:process";
import { getElevenLabsConversations, getUsers } from "@/lib/mongo";
import { logger } from "@/lib/logger";

type InspectArgs = {
	conversationId?: string;
	userId?: string;
	limit: number;
};

function parseArgs(argv: string[]): InspectArgs {
	const args: InspectArgs = { limit: 1 };

	for (let i = 0; i < argv.length; i++) {
		const current = argv[i];
		if (current === "--conversation" || current === "-c") {
			args.conversationId = argv[i + 1];
			i += 1;
		} else if (current === "--user" || current === "-u") {
			args.userId = argv[i + 1];
			i += 1;
		} else if (current === "--limit" || current === "-l") {
			const raw = argv[i + 1];
			const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
			if (!Number.isNaN(parsed) && parsed > 0) {
				args.limit = parsed;
			}
			i += 1;
		}
	}

	return args;
}

function pick<T extends Record<string, unknown>>(
	input: T | null | undefined,
	fields: (keyof T)[],
): Partial<T> | null {
	if (!input) {
		return null;
	}
	return fields.reduce<Partial<T>>((acc, key) => {
		if (key in input) {
			acc[key] = input[key];
		}
		return acc;
	}, {});
}

async function main() {
	const args = parseArgs(process.argv.slice(2));

	const conversations = getElevenLabsConversations();
	const query: Record<string, unknown> = {};

	if (args.conversationId) {
		query.conversation_id = args.conversationId;
	}
	if (args.userId) {
		query.user_id = args.userId;
	}

	const cursor = conversations
		.find(query)
		.sort({ updated_at: -1 })
		.limit(args.limit);

	const results = await cursor.toArray();

	if (!results.length) {
		console.log(
			`No ElevenLabs conversations found for query ${JSON.stringify(query)}.`,
		);
		exit(0);
	}

	console.log(`Found ${results.length} conversation(s):\n`);

	for (const conversation of results) {
		const summary = {
			conversation_id: conversation.conversation_id,
			user_id: conversation.user_id,
			status: conversation.status ?? null,
			started_at: conversation.started_at,
			ended_at: conversation.ended_at ?? null,
			updated_at: conversation.updated_at,
			agent_id: conversation.agent_id ?? null,
			workflow_id: conversation.workflow_id ?? null,
			metadata: pick(conversation.metadata ?? null, [
				"transcript_processed",
				"transcript_empty",
				"transcript_poll_attempts",
				"transcript_poll_delay_ms",
				"transcript_message_count",
				"transcript_status",
				"task_id",
				"execution_id",
				"error",
			]),
			overview_snapshot:
				conversation.overview_snapshot && typeof conversation.overview_snapshot === "object"
					? pick(conversation.overview_snapshot, [
							"profile_summary",
							"first_message",
							"last_updated",
							"updated_by",
							"gamification",
							"birth_details",
							"incident_map",
						])
					: null,
		};

		console.log(JSON.stringify(summary, null, 2));

		const users = getUsers();
		const user = await users.findOne({ id: conversation.user_id });

		if (!user) {
			console.warn(
				`⛔️ User ${conversation.user_id} not found for conversation ${conversation.conversation_id}`,
			);
			continue;
		}

		const overview = user.user_overview ?? null;

		console.log("\nMongo User Snapshot:");
		console.log(
			JSON.stringify(
				{
					id: user.id,
					name: user.name,
					email: user.email,
					birth_time: user.birth_time ?? null,
					birth_location: user.birth_location ?? null,
					birth_timezone: user.birth_timezone ?? null,
					overview: overview
						? {
								first_message: overview.first_message ?? null,
								last_updated: overview.last_updated ?? null,
								updated_by: overview.updated_by ?? null,
								profile_summary: overview.profile_summary ?? null,
								preferences: overview.preferences ?? null,
								gamification: overview.gamification ?? null,
								latest_horoscope: overview.latest_horoscope ?? null,
								incident_count: overview.incident_map?.length ?? 0,
								last_incident:
									overview.incident_map?.[
										overview.incident_map.length - 1
									] ?? null,
								recent_conversation:
									overview.recent_conversations?.[
										overview.recent_conversations.length - 1
									] ?? null,
							}
						: null,
				},
				null,
				2,
			),
		);

		console.log("\n---\n");
	}
}

main().catch((error) => {
	logger.error("Failed to inspect conversation snapshot", {
		error: error instanceof Error ? error.message : String(error),
	});
	exit(1);
});
