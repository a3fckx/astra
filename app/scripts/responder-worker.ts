import { Buffer } from "node:buffer";
import { setTimeout as delay } from "node:timers/promises";
import { ObjectId } from "mongodb";
import { textToSpeechStream } from "@/lib/elevenlabs";
import { julepClient } from "@/lib/julep";
import { writeConversationSummary } from "@/lib/julep-docs";
import {
	getResponderEvents,
	getResponderOutbox,
	getUsers,
	type ResponderOutboxMessage,
} from "@/lib/mongo";
import { getOrCreateJulepSession } from "@/lib/websocket-utils";
import { WORKFLOW_ID } from "@/lib/chatkit-config";

const POLL_INTERVAL_MS = Number(
	process.env.RESPONDER_WORKER_POLL_MS ?? 500,
);
const WORKER_ID = process.env.RESPONDER_WORKER_ID ?? `worker-${process.pid}`;

type AssistantEventMetadata = {
	outboxId?: string;
	status: "queued" | "processing" | "delivered" | "failed";
	source: "worker";
	workerId: string;
	error?: string;
};

function asObjectId(id?: string | ObjectId | null) {
	if (!id) {
		return undefined;
	}
	if (id instanceof ObjectId) {
		return id;
	}
	try {
		return new ObjectId(id);
	} catch {
		return undefined;
	}
}

/**
 * ANCHOR:outbox-reservation
 * Grab the oldest pending outbox entry so we maintain strict FIFO delivery
 * and can recover safely if the worker crashes mid-turn.
 */
async function reserveNextMessage() {
	const outbox = getResponderOutbox();

	const result = await outbox.findOneAndUpdate(
		{ status: "pending" },
		{
			$set: {
				status: "processing" as const,
				processingStartedAt: new Date(),
				workerId: WORKER_ID,
			},
		},
		{
			sort: { createdAt: 1 },
			returnDocument: "after",
		},
	);

	return result.value ?? null;
}

async function markOutboxStatus(
	outboxId: ObjectId | undefined,
	status: ResponderOutboxMessage["status"],
	extra?: Record<string, unknown>,
) {
	if (!outboxId) {
		return;
	}

	const outbox = getResponderOutbox();
	await outbox.updateOne(
		{ _id: outboxId },
		{
			$set: {
				status,
				updatedAt: new Date(),
				...(extra ?? {}),
			},
		},
	);
}

/**
 * ANCHOR:event-status-mirror
 * When the worker changes delivery state we reflect that onto the user event
 * the dashboard already rendered. This mimics ChatKit's status pills so the UI
 * can show "queued → processing → delivered/failed" without extra polling.
 */
async function updateUserEventStatus(
	outboxId: ObjectId | undefined,
	status: "queued" | "processing" | "delivered" | "failed",
	workflowId?: string,
	error?: string,
) {
	if (!outboxId) {
		return;
	}
	const events = getResponderEvents();
	const metadataUpdates: Record<string, unknown> = {
		"metadata.status": status,
	};
	if (error) {
		metadataUpdates["metadata.error"] = error;
	}

	await events.updateMany(
		{
			"metadata.outboxId": outboxId.toString(),
			role: "user",
			...(workflowId
				? {
						$or: [{ workflowId }, { "metadata.workflowId": workflowId }],
					}
				: {}),
		},
		{ $set: metadataUpdates },
	);
}

/**
 * Inserts an assistant event for the current workflow. Metadata includes the
 * workerId so we can trace which orchestrator produced the turn.
 */
async function emitAssistantEvent(
	userId: string,
	workflowId: string | undefined,
	content: string,
	metadata: AssistantEventMetadata,
) {
	const events = getResponderEvents();

	await events.insertOne({
		userId,
		workflowId,
		role: "assistant",
		content,
		createdAt: new Date(),
		metadata: {
			...metadata,
			workflowId,
		},
	});
}

function extractAssistantContent(response: Awaited<
	ReturnType<typeof julepClient.sessions.chat>
>) {
	const assistantMessage = response.messages.find(
		(message) => message.role === "assistant",
	);

	if (!assistantMessage) {
		throw new Error("Assistant did not return a message");
	}

	const content = Array.isArray(assistantMessage.content)
		? assistantMessage.content
				.map((segment) => {
					if (typeof segment === "string") {
						return segment;
					}
					if (segment && typeof segment === "object") {
						if (typeof (segment as { text?: string }).text === "string") {
							return (segment as { text: string }).text;
						}
						if (
							"content" in segment &&
							typeof (segment as { content?: string }).content === "string"
						) {
							return (segment as { content: string }).content;
						}
					}
					return "";
				})
				.filter(Boolean)
				.join("\n")
		: typeof assistantMessage.content === "string"
			? assistantMessage.content
			: typeof (assistantMessage.content as { text?: string })?.text === "string"
				? (assistantMessage.content as { text: string }).text
				: "";

	if (!content.trim()) {
		throw new Error("Assistant returned an empty message");
	}

	return content.trim();
}

/**
 * ANCHOR:responder-turn
 * Core responder loop: claim the pending prompt, reuse the Julep session for
 * recall, emit the assistant reply, mirror status, and optionally stream audio.
 * Any thrown error is caught higher up where we emit a user-visible failure.
 */
async function processMessage(message: ResponderOutboxMessage) {
	const outboxId = asObjectId(message._id);
	const workflowId = message.workflowId ?? WORKFLOW_ID;
	await updateUserEventStatus(outboxId, "processing", workflowId);

	const users = getUsers();
	const user = await users.findOne({ id: message.userId });

	if (!user) {
		throw new Error(`User ${message.userId} not found`);
	}

	if (!user.julep_user_id) {
		throw new Error(`User ${message.userId} missing Julep user id`);
	}

	const julepSessionId = await getOrCreateJulepSession(user.julep_user_id);

	const response = await julepClient.sessions.chat({
		sessionId: julepSessionId,
		messages: [
			{
				role: "user",
				content: message.content,
			},
		],
		stream: false,
	});

	const assistantContent = extractAssistantContent(response);

	await emitAssistantEvent(message.userId, workflowId, assistantContent, {
		outboxId: outboxId?.toString(),
		status: "delivered",
		source: "worker",
		workerId: WORKER_ID,
	});

	await updateUserEventStatus(outboxId, "delivered", workflowId);

	await writeConversationSummary(
		user.julep_user_id,
		`User: ${message.content}\nAssistant: ${assistantContent}`,
		julepSessionId,
	);

	if (process.env.RESPONDER_WORKER_ENABLE_TTS === "true") {
		try {
			const audioStream = await textToSpeechStream(assistantContent);
			const events = getResponderEvents();
			for await (const chunk of audioStream) {
				const buffer = Buffer.from(chunk);
				await events.insertOne({
					userId: message.userId,
					workflowId,
					role: "system",
					content: "",
					createdAt: new Date(),
					metadata: {
						kind: "audio:chunk",
						outboxId: outboxId?.toString(),
						data: buffer.toString("base64"),
						workerId: WORKER_ID,
						workflowId,
					},
				});
			}
			await events.insertOne({
				userId: message.userId,
				workflowId,
				role: "system",
				content: "",
				createdAt: new Date(),
					metadata: {
						kind: "audio:end",
						outboxId: outboxId?.toString(),
						workerId: WORKER_ID,
						workflowId,
					},
				});
		} catch (error) {
			console.error("Failed to stream TTS audio:", error);
		}
	}
}

async function run() {
	console.info(`[ResponderWorker] starting (id=${WORKER_ID})`);

	// eslint-disable-next-line no-constant-condition
	while (true) {
		try {
			const job = await reserveNextMessage();
			if (!job) {
				await delay(POLL_INTERVAL_MS);
				continue;
			}

			try {
				await processMessage(job);
				await markOutboxStatus(asObjectId(job._id), "delivered");
			} catch (error) {
				console.error(
					`[ResponderWorker] failed to process message ${job._id}:`,
					error,
				);
				const outboxId = asObjectId(job._id);
				const workflowId = job.workflowId ?? WORKFLOW_ID;
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";

				await updateUserEventStatus(outboxId, "failed", workflowId, errorMessage);
				await emitAssistantEvent(
					job.userId,
					workflowId,
					"Something went wrong while processing your request. Please try again.",
					{
						outboxId: outboxId?.toString(),
						status: "failed",
						source: "worker",
						workerId: WORKER_ID,
						error: errorMessage,
					},
				);
				await markOutboxStatus(outboxId, "failed", {
					error: errorMessage,
					failedAt: new Date(),
				});
			}
		} catch (loopError) {
			console.error("[ResponderWorker] loop error:", loopError);
			await delay(1000);
		}
	}
}

run()
	.then(() => {
		console.info("[ResponderWorker] stopped");
		process.exit(0);
	})
	.catch((error) => {
		console.error("[ResponderWorker] fatal error:", error);
		process.exit(1);
	});
