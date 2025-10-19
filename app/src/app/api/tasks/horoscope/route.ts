import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBackgroundWorkerAgentId, julepClient } from "@/lib/julep-client";
import { logger } from "@/lib/logger";
import { getUsers } from "@/lib/mongo";
import { loadTaskDefinition } from "@/lib/tasks/loader";

const horoscopeLogger = logger.child("api:tasks:horoscope");

/**
 * POST /api/tasks/horoscope
 *
 * ANCHOR:horoscope-task-trigger
 *
 * Generates personalized daily horoscope and syncs to MongoDB user_overview.latest_horoscope
 *
 * This task creates a warm, personalized 2-3 paragraph horoscope based on:
 * - User's sun sign, moon sign, and rising sign
 * - Current planetary transits
 * - Recent conversation topics for context
 * - Practical guidance for relationships, work, personal growth
 *
 * Requirements:
 * - Birth chart must be calculated (sun_sign and moon_sign required)
 *
 * Request body:
 * {
 *   user_id?: string;              // Optional, defaults to authenticated user
 *   force_regenerate?: boolean;    // Force regeneration even if today's horoscope exists
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
		const forceRegenerate = body.force_regenerate ?? false;

		// Get user from MongoDB
		const users = getUsers();
		const user = await users.findOne({ id: userId });

		if (!user) {
			horoscopeLogger.error("User not found", { userId });
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		if (!user.julep_user_id) {
			horoscopeLogger.error("User missing Julep ID", { userId });
			return NextResponse.json(
				{ error: "User not linked to Julep" },
				{ status: 500 },
			);
		}

		// ANCHOR:birth-chart-validation
		// Check if user has birth chart (required for horoscope generation)
		const birthChart = user.user_overview?.birth_chart;

		if (!birthChart || !birthChart.vedic || !birthChart.western) {
			horoscopeLogger.warn("User missing birth chart", { userId });
			return NextResponse.json(
				{
					success: false,
					error: "Birth chart required",
					message:
						"Cannot generate horoscope without birth chart. Please calculate birth chart first.",
				},
				{ status: 400 },
			);
		}

		// Extract chart data (prefer Vedic if available)
		const astrology_system = user.user_overview?.preferences
			?.astrology_system as string | undefined;
		const preferVedic = !astrology_system || astrology_system === "vedic";
		const chart = preferVedic
			? (birthChart.vedic as Record<string, unknown>)
			: (birthChart.western as Record<string, unknown>);

		const sunSign = (chart?.sun_sign as string) || "Unknown";
		const moonSign = (chart?.moon_sign as string) || "Unknown";
		const risingSign = (chart?.rising_sign as string) || undefined;

		if (sunSign === "Unknown" || moonSign === "Unknown") {
			horoscopeLogger.error("Birth chart missing required signs", {
				userId,
				sunSign,
				moonSign,
			});
			return NextResponse.json(
				{
					success: false,
					error: "Incomplete birth chart",
					message: "Birth chart must have sun_sign and moon_sign calculated.",
				},
				{ status: 400 },
			);
		}

		// Check if today's horoscope already exists (unless force_regenerate)
		const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
		const existingHoroscope = user.user_overview?.latest_horoscope;

		if (
			!forceRegenerate &&
			existingHoroscope &&
			existingHoroscope.date === today
		) {
			horoscopeLogger.info("Today's horoscope already exists", { userId });
			return NextResponse.json({
				success: true,
				message: "Today's horoscope already generated",
				horoscope: existingHoroscope,
				skipped: true,
			});
		}

		// Extract recent topics for personalization
		const recentConversations = user.user_overview?.recent_conversations || [];
		const recentTopics = new Set<string>();
		for (const conv of recentConversations.slice(0, 5)) {
			// Last 5 conversations
			if (conv.topics) {
				for (const topic of conv.topics) {
					recentTopics.add(topic);
				}
			}
		}

		horoscopeLogger.info("Generating daily horoscope", {
			userId,
			julepUserId: user.julep_user_id,
			sunSign,
			moonSign,
			risingSign,
			recentTopics: Array.from(recentTopics),
		});

		// ANCHOR:horoscope-task-execution
		// Load and execute horoscope generator task
		const taskDef = loadTaskDefinition("HOROSCOPE_REFRESHER");
		const agentId = getBackgroundWorkerAgentId();

		const result = await julepClient.createAndExecuteTask(
			agentId,
			taskDef,
			{
				sun_sign: sunSign,
				moon_sign: moonSign,
				rising_sign: risingSign,
				user_name: user.name.split(" ")[0], // First name only
				recent_topics: Array.from(recentTopics),
				astrology_system: preferVedic ? "vedic" : "western",
			},
			{
				maxAttempts: 60,
				intervalMs: 2000,
				onProgress: (status, attempt) => {
					horoscopeLogger.debug("Horoscope task execution progress", {
						userId,
						status,
						attempt,
					});
				},
			},
		);

		if (result.status !== "succeeded") {
			horoscopeLogger.error("Horoscope generation task failed", {
				userId,
				error: result.error,
			});

			return NextResponse.json(
				{
					success: false,
					error: result.error || "Horoscope generation failed",
					task_id: result.task_id,
					execution_id: result.id,
				},
				{ status: 500 },
			);
		}

		// ANCHOR:horoscope-mongodb-sync
		// Extract horoscope from task output and sync to MongoDB
		const taskOutput = result.output as {
			success?: boolean;
			horoscope?: {
				date: string;
				content: string;
				sun_sign: string;
				moon_sign: string;
				generated_at: string;
			};
		};

		if (!taskOutput.horoscope) {
			horoscopeLogger.error("Task output missing horoscope", {
				userId,
				output: taskOutput,
			});
			return NextResponse.json(
				{
					success: false,
					error: "Invalid task output",
					message: "Task completed but horoscope data is missing",
				},
				{ status: 500 },
			);
		}

		// Update MongoDB user_overview.latest_horoscope
		await users.updateOne(
			{ id: userId },
			{
				$set: {
					"user_overview.latest_horoscope": taskOutput.horoscope,
					"user_overview.last_updated": new Date(),
					"user_overview.updated_by": result.id,
				},
			},
		);

		horoscopeLogger.info("Daily horoscope synced to MongoDB", {
			userId,
			date: taskOutput.horoscope.date,
			contentLength: taskOutput.horoscope.content.length,
		});

		return NextResponse.json({
			success: true,
			task_id: result.task_id,
			execution_id: result.id,
			message: "Daily horoscope generated successfully",
			horoscope: taskOutput.horoscope,
		});
	} catch (error) {
		horoscopeLogger.error("Failed to generate horoscope", {
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
 * GET /api/tasks/horoscope?user_id=xxx
 *
 * Get current daily horoscope from MongoDB
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

		const horoscope = user.user_overview?.latest_horoscope || null;

		// Check if horoscope is from today
		const today = new Date().toISOString().split("T")[0];
		const isToday = horoscope?.date === today;

		return NextResponse.json({
			success: true,
			horoscope,
			has_horoscope: !!horoscope,
			is_today: isToday,
		});
	} catch (error) {
		horoscopeLogger.error("Failed to get horoscope", {
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
