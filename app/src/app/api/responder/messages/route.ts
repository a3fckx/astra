import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getResponderOutbox } from "@/lib/mongo";

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
	} catch (error) {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	if (typeof payload !== "object" || payload === null) {
		return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
	}

	const { content, metadata } = payload as {
		content?: unknown;
		metadata?: unknown;
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

	const outbox = getResponderOutbox();
	const now = new Date();

	await outbox.insertOne({
		userId: session.user.id,
		content: content.trim(),
		createdAt: now,
		status: "pending",
		metadata: metadata ? (metadata as Record<string, unknown>) : null,
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

	const outbox = getResponderOutbox();
	const userMessages = await outbox
		.find({ userId: session.user.id })
		.sort({ createdAt: -1 })
		.limit(50)
		.toArray();

	return NextResponse.json({
		messages: userMessages.map((message) => ({
			id: message._id?.toString() ?? `outbox-${message.createdAt.getTime()}`,
			content: message.content,
			createdAt: message.createdAt,
			status: message.status,
		})),
	});
}
