import { getUsers } from "@/lib/mongo";

const users = getUsers();
const user = await users.findOne({ email: "attrishubhamwork@gmail.com" });

if (!user) {
	console.error("User not found");
	process.exit(1);
}

console.log("===========================================");
console.log("       FIRST MESSAGE CHECK");
console.log("===========================================\n");

const overview = user.user_overview;

if (overview?.first_message) {
	console.log("✅ first_message EXISTS in MongoDB:");
	console.log("\n" + overview.first_message + "\n");
} else {
	console.log("❌ first_message NOT FOUND in MongoDB\n");
	console.log("Available user_overview fields:");
	if (overview) {
		console.log(Object.keys(overview).join(", "));
	} else {
		console.log("(user_overview is empty or null)");
	}
}

console.log("\n===========================================");
console.log("Gamification data:");
console.log("- Streak days:", overview?.gamification?.streak_days ?? "N/A");
console.log("- Total conversations:", overview?.gamification?.total_conversations ?? "N/A");

console.log("\n===========================================");
console.log("Recent conversations count:", overview?.recent_conversations?.length ?? 0);

process.exit(0);
