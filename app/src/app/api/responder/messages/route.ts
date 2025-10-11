import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { WORKFLOW_ID } from "@/lib/chatkit-config";
import { getResponderEvents, getResponderOutbox } from "@/lib/mongo";

const MAX_MESSAGE_LENGTH = 2000;

export async function POST(request: Request) {
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch (_error) {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	if (typeof payload !== "object" || payload === null) {
		return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
	}

	const { content, metadata, workflowId } = payload as {
		content?: unknown;
		metadata?: unknown;
		workflowId?: unknown;
	};

	if (typeof content !== "string" || !content.trim()) {
		return NextResponse.json(
			{ error: "Message content is required" },
			{ status: 400 },
		);
	}

	if (content.trim().length > MAX_MESSAGE_LENGTH) {
		return NextResponse.json({ error: "Message is too long" }, { status: 400 });
	}

	if (metadata !== undefined && typeof metadata !== "object") {
		return NextResponse.json(
			{ error: "Metadata must be an object" },
			{ status: 400 },
		);
	}

	const outboxCollection = getResponderOutbox();
	const eventsCollection = getResponderEvents();
	const now = new Date();

	const metadataRecord =
		metadata && typeof metadata === "object"
			? (metadata as Record<string, unknown>)
			: undefined;

	const resolvedWorkflowId =
		typeof workflowId === "string" && workflowId.trim().length > 0
			? workflowId.trim()
			: WORKFLOW_ID;

	const source =
		metadataRecord && typeof metadataRecord.source === "string"
			? (metadataRecord.source as string)
			: "api";

	const insertResult = await outboxCollection.insertOne({
		userId: session.user.id,
		workflowId: resolvedWorkflowId,
		content: content.trim(),
		createdAt: now,
		status: "pending",
		metadata: metadataRecord ?? null,
	});

	const outboxId = insertResult.insertedId?.toString();

	await eventsCollection.insertOne({
		userId: session.user.id,
		workflowId: resolvedWorkflowId,
		role: "user",
		content: content.trim(),
		createdAt: now,
		metadata: {
			outboxId,
			status: "queued",
			source,
			workflowId: resolvedWorkflowId,
			payload: metadataRecord,
		},
	});

	return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const url = new URL(request.url);
	const requestedWorkflow =
		url.searchParams.get("workflowId")?.trim() || WORKFLOW_ID;

	const events = getResponderEvents();
	const userEvents = await events
		.find({
			userId: session.user.id,
			$or: [
				{ workflowId: { $exists: false } },
				{ workflowId: requestedWorkflow },
			],
		})
		.sort({ createdAt: -1 })
		.limit(100)
		.toArray();

	return NextResponse.json({
		messages: userEvents
			.map((event) => ({
				id: event._id?.toString() ?? `event-${event.createdAt.getTime()}`,
				workflowId: event.workflowId,
				role: event.role,
				content: event.content,
				createdAt: event.createdAt,
				metadata: event.metadata ?? null,
			}))
			.reverse(),
	});
}
