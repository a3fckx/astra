import { getUsers, getElevenLabsConversations } from "@/lib/mongo";

const users = getUsers();
const conversations = getElevenLabsConversations();

const user = await users.findOne({ email: "attrishubhamwork@gmail.com" });

if (!user) {
	console.error("User not found");
	process.exit(1);
}

console.log("===========================================");
console.log("  FIRST MESSAGE UPDATE HISTORY");
console.log("===========================================\n");

const overview = user.user_overview;

console.log("✅ CURRENT first_message in MongoDB:");
console.log(overview?.first_message || "(not set)");
console.log("\n===========================================");

// Get recent conversations
const recentConvos = await conversations
	.find({ user_id: user.id, status: "completed" })
	.sort({ ended_at: -1 })
	.limit(5)
	.toArray();

console.log("\n📊 RECENT CONVERSATIONS:\n");
recentConvos.forEach((conv, idx) => {
	console.log(`${idx + 1}. ${conv.ended_at?.toISOString() || "unknown"}`);
	console.log(`   ID: ${conv.conversation_id}`);
	console.log(`   Processed: ${conv.metadata?.transcript_processed || false}`);
	console.log(`   Duration: ${conv.metadata?.duration_seconds || 0}s\n`);
});

console.log("===========================================");
console.log("\n💡 HOW IT WORKS:");
console.log("1. After each conversation ends, transcript processor analyzes it");
console.log("2. Task generates personalized first_message based on conversation");
console.log("3. Gets stored in user_overview.first_message");
console.log("4. Next session uses it as greeting (PRIORITY 1)");
console.log("5. Falls back to streak-based greeting if no stored message");
console.log("\n===========================================");

process.exit(0);
