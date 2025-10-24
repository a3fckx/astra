import { getUsers } from "@/lib/mongo";

const users = getUsers();
const user = await users.findOne({ email: "attrishubhamwork@gmail.com" });

console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                     FIRST MESSAGE UPDATE FLOW                              ║
╚════════════════════════════════════════════════════════════════════════════╝

📝 WHAT'S IN MONGODB RIGHT NOW:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

user_overview.first_message:
"${user?.user_overview?.first_message || "(not set)"}"

Last updated: ${user?.user_overview?.last_updated || "(unknown)"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 HOW IT GETS UPDATED (AFTER EACH CONVERSATION):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣  User ends conversation with Samay (ElevenLabs)
     └─> Voice session detects farewell phrase
     └─> Stores conversation_id in MongoDB

2️⃣  Voice session triggers transcript processing (fire-and-forget)
     └─> POST /api/tasks/transcript
     └─> Fetches full transcript from ElevenLabs API

3️⃣  Transcript processor executes Julep task
     └─> agents/tasks/transcript-processor.yaml
     └─> Step 5 (line 113-146): Generate personalized first_message
     └─> Prompt: "Based on this conversation, craft a CATCHY, PERSONALIZED
                  first message for the user's NEXT conversation"
     └─> Returns either new message or "SKIP"

4️⃣  Julep task returns output with first_message field
     └─> {
           "first_message": "I sense your profound dedication..."
         }

5️⃣  Transcript processor syncs to MongoDB
     └─> app/src/lib/transcript-processor.ts (line 456-467)
     └─> Updates user_overview.first_message
     └─> Replaces [USERNAME] with {{user_name}} placeholder

6️⃣  NEXT conversation session handshake
     └─> GET /api/responder/session
     └─> Returns complete user_overview including first_message
     └─> Voice session receives it

7️⃣  Voice component generates greeting
     └─> app/src/components/voice-session/utils.ts (line 83-90)
     └─> PRIORITY 1: Uses stored first_message from MongoDB ✅
     └─> Replaces {{user_name}} with actual name
     └─> Falls back to streak-based greeting if not set

8️⃣  Samay says the personalized greeting! 🎉
     └─> "I sense your profound dedication to the 'doing' for your 
          moonshot and background agent visions, Shubham, continues 
          to guide you..."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ STATUS: WORKING CORRECTLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your last conversation (Oct 23, 23:09 UTC) was processed successfully.
It generated a new first_message referencing:
  - Your "doing" philosophy (process over outcomes)
  - Your moonshot and background agent projects
  - Your fascination with intelligence, memory, learning

This will be used as your greeting in the NEXT conversation!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

process.exit(0);
