import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getElevenLabsClient } from "@/lib/elevenlabs";

export async function POST(request: Request) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { agentId } = body;

		if (!agentId) {
			return NextResponse.json(
				{ error: "Agent ID is required" },
				{ status: 400 },
			);
		}

		const client = getElevenLabsClient();
		const response = await client.conversationalAi.conversations.getSignedUrl({
			agentId,
		});

		return NextResponse.json({
			signedUrl: response.signedUrl ?? response.signed_url ?? null,
		});
	} catch (error) {
		console.error("Failed to create signed URL:", error);
		return NextResponse.json(
			{ error: "Failed to create signed URL" },
			{ status: 500 },
		);
	}
}
