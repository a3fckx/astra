import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBackgroundWorkerAgentId, julepClient } from "@/lib/julep-client";
import { logger } from "@/lib/logger";
import { getElevenLabsConversations, getUsers } from "@/lib/mongo";
import { loadTaskDefinition } from "@/lib/tasks/loader";

const weeklyReportLogger = logger.child("api:tasks:weekly-report");

/**
 * POST /api/tasks/weekly-report
 *
 * ANCHOR:weekly-report-task-trigger
 *
 * Generates personalized weekly companion report with conversation summaries and progress.
 *
 * This task creates a warm, 4-paragraph weekly check-in that includes:
 * - Conversation themes and growth highlights
 * - Progress celebration (streak, milestones, topics explored)
 * - Thoughtful reflection prompt for next week
 * - Personalized with user's Hinglish level and communication style
 *
 * Request body:
 * {
 *   user_id?: string;              // Optional, defaults to authenticated user
 *   force_regenerate?: boolean;    // Force regeneration even if this week's report exists
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
		const _forceRegenerate = body.force_regenerate ?? false;

		// Get user from MongoDB
		const users = getUsers();
		const user = await users.findOne({ id: userId });

		if (!user) {
			weeklyReportLogger.error("User not found", { userId });
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		if (!user.julep_user_id) {
			weeklyReportLogger.error("User missing Julep ID", { userId });
			return NextResponse.json(
				{ error: "User not linked to Julep" },
				{ status: 500 },
			);
		}

		// ANCHOR:weekly-conversations-filter
		// Get conversations from last 7 days
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		const conversations = getElevenLabsConversations();
		const recentConversations = await conversations
			.find({
				user_id: userId,
				status: "completed",
				ended_at: { $gte: sevenDaysAgo },
			})
			.sort({ ended_at: -1 })
			.toArray();

		if (recentConversations.length === 0) {
			weeklyReportLogger.info("No conversations in last 7 days", { userId });
			return NextResponse.json(
				{
					success: false,
					message: "No conversations in the last 7 days to generate report",
					conversations_found: 0,
				},
				{ status: 400 },
			);
		}

		// Map conversation IDs to summaries from user_overview
		const recentConversationSummaries =
			user.user_overview?.recent_conversations || [];
		const conversationMap = new Map(
			recentConversationSummaries.map((conv) => [conv.conversation_id, conv]),
		);

		const weeklyConversations = recentConversations
			.map((conv) => conversationMap.get(conv.conversation_id))
			.filter((conv): conv is NonNullable<typeof conv> => !!conv);

		if (weeklyConversations.length === 0) {
			weeklyReportLogger.warn(
				"Conversations found but no summaries available",
				{ userId },
			);
			return NextResponse.json(
				{
					success: false,
					message:
						"Conversations found but not yet processed. Please wait for transcript processing to complete.",
					conversations_found: recentConversations.length,
				},
				{ status: 400 },
			);
		}

		// Extract data for report generation
		const userName = user.name.split(" ")[0]; // First name only
		const gamification = user.user_overview?.gamification || {};
		const preferences = user.user_overview?.preferences || {};
		const birthChart = user.user_overview?.birth_chart;

		// Create brief birth chart summary
		let birthChartSummary: string | undefined;
		if (birthChart) {
			const chart = birthChart.vedic || birthChart.western;
			if (chart) {
				const sun = (chart as Record<string, unknown>)?.sun_sign;
				const moon = (chart as Record<string, unknown>)?.moon_sign;
				const rising = (chart as Record<string, unknown>)?.rising_sign;
				birthChartSummary = `${sun} Sun, ${moon} Moon${rising ? `, ${rising} Rising` : ""}`;
			}
		}

		weeklyReportLogger.info("Generating weekly report", {
			userId,
			julepUserId: user.julep_user_id,
			conversationsCount: weeklyConversations.length,
			userName,
		});

		// ANCHOR:weekly-report-task-execution
		// Load and execute weekly report generator task
		const taskDef = loadTaskDefinition("WEEKLY_REPORT_GENERATOR");
		const agentId = getBackgroundWorkerAgentId();

		const result = await julepClient.createAndExecuteTask(
			agentId,
			taskDef,
			{
				user_name: userName,
				recent_conversations: weeklyConversations.map((conv) => ({
					date: conv.date,
					topics: conv.topics || [],
					summary: conv.summary || "",
					key_insights: conv.key_insights || [],
					emotional_tone: conv.emotional_tone,
				})),
				gamification,
				preferences,
				birth_chart_summary: birthChartSummary,
			},
			{
				maxAttempts: 60,
				intervalMs: 2000,
				onProgress: (status, attempt) => {
					weeklyReportLogger.debug("Weekly report task execution progress", {
						userId,
						status,
						attempt,
					});
				},
			},
		);

		if (result.status !== "succeeded") {
			weeklyReportLogger.error("Weekly report generation task failed", {
				userId,
				error: result.error,
			});

			return NextResponse.json(
				{
					success: false,
					error: result.error || "Weekly report generation failed",
					task_id: result.task_id,
					execution_id: result.id,
				},
				{ status: 500 },
			);
		}

		// ANCHOR:weekly-report-mongodb-sync
		// Extract report from task output and sync to MongoDB
		const taskOutput = result.output as {
			success?: boolean;
			weekly_report?: {
				week_start: string;
				week_end: string;
				content: string;
				stats: {
					conversations: number;
					topics: string[];
					streak: number;
					milestones: string[];
				};
				generated_at: string;
			};
		};

		if (!taskOutput.weekly_report) {
			weeklyReportLogger.error("Task output missing weekly_report", {
				userId,
				output: taskOutput,
			});
			return NextResponse.json(
				{
					success: false,
					error: "Invalid task output",
					message: "Task completed but weekly report data is missing",
				},
				{ status: 500 },
			);
		}

		// Store report in user_overview (keep last 4 weeks)
		const existingReports = user.user_overview?.weekly_reports || [];
		const updatedReports = [taskOutput.weekly_report, ...existingReports].slice(
			0,
			4,
		);

		await users.updateOne(
			{ id: userId },
			{
				$set: {
					"user_overview.weekly_reports": updatedReports,
					"user_overview.latest_weekly_report": taskOutput.weekly_report,
					"user_overview.last_updated": new Date(),
					"user_overview.updated_by": result.id,
				},
			},
		);

		weeklyReportLogger.info("Weekly report synced to MongoDB", {
			userId,
			weekStart: taskOutput.weekly_report.week_start,
			weekEnd: taskOutput.weekly_report.week_end,
			conversationsCount: taskOutput.weekly_report.stats.conversations,
			contentLength: taskOutput.weekly_report.content.length,
		});

		return NextResponse.json({
			success: true,
			task_id: result.task_id,
			execution_id: result.id,
			message: "Weekly report generated successfully",
			weekly_report: taskOutput.weekly_report,
		});
	} catch (error) {
		weeklyReportLogger.error("Failed to generate weekly report", {
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
 * GET /api/tasks/weekly-report?user_id=xxx
 *
 * Get latest weekly report from MongoDB
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

		const latestReport = user.user_overview?.latest_weekly_report || null;
		const allReports = user.user_overview?.weekly_reports || [];

		return NextResponse.json({
			success: true,
			latest_report: latestReport,
			all_reports: allReports,
			reports_count: allReports.length,
		});
	} catch (error) {
		weeklyReportLogger.error("Failed to get weekly report", {
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
