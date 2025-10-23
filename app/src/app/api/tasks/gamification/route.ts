import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getElevenLabsConversations, getUsers } from "@/lib/mongo";

const gamificationLogger = logger.child("api:tasks:gamification");

/**
 * POST /api/tasks/gamification
 *
 * ANCHOR:gamification-task-trigger
 *
 * Triggers gamification metrics update and syncs results to MongoDB user_overview.gamification
 *
 * This task tracks:
 * - Conversation streaks (consecutive days with conversations)
 * - Total conversation count
 * - Milestones unlocked (first conversation, 3-day streak, 10 conversations, etc.)
 * - Topics explored
 * - Chart completion percentage
 *
 * Request body:
 * {
 *   user_id?: string;              // Optional, defaults to authenticated user
 *   conversation_id?: string;      // Optional, latest conversation that triggered update
 *   event_type?: string;           // Type of event: "conversation_completed", "chart_generated", etc.
 * }
 */
export async function POST(request: Request) {
	try {
		// ANCHOR:flexible-auth-for-internal-calls
		// Allow internal service calls with user_id in body (from transcript processor)
		// OR authenticated user requests without user_id
		const session = await auth.api.getSession({ headers: request.headers });
		const body = await request.json();
		const userId = body.user_id || session?.user?.id;

		if (!userId) {
			return NextResponse.json(
				{ error: "Missing user_id or authentication" },
				{ status: 401 },
			);
		}

		const conversationId = body.conversation_id || null;
		const eventType = body.event_type || "conversation_completed";

		// Get user from MongoDB
		const users = getUsers();
		const user = await users.findOne({ id: userId });

		if (!user) {
			gamificationLogger.error("User not found", { userId });
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		if (!user.julep_user_id) {
			gamificationLogger.error("User missing Julep ID", { userId });
			return NextResponse.json(
				{ error: "User not linked to Julep" },
				{ status: 500 },
			);
		}

		gamificationLogger.info("Starting gamification update", {
			userId,
			julepUserId: user.julep_user_id,
			conversationId,
			eventType,
		});

		// ANCHOR:gamification-calculation-logic
		// Calculate gamification metrics directly from MongoDB data
		// This approach is simpler and more reliable than using Julep User Docs
		const conversations = getElevenLabsConversations();

		// Get all completed conversations for this user
		const allConversations = await conversations
			.find({
				user_id: userId,
				status: "completed",
			})
			.sort({ ended_at: -1 })
			.toArray();

		const totalConversations = allConversations.length;

		// Calculate streak (consecutive days with conversations)
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const conversationDates = allConversations
			.map((conv) => {
				if (!conv.ended_at) return null;
				const date = new Date(conv.ended_at);
				date.setHours(0, 0, 0, 0);
				return date.getTime();
			})
			.filter((timestamp): timestamp is number => timestamp !== null);

		const uniqueDates = [...new Set(conversationDates)].sort((a, b) => b - a);

		// Calculate current streak
		let currentStreak = 0;
		let checkDate = today.getTime();

		for (const date of uniqueDates) {
			const daysDiff = Math.floor((checkDate - date) / (1000 * 60 * 60 * 24));

			if (daysDiff === 0 || daysDiff === 1) {
				currentStreak++;
				checkDate = date;
			} else {
				break;
			}
		}

		// Get previous gamification data
		const previousGamification = user.user_overview?.gamification || {};
		const _previousStreak = previousGamification.streak_days || 0;
		const bestStreak = Math.max(
			previousGamification.best_streak || 0,
			currentStreak,
		);

		// Extract topics from recent conversations
		const allTopics = new Set<string>();
		const recentConversations = user.user_overview?.recent_conversations || [];

		for (const conv of recentConversations) {
			if (conv.topics) {
				for (const topic of conv.topics) {
					allTopics.add(topic);
				}
			}
		}

		const topicsExplored = Array.from(allTopics);

		// Calculate chart completion percentage
		const hasBirthDate = !!user.date_of_birth;
		const hasBirthTime = !!user.birth_time;
		const hasBirthLocation = !!user.birth_location;
		const hasTimezone = !!user.birth_timezone;
		const chartCompletionFields = [
			hasBirthDate,
			hasBirthTime,
			hasBirthLocation,
			hasTimezone,
		].filter(Boolean).length;
		const chartCompletionPercent = Math.floor(
			(chartCompletionFields / 4) * 100,
		);

		// ANCHOR:milestone-detection
		// Determine which milestones have been unlocked
		const previousMilestones =
			previousGamification.milestones_unlocked || ([] as string[]);
		const allMilestones = [...previousMilestones];
		const newMilestones: string[] = [];

		const milestoneChecks = {
			first_conversation:
				totalConversations >= 1 &&
				!previousMilestones.includes("first_conversation"),
			streak_3: currentStreak >= 3 && !previousMilestones.includes("streak_3"),
			streak_7: currentStreak >= 7 && !previousMilestones.includes("streak_7"),
			conversations_10:
				totalConversations >= 10 &&
				!previousMilestones.includes("conversations_10"),
			conversations_25:
				totalConversations >= 25 &&
				!previousMilestones.includes("conversations_25"),
			conversations_50:
				totalConversations >= 50 &&
				!previousMilestones.includes("conversations_50"),
			conversations_100:
				totalConversations >= 100 &&
				!previousMilestones.includes("conversations_100"),
			full_chart:
				chartCompletionPercent >= 100 &&
				!previousMilestones.includes("full_chart"),
			topic_explorer:
				topicsExplored.length >= 5 &&
				!previousMilestones.includes("topic_explorer"),
		};

		if (milestoneChecks.first_conversation) {
			allMilestones.push("first_conversation");
			newMilestones.push("🎯 First Conversation");
		}
		if (milestoneChecks.streak_3) {
			allMilestones.push("streak_3");
			newMilestones.push("🔥 3-Day Streak");
		}
		if (milestoneChecks.streak_7) {
			allMilestones.push("streak_7");
			newMilestones.push("🔥 7-Day Streak");
		}
		if (milestoneChecks.conversations_10) {
			allMilestones.push("conversations_10");
			newMilestones.push("⭐ 10 Conversations");
		}
		if (milestoneChecks.conversations_25) {
			allMilestones.push("conversations_25");
			newMilestones.push("🌟 25 Conversations");
		}
		if (milestoneChecks.conversations_50) {
			allMilestones.push("conversations_50");
			newMilestones.push("🚀 50 Conversations");
		}
		if (milestoneChecks.conversations_100) {
			allMilestones.push("conversations_100");
			newMilestones.push("🏆 100 Conversations");
		}
		if (milestoneChecks.full_chart) {
			allMilestones.push("full_chart");
			newMilestones.push("📊 Full Chart Completion");
		}
		if (milestoneChecks.topic_explorer) {
			allMilestones.push("topic_explorer");
			newMilestones.push("🗺️ Topic Explorer (5+ topics)");
		}

		// ANCHOR:gamification-mongodb-sync
		// Update MongoDB user_overview.gamification with calculated metrics
		const gamificationData = {
			streak_days: currentStreak,
			best_streak: bestStreak,
			total_conversations: totalConversations,
			milestones_unlocked: allMilestones,
			topics_explored: topicsExplored,
			chart_completion_percent: chartCompletionPercent,
			last_conversation_date: allConversations[0]?.ended_at || new Date(),
			last_updated: new Date(),
		};

		await users.updateOne(
			{ id: userId },
			{
				$set: {
					"user_overview.gamification": gamificationData,
					"user_overview.last_updated": new Date(),
				},
			},
		);

		gamificationLogger.info("Gamification metrics updated", {
			userId,
			currentStreak,
			bestStreak,
			totalConversations,
			milestonesUnlocked: allMilestones.length,
			newMilestones: newMilestones.length,
			topicsExplored: topicsExplored.length,
		});

		// Log milestone celebrations
		if (newMilestones.length > 0) {
			gamificationLogger.info("🎊 New milestones unlocked!", {
				userId,
				milestones: newMilestones,
			});
		}

		return NextResponse.json({
			success: true,
			message: "Gamification metrics updated successfully",
			gamification: gamificationData,
			new_milestones: newMilestones,
			milestone_celebration:
				newMilestones.length > 0
					? `🎊 Congratulations! You unlocked: ${newMilestones.join(", ")}`
					: null,
		});
	} catch (error) {
		gamificationLogger.error("Failed to update gamification metrics", {
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
 * GET /api/tasks/gamification?user_id=xxx
 *
 * Get current gamification metrics from MongoDB
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

		const gamification = user.user_overview?.gamification || null;

		return NextResponse.json({
			success: true,
			gamification,
			has_gamification: !!gamification,
		});
	} catch (error) {
		gamificationLogger.error("Failed to get gamification metrics", {
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
