import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBackgroundWorkerAgentId, julepClient } from "@/lib/julep-client";
import { logger } from "@/lib/logger";
import { getUsers } from "@/lib/mongo";
import { loadTaskDefinition } from "@/lib/tasks/loader";

const chartLogger = logger.child("api:tasks:chart");

/**
 * POST /api/tasks/chart
 *
 * ANCHOR:chart-task-trigger
 *
 * Triggers chart calculation task and syncs results to MongoDB user_overview.birth_chart
 *
 * Requirements for chart calculation:
 * - Date of birth (YYYY-MM-DD)
 * - Birth time (HH:MM)
 * - Birth location (City, Country)
 * - Timezone (optional but recommended)
 *
 * Request body:
 * {
 *   user_id?: string;          // Optional, defaults to authenticated user
 *   force_recalculate?: boolean; // Force recalculation even if chart exists
 *   chart_system?: "vedic" | "western" | "both"; // Default: vedic
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
		const forceRecalculate = body.force_recalculate ?? false;

		// Get user from MongoDB
		const users = getUsers();
		const user = await users.findOne({ id: userId });

		if (!user) {
			chartLogger.error("User not found", { userId });
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		if (!user.julep_user_id) {
			chartLogger.error("User missing Julep ID", { userId });
			return NextResponse.json(
				{ error: "User not linked to Julep" },
				{ status: 500 },
			);
		}

		// ANCHOR:birth-data-validation
		// Check if user has complete birth data required for chart calculation
		const hasBirthDate = !!user.date_of_birth;
		const hasBirthTime = !!user.birth_time;
		const hasBirthLocation = !!user.birth_location;

		if (!hasBirthDate || !hasBirthTime || !hasBirthLocation) {
			const missingFields = [];
			if (!hasBirthDate) missingFields.push("date_of_birth");
			if (!hasBirthTime) missingFields.push("birth_time");
			if (!hasBirthLocation) missingFields.push("birth_location");

			chartLogger.warn("Incomplete birth data for chart calculation", {
				userId,
				missingFields,
			});

			return NextResponse.json(
				{
					success: false,
					error: "Incomplete birth data",
					message: `Cannot calculate chart. Missing: ${missingFields.join(", ")}`,
					missing_fields: missingFields,
				},
				{ status: 400 },
			);
		}

		// Check if chart already exists (unless force_recalculate)
		if (!forceRecalculate && user.user_overview?.birth_chart) {
			chartLogger.info("Chart already exists", { userId });
			return NextResponse.json({
				success: true,
				message:
					"Chart already exists. Use force_recalculate=true to regenerate.",
				chart: user.user_overview.birth_chart,
				skipped: true,
			});
		}

		// Format birth data for task
		const birthDate = user.date_of_birth.toISOString().split("T")[0]; // YYYY-MM-DD
		const birthTime = user.birth_time; // Already in HH:MM format
		const birthLocation = user.birth_location;
		const birthTimezone = user.birth_timezone || null;

		chartLogger.info("Starting chart calculation (both Vedic and Western)", {
			userId,
			julepUserId: user.julep_user_id,
			birthDate,
			birthTime,
			birthLocation,
		});

		// ANCHOR:chart-task-execution
		// Load and execute chart calculator task
		const taskDef = loadTaskDefinition("CHART_CALCULATOR");
		const agentId = getBackgroundWorkerAgentId();

		const result = await julepClient.createAndExecuteTask(
			agentId,
			taskDef,
			{
				birth_date: birthDate,
				birth_time: birthTime,
				birth_location: birthLocation,
				birth_timezone: birthTimezone,
				ayanamsha: "lahiri", // Default ayanamsha for Vedic
			},
			{
				maxAttempts: 60,
				intervalMs: 2000,
				onProgress: (status, attempt) => {
					chartLogger.debug("Chart task execution progress", {
						userId,
						status,
						attempt,
					});
				},
			},
		);

		if (result.status !== "succeeded") {
			chartLogger.error("Chart calculation task failed", {
				userId,
				error: result.error,
			});

			return NextResponse.json(
				{
					success: false,
					error: result.error || "Chart calculation failed",
					task_id: result.task_id,
					execution_id: result.id,
				},
				{ status: 500 },
			);
		}

		// ANCHOR:chart-mongodb-sync
		// Extract chart data from task output and sync to MongoDB
		const taskOutput = result.output as {
			success?: boolean;
			vedic_chart?: Record<string, unknown>;
			western_chart?: Record<string, unknown>;
			calculated_at?: string;
		};

		// Build birth_chart object for user_overview (contains both Vedic and Western)
		const birthChart = {
			system: "both" as const, // Always generate both systems
			vedic: taskOutput.vedic_chart || null,
			western: taskOutput.western_chart || null,
			calculated_at: new Date(taskOutput.calculated_at || new Date()),
		};

		// Update MongoDB user_overview.birth_chart
		await users.updateOne(
			{ id: userId },
			{
				$set: {
					"user_overview.birth_chart": birthChart,
					"user_overview.last_updated": new Date(),
					"user_overview.updated_by": result.id,
				},
			},
		);

		chartLogger.info("Chart synced to MongoDB", {
			userId,
			chartSystem: birthChart.system,
			hasVedic: !!birthChart.vedic,
			hasWestern: !!birthChart.western,
		});

		return NextResponse.json({
			success: true,
			task_id: result.task_id,
			execution_id: result.id,
			message: "Both Vedic and Western charts calculated successfully",
			chart: birthChart,
		});
	} catch (error) {
		chartLogger.error("Failed to calculate chart", error as Error);

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
 * GET /api/tasks/chart?user_id=xxx
 *
 * Get existing chart from MongoDB
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

		const birthChart = user.user_overview?.birth_chart || null;

		return NextResponse.json({
			success: true,
			chart: birthChart,
			has_chart: !!birthChart,
		});
	} catch (error) {
		chartLogger.error("Failed to get chart", error as Error);

		return NextResponse.json(
			{
				error: "Internal server error",
				message: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
