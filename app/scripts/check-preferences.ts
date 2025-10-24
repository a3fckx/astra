import { getUsers } from "@/lib/mongo";

const users = getUsers();
const user = await users.findOne({ email: "attrishubhamwork@gmail.com" });

console.log("\n===========================================");
console.log("       PREFERENCES DATA IN MONGODB");
console.log("===========================================\n");

const prefs = user?.user_overview?.preferences;

console.log("Raw preferences object:");
console.log(JSON.stringify(prefs, null, 2));

console.log("\n===========================================");
console.log("\nIndividual fields:");
console.log("- communication_style:", prefs?.communication_style ?? "(null)");
console.log("- hinglish_level:", prefs?.hinglish_level ?? "(null)");
console.log("- astrology_system:", prefs?.astrology_system ?? "(null)");
console.log("- flirt_opt_in:", prefs?.flirt_opt_in ?? "(null)");
console.log("- topics_of_interest:", prefs?.topics_of_interest?.length ?? 0, "topics");
console.log("\n===========================================");

process.exit(0);
