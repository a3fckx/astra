import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBackgroundWorkerAgentId, julepClient } from "@/lib/julep-client";
import { logger } from "@/lib/logger";
import { getUsers } from "@/lib/mongo";
import { loadTaskDefinition } from "@/lib/tasks/loader";

const personaLogger = logger.child("api:tasks:persona");

/**
 * POST /api/tasks/persona
 *
 * ANCHOR:persona-enrichment-trigger
 *
 * Analyzes conversation patterns to refine user preferences and communication style.
 *
 * This task examines the last 10-20 conversations to identify:
 * - Communication style preferences (casual, balanced, formal)
 * - Most discussed topics and interests
 * - Hinglish usage level (0-100%)
 * - Emotional patterns and engagement triggers
 * - Response length preferences
 * - Time patterns (if detectable)
 *
 * Requirements:
 * - At least 5 completed conversations with summaries
 *
 * Request body:
 * {
 *   user_id?: string;              // Optional, defaults to authenticated user
 *   force_analyze?: boolean;       // Force analysis even if recently run
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
		const userId = body.user_id || session.user.id;
		const _forceAnalyze = body.force_analyze ?? false;

		// Get user from MongoDB
		const users = getUsers();
		const user = await users.findOne({ id: userId });

		if (!user) {
			personaLogger.error("User not found", { userId });
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		if (!user.julep_user_id) {
			personaLogger.error("User missing Julep ID", { userId });
			return NextResponse.json(
				{ error: "User not linked to Julep" },
				{ status: 500 },
			);
		}

		// ANCHOR:conversation-count-check
		// Check if user has enough conversations for meaningful analysis
		const recentConversations = user.user_overview?.recent_conversations || [];

		if (recentConversations.length < 5) {
			personaLogger.warn("Not enough conversations for persona analysis", {
				userId,
				conversationCount: recentConversations.length,
			});
			return NextResponse.json(
				{
					success: false,
					error: "Insufficient data",
					message: `Need at least 5 conversations for analysis. Currently: ${recentConversations.length}`,
					conversations_needed: 5 - recentConversations.length,
				},
				{ status: 400 },
			);
		}

		// Get existing preferences
		const existingPreferences = user.user_overview?.preferences || {};

		personaLogger.info("Starting persona enrichment analysis", {
			userId,
			julepUserId: user.julep_user_id,
			conversationCount: recentConversations.length,
		});

		// ANCHOR:persona-task-execution
		// Load and execute persona enrichment task
		const taskDef = loadTaskDefinition("PERSONA_ENRICHMENT");
		const agentId = getBackgroundWorkerAgentId();

		const result = await julepClient.createAndExecuteTask(
			agentId,
			taskDef,
			{
				recent_conversations: recentConversations.slice(0, 20), // Last 20 max
				existing_preferences: existingPreferences,
			},
			{
				maxAttempts: 60,
				intervalMs: 2000,
				onProgress: (status, attempt) => {
					personaLogger.debug("Persona task execution progress", {
						userId,
						status,
						attempt,
					});
				},
			},
		);

		if (result.status !== "succeeded") {
			personaLogger.error("Persona enrichment task failed", {
				userId,
				error: result.error,
			});

			return NextResponse.json(
				{
					success: false,
					error: result.error || "Persona enrichment failed",
					task_id: result.task_id,
					execution_id: result.id,
				},
				{ status: 500 },
			);
		}

		// ANCHOR:persona-mongodb-sync
		// Extract enriched preferences from task output and sync to MongoDB
		const taskOutput = result.output as {
			success?: boolean;
			preferences_update?: Record<string, unknown>;
			conversations_analyzed?: number;
			generated_at?: string;
			skipped?: boolean;
			message?: string;
		};

		// Handle case where task was skipped due to insufficient data
		if (taskOutput.skipped) {
			personaLogger.info("Persona analysis skipped", {
				userId,
				message: taskOutput.message,
			});
			return NextResponse.json({
				success: false,
				skipped: true,
				message: taskOutput.message || "Analysis skipped",
			});
		}

		if (!taskOutput.preferences_update) {
			personaLogger.error("Task output missing preferences_update", {
				userId,
				output: taskOutput,
			});
			return NextResponse.json(
				{
					success: false,
					error: "Invalid task output",
					message: "Task completed but preferences data is missing",
				},
				{ status: 500 },
			);
		}

		// Merge enriched preferences with existing ones
		const enrichedPreferences = {
			...existingPreferences,
			...taskOutput.preferences_update,
		};

		// Update MongoDB user_overview.preferences
		await users.updateOne(
			{ id: userId },
			{
				$set: {
					"user_overview.preferences": enrichedPreferences,
					"user_overview.last_updated": new Date(),
					"user_overview.updated_by": result.id,
				},
			},
		);

		personaLogger.info("Persona enrichment synced to MongoDB", {
			userId,
			conversationsAnalyzed: taskOutput.conversations_analyzed || 0,
			preferencesUpdated: Object.keys(taskOutput.preferences_update).length,
		});

		return NextResponse.json({
			success: true,
			task_id: result.task_id,
			execution_id: result.id,
			message: "Persona enrichment completed successfully",
			preferences_update: taskOutput.preferences_update,
			conversations_analyzed: taskOutput.conversations_analyzed,
		});
	} catch (error) {
		personaLogger.error("Failed to run persona enrichment", {
			error: error instanceof Error ? error.message : String(error),
		});

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
 * GET /api/tasks/persona?user_id=xxx
 *
 * Get current preferences from MongoDB
 */
export async function GET(request: Request) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const userId = searchParams.get("user_id") || session.user.id;

		const users = getUsers();
		const user = await users.findOne({ id: userId });

		if (!user) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		const preferences = user.user_overview?.preferences || null;
		const conversationCount =
			user.user_overview?.recent_conversations?.length || 0;

		return NextResponse.json({
			success: true,
			preferences,
			has_preferences: !!preferences,
			conversation_count: conversationCount,
			can_analyze: conversationCount >= 5,
		});
	} catch (error) {
		personaLogger.error("Failed to get preferences", {
			error: error instanceof Error ? error.message : String(error),
		});

		return NextResponse.json(
			{
				error: "Internal server error",
				message: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
