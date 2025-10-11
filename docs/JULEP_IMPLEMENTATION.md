# Julep Multi-Agent Implementation Guide

This document provides step-by-step instructions for setting up and using the Julep-powered multi-agent system in Astra.

---

## 🎯 Overview

Astra now uses **Julep** for AI agent orchestration with:
- **MongoDB Atlas**: Primary user database
- **Julep**: Agent memory, document storage (RAG), and task orchestration
- **Bun WebSockets**: Real-time streaming for voice/text
- **ElevenLabs**: Text-to-speech synthesis

---

## 📋 Prerequisites

1. **Julep Account**: Sign up at [dashboard.julep.ai](https://dashboard.julep.ai)
2. **MongoDB Atlas**: Already configured
3. **ElevenLabs API Key**: Get from [elevenlabs.io](https://elevenlabs.io)
4. **Bun Runtime**: Already using Bun

---

## 🔧 Setup Instructions

### Step 1: Configure Environment Variables

Create `.env` file in `app/` directory:

```bash
# Existing MongoDB + Auth (keep as-is)
MONGODB_URI=mongodb+srv://...
BETTER_AUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google

# NEW: Julep Configuration
JULEP_API_KEY=julep_xxxxxxxxxxxxx  # Get from dashboard.julep.ai
JULEP_PROJECT=astra                 # Must be "astra"
JULEP_ENVIRONMENT=production        # or "development"

# NEW: ElevenLabs TTS
ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxx
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Default voice (Rachel)
```

### Step 2: Create Julep Project

Via Julep Dashboard:
1. Go to https://dashboard.julep.ai
2. Click "Create Project"
3. Name it **exactly** `astra`
4. Note the project ID

Or via API:
```typescript
import { Julep } from "@julep/sdk";

const client = new Julep({ apiKey: process.env.JULEP_API_KEY });
const project = await client.projects.create({ name: "astra" });
console.log("Project created:", project.id);
```

### Step 3: Create Astra Agent

In Julep Dashboard:
1. Navigate to project `astra`
2. Click "Agents" → "Create Agent"
3. Configure:
   - **Name**: Astra
   - **Model**: `openrouter/anthropic/claude-sonnet-4.5`
   - **Instructions**: (Paste from `agents/responder/prompt.md`)
   - **About**: "Astra is your mystical astrology companion..."

4. Copy the agent ID and add to `.env`:
```bash
ASTRA_AGENT_ID=agent_xxxxxxxxxxxxx
BACKGROUND_AGENT_ID=agent_xxxxxxxxxxxxx
```

Or via SDK:
```typescript
const agent = await client.agents.create({
  name: "Astra",
  model: "openrouter/anthropic/claude-sonnet-4.5",
  about: "A mystical astrology companion",
  instructions: [
    "You are Astra, a wise and friendly astrology guide",
    "Always be warm, insightful, and personalized in your responses",
    // ... more instructions
  ]
});
```

### Step 4: Install Dependencies

Already done if you followed Phase 1, but to verify:

```bash
cd app
bun install  # Installs @julep/sdk and @elevenlabs/elevenlabs-js
```

### Step 5: Test User Sync

Start the dev server and sign in:

```bash
cd app
bun run dev
```

1. Navigate to `http://localhost:3000`
2. Sign in with Google
3. Check console logs for:
   ```
   Syncing new user to Julep: user@example.com
   Successfully synced user user@example.com with Julep ID: user_xxxxx
   ```

4. Verify in MongoDB:
   ```bash
   # Connect to MongoDB
   mongosh "mongodb+srv://..."
   
   use astra
   db.user.findOne({ email: "user@example.com" })
   # Should see: julep_user_id, julep_project: "astra"
   ```

5. Verify in Julep Dashboard:
   - Go to project `astra` → Users
   - Should see the new user listed

---

## 🚀 Using the System

### Real-Time Chat with Jadugar

The Bun WebSocket implementation is ready at `/api/responder/socket-bun`.

**To switch from old `ws` implementation to Bun:**

1. Open `app/src/pages/api/responder/socket.ts`
2. Replace entire contents with:
   ```typescript
   export { default } from "./socket-bun";
   export { config } from "./socket-bun";
   ```

**Test WebSocket Connection:**

```javascript
// In browser console
const ws = new WebSocket("ws://localhost:3000/api/responder/socket");

ws.onopen = () => {
  console.log("Connected!");
  ws.send(JSON.stringify({ type: "chat", text: "Hello Jadugar!" }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Received:", data);
  
  if (data.type === "audio:chunk") {
    // Decode base64 audio and play
    const audioData = atob(data.data);
    // ... audio playback logic
  }
};
```

**Message Types:**

- **From Client**:
  - `{ type: "chat", text: "user message" }`
  - `{ type: "heartbeat" }`

- **To Client**:
  - `{ type: "connected", data: { userId, sessionId } }`
  - `{ type: "message:user", data: { role, content, timestamp } }`
  - `{ type: "message:assistant", data: { role, content, timestamp } }`
  - `{ type: "audio:chunk", data: "base64_audio" }`
  - `{ type: "audio:end" }`
  - `{ type: "error", error: { message, code } }`

---

## 📝 Document Management

### How Documents Work

Each user has documents in Julep that serve as long-term memory:

**Document Types**:
- `profile`: Birth data, personal info
- `preferences`: Communication style, interests
- `horoscope`: Daily astrological readings
- `notes`: Conversation summaries
- `analysis`: Insights from background agents

**Metadata Schema**:
```typescript
{
  type: "profile" | "preferences" | "horoscope" | "notes" | "analysis",
  scope: "frontline" | "background",  // Controls recall
  shared: true,                        // Allows cross-agent access
  updated_by: "agent_id|task_id",
  timestamp_iso: "2025-01-15T10:30:00Z",
  source?: "session_id|task_execution_id"
}
```

### Manually Creating Documents

```typescript
import { julepClient } from "@/lib/julep";

await julepClient.users.docs.create({
  userId: "user_xxxxx",
  title: "User Birth Chart",
  content: [
    "Sun in Leo, Moon in Pisces, Rising in Gemini",
    "Venus in Cancer, Mars in Aries"
  ],
  metadata: {
    type: "profile",
    scope: "frontline",
    shared: true,
    updated_by: "admin",
    timestamp_iso: new Date().toISOString()
  }
});
```

### Searching Documents

```typescript
import { searchUserDocs } from "@/lib/julep-docs";

const results = await searchUserDocs(
  "user_xxxxx",
  "birth chart planets",
  { type: "profile", scope: "frontline" }
);

console.log("Found docs:", results.docs);
```

---

## 🤖 Background Tasks

### Registering Tasks

Tasks are defined in `agents/tasks/*.yaml`. To register them:

```typescript
import { julepClient } from "@/lib/julep";
import * as yaml from "yaml";
import * as fs from "fs";

// 1. Create a background agent (one-time)
const bgAgent = await julepClient.agents.create({
  name: "Astra Background Worker",
  model: "gpt-4o-mini",
  about: "Handles background data processing and enrichment"
});

process.env.BACKGROUND_AGENT_ID = bgAgent.id;

// 2. Register horoscope task
const horoscopeTaskDef = yaml.parse(
  fs.readFileSync("agents/tasks/horoscope-refresher.yaml", "utf-8")
);

const horoscopeTask = await julepClient.tasks.create({
  agentId: bgAgent.id,
  ...horoscopeTaskDef
});

console.log("Horoscope task ID:", horoscopeTask.id);
// Add to .env: HOROSCOPE_TASK_ID=task_xxxxx
```

### Running Tasks

**One-time execution**:
```typescript
import { julepClient } from "@/lib/julep";

const execution = await julepClient.executions.create({
  taskId: process.env.HOROSCOPE_TASK_ID,
  input: {
    julep_user_id: "user_xxxxx"
  }
});

// Monitor execution
const status = await julepClient.executions.get(execution.id);
console.log("Status:", status.status); // queued, running, succeeded, failed
```

**Scheduled execution** (daily horoscopes):
```typescript
// app/src/lib/scheduled-tasks.ts
import { getUsers } from "@/lib/mongo";
import { julepClient } from "@/lib/julep";

export async function runDailyHoroscopes() {
  const users = await getUsers().find({
    julep_user_id: { $exists: true },
    date_of_birth: { $exists: true }
  }).toArray();

  console.log(`Running horoscopes for ${users.length} users`);

  for (const user of users) {
    try {
      await julepClient.executions.create({
        taskId: process.env.HOROSCOPE_TASK_ID,
        input: { julep_user_id: user.julep_user_id }
      });
    } catch (error) {
      console.error(`Failed for ${user.email}:`, error);
    }
  }
}

// Call from cron job, Vercel Cron, or AWS EventBridge
```

---

## 🔍 Debugging & Monitoring

### Check User Sync Status

```typescript
import { getUsers } from "@/lib/mongo";

const usersWithoutJulep = await getUsers().find({
  julep_user_id: { $exists: false }
}).toArray();

console.log(`${usersWithoutJulep.length} users not synced to Julep`);
```

### View Session History

In Julep Dashboard:
1. Go to project `astra` → Sessions
2. Find session by user or agent
3. View full conversation history with recalled docs

### Monitor Task Executions

```typescript
const executions = await julepClient.executions.list({
  taskId: process.env.HOROSCOPE_TASK_ID,
  limit: 50
});

const failed = executions.items.filter(e => e.status === "failed");
console.log(`Failed executions: ${failed.length}`);
failed.forEach(e => console.error(e.error));
```

---

## 🎨 Frontend Integration

### Audio Playback (Example)

```typescript
// app/src/components/voice-player.tsx
"use client";

import { useEffect, useRef } from "react";

export function VoicePlayer() {
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef<AudioBuffer[]>([]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3000/api/responder/socket");
    wsRef.current = ws;

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "audio:chunk") {
        // Decode base64 audio
        const binaryString = atob(data.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Create audio context if needed
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }

        // Decode and queue audio
        const audioBuffer = await audioContextRef.current.decodeAudioData(
          bytes.buffer
        );
        audioBuffersRef.current.push(audioBuffer);
      }

      if (data.type === "audio:end") {
        // Play all queued audio
        playAudioSequence();
      }
    };

    return () => ws.close();
  }, []);

  const playAudioSequence = () => {
    // Implementation details for sequential audio playback
  };

  return <div>Audio player UI...</div>;
}
```

---

## 🚨 Troubleshooting

### Issue: User not syncing to Julep

**Check**:
1. `JULEP_API_KEY` is set correctly
2. Better Auth hook is running (check console logs)
3. MongoDB user has `julep_user_id` field

**Fix**:
```typescript
// Manually sync existing users
import { getUsers } from "@/lib/mongo";
import { createJulepUser, seedUserDocs } from "@/lib/julep-docs";

const users = await getUsers().find({ julep_user_id: { $exists: false } }).toArray();

for (const user of users) {
  const julepUser = await createJulepUser({
    name: user.name,
    email: user.email
  });

  await getUsers().updateOne(
    { _id: user._id },
    { $set: { julep_user_id: julepUser.id, julep_project: "astra" } }
  );

  await seedUserDocs(julepUser.id, user);
}
```

### Issue: WebSocket not connecting

**Check**:
1. Dev server is running: `bun run dev`
2. Auth session is valid (sign in first)
3. Browser console for errors

**Test manually**:
```javascript
// In browser console after signing in
const ws = new WebSocket("ws://localhost:3000/api/responder/socket");
ws.onopen = () => console.log("Connected!");
ws.onerror = (error) => console.error("WS Error:", error);
```

### Issue: Tasks failing

**Check Julep Dashboard**:
1. Go to Executions tab
2. Find failed execution
3. View error details

**Common issues**:
- Missing documents (user has no profile)
- API rate limits
- Invalid metadata format

---

## 📚 Additional Resources

- [Julep Documentation](https://docs.julep.ai)
- [Julep SDK (TypeScript)](https://github.com/julep-ai/node-sdk)
- [ElevenLabs Docs](https://elevenlabs.io/docs)
- [Bun WebSocket Guide](https://bun.sh/docs/api/websockets)

---

## 🎯 Next Steps

1. **Create Jadugar agent** with proper instructions
2. **Test user signup flow** to verify Julep sync
3. **Test WebSocket chat** with text responses
4. **Enable audio** by verifying ElevenLabs integration
5. **Register background tasks** for horoscopes
6. **Set up cron jobs** for scheduled task execution
7. **Build frontend UI** for voice/text interactions

---

**Questions or Issues?**  
Check existing sessions in `app/.sessions/` or create a new one with `./session.sh start`.
