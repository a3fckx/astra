import { auth } from "@/lib/auth";
import { getUsers } from "@/lib/mongo";
import { getResponderPromptTemplate } from "@/lib/prompt-loader";

async function testSessionData() {
	console.log("\n🔍 Testing Session Data for ElevenLabs\n");
	
	// Get user
	const users = getUsers();
	const user = await users.findOne({ id: "68ea36edd789ed3a1e501236" });
	
	if (!user) {
		console.error("❌ User not found");
		return;
	}
	
	console.log("👤 User:", user.name);
	console.log("📧 Email:", user.email);
	
	// Check birth data flags
	console.log("\n🎂 Birth Data Flags:");
	console.log("  has_birth_date:", !!user.date_of_birth);
	console.log("  has_birth_time:", !!user.birth_time);
	console.log("  has_birth_place:", !!user.birth_location);
	
	// Check user_overview
	console.log("\n📊 User Overview:");
	console.log("  profile_summary:", user.user_overview?.profile_summary?.substring(0, 100) + "...");
	console.log("  first_message:", user.user_overview?.first_message);
	console.log("  incident_map:", user.user_overview?.incident_map?.length, "incidents");
	console.log("  preferences.hinglish_level:", user.user_overview?.preferences?.hinglish_level);
	console.log("  preferences.communication_style:", user.user_overview?.preferences?.communication_style);
	
	// Load prompt
	const prompt = await getResponderPromptTemplate();
	
	console.log("\n📝 Prompt Info:");
	console.log("  Length:", prompt?.length, "chars");
	console.log("  Contains 'Birth Data Collection':", prompt?.includes("Birth Data Collection"));
	console.log("  Contains 'NEVER ask for birth date':", prompt?.includes("NEVER ask for birth date"));
	console.log("  Contains 'numbered list':", prompt?.includes("numbered list"));
	
	// Check for problematic patterns
	console.log("\n🔍 Checking for problematic prompt patterns:");
	const numbered = prompt?.match(/1\.\s+Your birth date/i);
	if (numbered) {
		console.log("  ⚠️  Found numbered list asking for birth date:", numbered[0]);
	} else {
		console.log("  ✅ No numbered list asking for birth date");
	}
	
	// Show dynamic variables that would be sent
	const dynamicVars = {
		user_name: user.name,
		has_birth_date: !!user.date_of_birth,
		has_birth_time: !!user.birth_time,
		has_birth_place: !!user.birth_location,
		user_overview: JSON.stringify(user.user_overview),
	};
	
	console.log("\n📤 Dynamic Variables Being Sent:");
	console.log(JSON.stringify(dynamicVars, null, 2).substring(0, 500) + "...");
	
	process.exit(0);
}

testSessionData().catch(console.error);
