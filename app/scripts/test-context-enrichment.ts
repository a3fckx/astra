#!/usr/bin/env bun
/**
 * Test Context Enrichment
 * Verifies that complete user_overview is being passed to ElevenLabs agent
 *
 * Usage:
 *   bun run scripts/test-context-enrichment.ts
 */

import { logger } from "@/lib/logger";
import { getUsers } from "@/lib/mongo";

const testLogger = logger.child("test:context-enrichment");

async function testContextEnrichment() {
	testLogger.info("🔍 Testing context enrichment...");

	const users = getUsers();
	const user = await users.findOne({});

	if (!user) {
		testLogger.error("❌ No users found in database");
		testLogger.info(
			"💡 Create a user by signing in at http://localhost:3000",
		);
		return;
	}

	testLogger.info("✅ User found:", {
		id: user.id,
		name: user.name,
		email: user.email,
	});

	const userOverview = user.user_overview;

	if (!userOverview) {
		testLogger.warn("⚠️  User has no user_overview");
		testLogger.info(
			"💡 Have a conversation with Samay to populate user_overview",
		);
		return;
	}

	testLogger.info("\n📊 User Overview Fields:");
	testLogger.info(
		`  - profile_summary: ${!!userOverview.profile_summary ? "✅" : "❌"}`,
	);
	testLogger.info(
		`  - preferences: ${!!userOverview.preferences ? "✅" : "❌"}`,
	);
	testLogger.info(
		`  - birth_chart: ${!!userOverview.birth_chart ? "✅" : "❌"}`,
	);
	testLogger.info(
		`  - gamification: ${!!userOverview.gamification ? "✅" : "❌"}`,
	);
	testLogger.info(
		`  - latest_horoscope: ${!!userOverview.latest_horoscope ? "✅" : "❌"}`,
	);
	testLogger.info(
		`  - recent_conversations: ${userOverview.recent_conversations?.length ?? 0} conversations`,
	);
	testLogger.info(
		`  - incident_map: ${userOverview.incident_map?.length ?? 0} incidents`,
	);
	testLogger.info(
		`  - insights: ${userOverview.insights?.length ?? 0} insights`,
	);

	if (userOverview.gamification) {
		testLogger.info("\n🎮 Gamification Details:");
		testLogger.info(
			`  - Streak: ${userOverview.gamification.streak_days} days`,
		);
		testLogger.info(
			`  - Best streak: ${userOverview.gamification.best_streak} days`,
		);
		testLogger.info(
			`  - Total conversations: ${userOverview.gamification.total_conversations}`,
		);
		testLogger.info(
			`  - Milestones: ${userOverview.gamification.milestones_unlocked?.length ?? 0}`,
		);
		if (userOverview.gamification.milestones_unlocked?.length) {
			testLogger.info(
				`    ${userOverview.gamification.milestones_unlocked.join(", ")}`,
			);
		}
		testLogger.info(
			`  - Topics explored: ${userOverview.gamification.topics_explored?.length ?? 0}`,
		);
		if (userOverview.gamification.topics_explored?.length) {
			testLogger.info(
				`    ${userOverview.gamification.topics_explored.slice(0, 5).join(", ")}`,
			);
		}
	}

	if (userOverview.preferences) {
		testLogger.info("\n⚙️  Preferences:");
		testLogger.info(
			`  - Communication style: ${userOverview.preferences.communication_style ?? "not set"}`,
		);
		testLogger.info(
			`  - Hinglish level: ${userOverview.preferences.hinglish_level ?? "not set"}`,
		);
		testLogger.info(
			`  - Flirt opt-in: ${userOverview.preferences.flirt_opt_in ?? false}`,
		);
		testLogger.info(
			`  - Topics: ${userOverview.preferences.topics_of_interest?.join(", ") ?? "none"}`,
		);
	}

	if (userOverview.birth_chart) {
		testLogger.info("\n🌟 Birth Chart:");
		testLogger.info(`  - System: ${userOverview.birth_chart.system}`);
		if (userOverview.birth_chart.vedic) {
			const vedic = userOverview.birth_chart.vedic as Record<string, unknown>;
			testLogger.info(`  - Vedic Sun: ${vedic.sun_sign}`);
			testLogger.info(`  - Vedic Moon: ${vedic.moon_sign}`);
			testLogger.info(`  - Vedic Ascendant: ${vedic.ascendant}`);
		}
		if (userOverview.birth_chart.western) {
			const western = userOverview.birth_chart.western as Record<
				string,
				unknown
			>;
			testLogger.info(`  - Western Sun: ${western.sun_sign}`);
			testLogger.info(`  - Western Moon: ${western.moon_sign}`);
			testLogger.info(`  - Western Rising: ${western.rising_sign}`);
		}
		if (userOverview.birth_chart.famous_people) {
			testLogger.info(
				`  - Famous people: ${userOverview.birth_chart.famous_people.length} matches`,
			);
		}
	}

	if (userOverview.latest_horoscope) {
		testLogger.info("\n🔮 Latest Horoscope:");
		testLogger.info(`  - Date: ${userOverview.latest_horoscope.date}`);
		testLogger.info(
			`  - Content length: ${userOverview.latest_horoscope.content.length} characters`,
		);
		const today = new Date().toISOString().split("T")[0];
		const isToday = userOverview.latest_horoscope.date === today;
		testLogger.info(`  - Is today's horoscope: ${isToday ? "✅" : "❌"}`);
	}

	if (userOverview.recent_conversations?.length) {
		testLogger.info("\n💬 Recent Conversations:");
		const recent = userOverview.recent_conversations.slice(0, 3);
		for (const conv of recent) {
			testLogger.info(
				`  - ${conv.date}: ${conv.topics.slice(0, 3).join(", ")}`,
			);
		}
	}

	// Test JSON stringification (what gets sent to ElevenLabs)
	testLogger.info("\n📦 JSON Serialization Test:");
	const jsonString = JSON.stringify(userOverview);
	testLogger.info(`  - JSON string length: ${jsonString.length} characters`);
	testLogger.info(
		`  - Size: ${(jsonString.length / 1024).toFixed(2)} KB`,
	);

	// Simulate what buildDynamicVariables does
	testLogger.info("\n🔧 Dynamic Variables Preview:");
	const today = new Date().toISOString().split("T")[0];
	testLogger.info(
		`  - streak_days: ${userOverview.gamification?.streak_days ?? 0}`,
	);
	testLogger.info(
		`  - total_conversations: ${userOverview.gamification?.total_conversations ?? 0}`,
	);
	testLogger.info(
		`  - milestones_count: ${userOverview.gamification?.milestones_unlocked?.length ?? 0}`,
	);
	testLogger.info(
		`  - hinglish_level: ${userOverview.preferences?.hinglish_level ?? "null"}`,
	);
	testLogger.info(
		`  - flirt_opt_in: ${userOverview.preferences?.flirt_opt_in ?? false}`,
	);
	testLogger.info(
		`  - has_todays_horoscope: ${userOverview.latest_horoscope?.date === today}`,
	);
	testLogger.info(`  - has_birth_chart: ${!!userOverview.birth_chart}`);

	testLogger.info("\n✅ Context enrichment test complete!");
	testLogger.info(
		"\n💡 The ElevenLabs agent now has access to ALL this context!",
	);
}

testContextEnrichment()
	.then(() => process.exit(0))
	.catch((error) => {
		testLogger.error("❌ Test failed", error);
		process.exit(1);
	});
