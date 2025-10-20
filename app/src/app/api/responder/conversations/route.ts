import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getElevenLabsConversations, getUsers } from "@/lib/mongo";

const routeLogger = logger.child("responder-conversations-route");

const asTrimmedString = (value: unknown) =>
	typeof value === "string" ? value.trim() : "";

export async function POST(request: Request) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return NextResponse.json(
			{ error: "Invalid JSON payload" },
			{ status: 400 },
		);
	}

	const conversationId = asTrimmedString(
		(payload as Record<string, unknown>)?.conversationId,
	);

	if (!conversationId) {
		return NextResponse.json(
			{ error: "conversationId is required" },
			{ status: 400 },
		);
	}

	const agentId = asTrimmedString(
		(payload as Record<string, unknown>)?.agentId,
	);
	const workflowId = asTrimmedString(
		(payload as Record<string, unknown>)?.workflowId,
	);
	const overviewPayload = (payload as Record<string, unknown>)?.overview;
	const overview =
		overviewPayload && typeof overviewPayload === "object"
			? (overviewPayload as Record<string, unknown>)
			: null;

	const metadataCandidate = (payload as Record<string, unknown>)
		?.metadata as unknown;
	const metadata =
		metadataCandidate &&
		typeof metadataCandidate === "object" &&
		!Array.isArray(metadataCandidate)
			? (metadataCandidate as Record<string, unknown>)
			: null;

	const now = new Date();

	try {
		const conversations = getElevenLabsConversations();
		await conversations.updateOne(
			{
				user_id: session.user.id,
				conversation_id: conversationId,
			},
			{
				$set: {
					agent_id: agentId || null,
					workflow_id: workflowId || null,
					metadata,
					updated_at: now,
					overview_snapshot: overview ?? null,
				},
				$setOnInsert: {
					started_at: now,
				},
			},
			{ upsert: true },
		);

		const users = getUsers();
		await users.updateOne(
			{ id: session.user.id },
			/**
			 * ANCHOR:conversation-history-array
			 * Store a running list of ElevenLabs conversation IDs on the user document.
			 * Background workers can read this array to schedule transcription or analysis jobs.
			 */
			{
				$push: {
					elevenlabs_conversations: conversationId,
				},
			},
			{ upsert: false },
		);

		return NextResponse.json({ ok: true }, { status: 201 });
	} catch (error) {
		routeLogger.error("Failed to persist ElevenLabs conversation", {
			userId: session.user.id,
			conversationId,
			error: error instanceof Error ? error.message : String(error),
		});

		return NextResponse.json(
			{ error: "Failed to persist conversation" },
			{ status: 500 },
		);
	}
}
