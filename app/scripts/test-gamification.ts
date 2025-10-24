import { getUsers } from "@/lib/mongo";

const users = getUsers();
const user = await users.findOne({ email: "attrishubhamwork@gmail.com" });

if (!user) {
	console.error("User not found");
	process.exit(1);
}

console.log("Testing gamification update...");
console.log("User ID:", user.id);

const response = await fetch("http://localhost:3000/api/tasks/gamification", {
	method: "POST",
	headers: {
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		user_id: user.id,
		event_type: "test_trigger",
	}),
});

const result = await response.json();

console.log("\nResponse Status:", response.status);
console.log("\nResponse Body:");
console.log(JSON.stringify(result, null, 2));

if (response.status === 200 && result.success) {
	console.log("\n✅ Gamification update successful!");
	console.log("\nUpdated Metrics:");
	console.log("- Streak Days:", result.gamification.streak_days);
	console.log("- Total Conversations:", result.gamification.total_conversations);
	console.log("- Milestones Unlocked:", result.gamification.milestones_unlocked.length);
	
	if (result.new_milestones.length > 0) {
		console.log("\n🎊 New Milestones:");
		result.new_milestones.forEach((m: string) => console.log(`  ${m}`));
	}
} else {
	console.error("\n❌ Gamification update failed!");
}

process.exit(0);
