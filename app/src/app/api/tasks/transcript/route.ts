import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getElevenLabsConversations, getUsers } from "@/lib/mongo";
import { processTranscriptConversation } from "@/lib/transcript-processor";

const transcriptLogger = logger.child("api:tasks:transcript");

/**
 * POST /api/tasks/transcript
 *
 * ANCHOR:transcript-task-trigger
 *
 * Main API endpoint for triggering background processing after ElevenLabs conversation ends.
 *
 * Flow:
 * 1. Validate authentication and conversation ownership
 * 2. Call processTranscriptConversation() which:
 *    - Fetches transcript from ElevenLabs API
 *    - Executes Julep background task (transcript-processor.yaml)
 *    - Merges results to MongoDB user_overview
 * 3. Fire-and-forget trigger additional tasks (gamification, charts)
 * 4. Return task execution details to caller
 *
 * This endpoint is typically called by frontend after conversation ends,
 * or by webhooks/scheduled jobs for batch processing.
 *
 * Request body:
 * {
 *   conversation_id: string;
 *   user_id?: string;  // Optional, defaults to authenticated user
 * }
 */
export async function POST(request: Request) {
	try {
		// Check authentication
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { conversation_id } = body;

		if (!conversation_id) {
			return NextResponse.json(
				{ error: "Missing conversation_id" },
				{ status: 400 },
			);
		}

		const userId = body.user_id || session.user.id;

		// Get user from MongoDB
		const users = getUsers();
		const user = await users.findOne({ id: userId });

		if (!user) {
			transcriptLogger.error("User not found", { userId });
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		if (!user.julep_user_id) {
			transcriptLogger.error("User missing Julep ID", { userId });
			return NextResponse.json(
				{ error: "User not linked to Julep" },
				{ status: 500 },
			);
		}

		// Verify conversation belongs to user
		const conversations = getElevenLabsConversations();
		const conversation = await conversations.findOne({
			conversation_id,
			user_id: userId,
		});

		if (!conversation) {
			transcriptLogger.error("Conversation not found or unauthorized", {
				conversationId: conversation_id,
				userId,
			});
			return NextResponse.json(
				{ error: "Conversation not found or unauthorized" },
				{ status: 404 },
			);
		}

		transcriptLogger.info("Starting transcript processing", {
			conversationId: conversation_id,
			userId,
			julepUserId: user.julep_user_id,
		});

		const result = await processTranscriptConversation({
			user,
			conversation,
		});

		// ANCHOR:async-task-chaining
		// Trigger additional background tasks asynchronously (fire-and-forget)
		// These tasks run independently and update their own sections of user_overview
		const triggerAdditionalTasks = async () => {
			// Trigger gamification update (streak tracking, milestones)
			transcriptLogger.info("Triggering gamification update", { userId });
			fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/tasks/gamification`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					user_id: userId,
					conversation_id: result.conversation_id,
					event_type: "conversation_completed",
				}),
			}).catch((err) =>
				transcriptLogger.error("Failed to trigger gamification update", err),
			);

			// Trigger chart calculation if birth data is complete and chart doesn't exist
			const updatedUser = await users.findOne({ id: userId });
			const hasBirthData =
				updatedUser?.date_of_birth &&
				updatedUser?.birth_time &&
				updatedUser?.birth_location;
			const hasChart = updatedUser?.user_overview?.birth_chart;

			if (hasBirthData && !hasChart) {
				transcriptLogger.info(
					"Triggering chart calculation (both Vedic and Western)",
					{ userId },
				);
				fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/tasks/chart`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						user_id: userId,
					}),
				}).catch((err) =>
					transcriptLogger.error("Failed to trigger chart calculation", err),
				);
			}
		};

		triggerAdditionalTasks();

		return NextResponse.json({
			success: true,
			task_id: result.task_id,
			execution_id: result.execution_id,
			conversation_id: result.conversation_id,
			message: "Transcript processed and MongoDB updated successfully",
			overview_updates: result.overview_updates,
			conversation_summary: result.conversation_summary,
			memories_count: result.memories_count,
		});
	} catch (error) {
		transcriptLogger.error("Failed to process transcript", error as Error);

		return NextResponse.json(
			{
				error: "Internal server error",
				message: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}

/**
 * GET /api/tasks/transcript?execution_id=xxx
 *
 * Check status of a transcript processing task
 */
export async function GET(request: Request) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const executionId = searchParams.get("execution_id");

		if (!executionId) {
			return NextResponse.json(
				{ error: "Missing execution_id" },
				{ status: 400 },
			);
		}

		const execution = await julepClient.getExecution(executionId);

		return NextResponse.json({
			execution_id: executionId,
			status: execution.status,
			output: execution.output,
			error: execution.error,
		});
	} catch (error) {
		transcriptLogger.error("Failed to get execution status", error as Error);

		return NextResponse.json(
			{
				error: "Internal server error",
				message: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
