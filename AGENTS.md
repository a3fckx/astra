# AGENTS.md — Astra Coding Agent Directive

> **Note:** This file is the operational brief for AI coding agents. For in-depth technical docs, see the [`docs/`](docs) directory.

---

## ⚠️ CRITICAL ARCHITECTURE

**READ THIS FIRST:** Understand the architecture before coding.

### System Overview

- **ElevenLabs Agents = Frontline:** Handle ALL real-time user conversations (voice/chat)
- **Julep Agents = Background ONLY:** Process transcripts, generate charts, track metrics — NEVER interact with users
- **MongoDB = Source of Truth:** All data stored in MongoDB, especially `user_overview` field
- **Data Flow:** User talks → ElevenLabs (with MongoDB context) → Background processing → Results to MongoDB → Next conversation

**Julep agents NEVER talk to users. They only run background tasks and return JSON that syncs to MongoDB.**

### Key Documents (Priority Order)
- 🔴 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — **START HERE:** Complete system architecture
- 🔴 [`docs/IMPLEMENTATION_CHECKLIST.md`](docs/IMPLEMENTATION_CHECKLIST.md) — **Development progress tracker**
- 📘 [Creating New Tasks](#creating-new-julep-tasks) — **Guide below:** How to add new background tasks
- [`docs/FAQ.md`](docs/FAQ.md) — Common questions answered
- [`docs/PERSONA.md`](docs/PERSONA.md) — Samay persona details
- [`agents/README.md`](agents/README.md) — Agent definitions and task workflows

---

## Quick Reference

- **Project:** Astra — multi-user astrology companion ("Samay" persona)
- **Voice Interface:** ElevenLabs React SDK (`@elevenlabs/react`)
- **Authentication:** Better Auth + Google OAuth + MongoDB Atlas
- **Orchestration:** Julep (user memory, sessions, agent tasks)
- **UI Stack:** Next.js 15 (App Router), React 18, TypeScript, Biome
- **Runtime:** Single Next.js service — no background workers

### Current Layout

```
astra/
├── .archive/               # Old documentation (archived)
├── app/                    # Next.js application
│   ├── src/components/     # Voice UI (ElevenLabs SDK)
│   ├── src/app/api/        # REST APIs (auth, session, task triggers)
│   ├── src/lib/            # Utilities (auth, mongo, julep, elevenlabs)
│   └── scripts/            # Development & debugging scripts
├── agents/                 # Julep agent & task definitions (YAML)
│   ├── definitions/        # Agent definitions (background worker only)
│   └── tasks/              # Task workflows (transcript, chart, etc.)
└── docs/                   # Architecture & implementation docs
```

**Key Files**

- `app/src/components/voice-session/` — Voice UI components using ElevenLabs SDK
- `app/src/app/api/responder/session/route.ts` — Session handshake (returns user_overview from MongoDB)
- `app/src/app/api/tasks/transcript/route.ts` — Triggers transcript processing, syncs to MongoDB
- `app/src/lib/transcript-processor.ts` — Main orchestration for background processing
- `app/src/lib/julep-client.ts` — Julep SDK wrapper (task creation & execution)
- `app/src/lib/tasks/loader.ts` — YAML task definition loader
- `agents/tasks/transcript-processor.yaml` — Main task: extracts insights from conversations
- `agents/tasks/chart-calculator.yaml` — Generates Vedic/Western birth charts

---

## How Julep Integration Works (SDK-Based)

**CRITICAL:** Astra uses the **Julep Node.js SDK** programmatically, NOT Julep CLI or `julep.yaml` deployment.

### Agent Setup (One-Time)

1. **Create Agent via Julep API** (or dashboard):
   ```typescript
   const agent = await julepClient.agents.create({
     name: "Astra Background Worker",
     model: "gemini-2.5-flash",
     project: "astra",
     about: "Background processing agent...",
     instructions: "..."
   });
   // Returns: { id: "agent_abc123" }
   ```

2. **Store Agent ID in Environment:**
   ```bash
   BACKGROUND_WORKER_AGENT_ID=agent_abc123
   ```

3. **Reference Document:** `agents/definitions/astra.yaml`
   - Documents the agent configuration
   - NOT used for deployment (no `julep deploy`)
   - Useful for reference and manual updates

### Task Execution (Runtime - Every Request)

**Tasks are created dynamically from YAML and executed on-demand:**

```typescript
// 1. Load task definition from YAML
const taskDef = loadTaskDefinition('TRANSCRIPT_PROCESSOR');
// Reads: agents/tasks/transcript-processor.yaml

// 2. Create task instance for this execution
const task = await julepClient.createTask(agentId, taskDef);
// Returns: { id: "task_xyz789" }

// 3. Execute with user-specific input
const execution = await julepClient.executeTask(task.id, {
  input: {
    julep_user_id: user.julep_user_id,
    conversation_id: "conv_123",
    transcript_text: "full transcript...",
    existing_overview: user.user_overview
  }
});

// 4. SDK polls every 2s until completion
// Returns: { status: "succeeded", output: {...} }

// 5. Sync result to MongoDB
await users.updateOne(
  { id: userId },
  { $set: { user_overview: execution.output }}
);
```

### What We DON'T Use

- ❌ `julep.yaml` project config (deprecated, removed)
- ❌ `julep deploy` command
- ❌ Julep CLI deployment workflow
- ❌ Pre-created task instances

### What We DO Use

- ✅ Julep Node.js SDK (`@julep/sdk`)
- ✅ Agent ID stored in env vars
- ✅ YAML task definitions loaded at runtime
- ✅ Tasks created dynamically per execution
- ✅ SDK handles polling and completion
- ✅ MongoDB as single source of truth

---

## Voice Flow (Complete Architecture)

1. **Auth** — Better Auth Google provider issues secure session cookie backed by MongoDB.

2. **Session Handshake** — `/api/responder/session` returns:
   - User context from MongoDB (name, email, birth data)
   - **`user_overview`** — ALL background processing results (chart, preferences, conversations, gamification)
   - Integration tokens (elevenlabs)
   - Complete agent prompt from `app/docs/responder.md`

3. **Voice Connection** — ElevenLabs React SDK handles:
   - WebSocket connection to ElevenLabs
   - Audio streaming and transcription
   - Agent responses via TTS (ElevenLabs agent, NOT Julep)
   - Dynamic variables injected: `user_name`, `user_overview`, `birth_chart`, `vedic_sun`, `streak_days`, etc.

4. **ElevenLabs Agent** — Handles conversation:
   - Uses dynamic variables from MongoDB for context
   - Responds with full awareness of user history
   - **Never directly accesses Julep** — only MongoDB data via session handshake

5. **Conversation End** — Background processing (fire-and-forget):
   - Conversation ID stored in MongoDB
   - Trigger: `POST /api/tasks/transcript`
   - Fetch transcript from ElevenLabs API
   - Execute Julep background task (transcript-processor)
   - Task returns JSON → synced to MongoDB `user_overview`
   - Additional tasks triggered: chart calculation (if birth data complete)

6. **Next Conversation** — Agent receives enriched context:
   - Updated `user_overview` from MongoDB
   - Personalized greeting with full memory

---

## Creating New Julep Tasks

### Step-by-Step Guide

Follow this exact pattern from working tasks (`transcript-processor.yaml`, `chart-calculator.yaml`):

#### 1. Create YAML Task Definition

**Location:** `agents/tasks/your-task-name.yaml`

**Template Structure:**
```yaml
name: Your Task Name
description: Brief description of what this task does

input_schema:
  type: object
  required:
    - required_field1
    - required_field2
  properties:
    required_field1:
      type: string
      description: Description of this field
    optional_field:
      type: string
      description: Optional field description

main:
  # Step 0: Prepare context variables (ALWAYS DO THIS FIRST)
  - evaluate:
      context_var1: $ _.required_field1
      context_var2: $ _.optional_field or "default_value"
      json_formatted: $ json.dumps(_.some_object or {}, indent=2)

  # Step 1: Main LLM prompt
  - prompt: |-
      You are a [role]. Analyze the following data.
      
      Input Data: {steps[0].output.context_var1}
      Additional Context: {steps[0].output.context_var2}
      
      CRITICAL: Return ONLY valid JSON. No markdown, no code blocks.
      Do NOT wrap in backticks. Start with opening brace, end with closing brace.
      
      REQUIRED JSON STRUCTURE:
      Return a JSON object with these keys:
      - field1: string (description)
      - field2: array of strings
      - field3: object with subfield1 and subfield2
      
      Be specific about requirements and format expectations.
    unwrap: true

  # Step 2: Clean and parse LLM output
  - evaluate:
      cleaned_output: $ steps[1].output.strip().removeprefix('```json').removeprefix('```').removesuffix('```').strip()
  
  - evaluate:
      parsed_data: $ json.loads(steps[2].output.cleaned_output)

  # Step 4: Build return object
  - evaluate:
      result_data:
        field1: $ steps[3].output.parsed_data.get("field1")
        field2: $ steps[3].output.parsed_data.get("field2", [])
        processed_at: $ "timestamp_added_by_typescript"

  # Step 5: Return for MongoDB sync
  - return:
      success: $ True
      data: $ steps[4].output.result_data
```

#### 2. Key YAML Rules (CRITICAL)

**✅ DO:**
- Prepare context in step 0 with `evaluate`
- Reference variables as `{steps[N].output.variable_name}` in prompts
- Describe JSON structure in text, not actual JSON examples with braces
- Clean LLM output with `removeprefix`/`removesuffix`
- Use `$ expression` for all dynamic values
- Use `json.loads()` to parse JSON strings
- Return flat objects or simple expressions

**❌ DON'T:**
- Use `{_.field}` directly in prompts (won't resolve properly)
- Show JSON examples with curly braces `{ }` in prompts
- Use f-strings with complex expressions
- Use `datetime.now()` (add timestamps in TypeScript)
- Return nested objects directly (use evaluate step first)
- Include `project: astra` in YAML (handled by SDK)

**Example of What NOT to Do:**
```yaml
# ❌ BAD - Direct variable reference in prompt
- prompt: |-
    Birth Date: {_.birth_date}  # This will fail!

# ❌ BAD - JSON example with braces
- prompt: |-
    Return JSON like this:
    {
      "name": "value"  # This will cause f-string errors!
    }

# ❌ BAD - Complex f-string
- evaluate:
    context: $ f"{_.date} at {_.time}"  # Quote issues!
```

**Example of What TO Do:**
```yaml
# ✅ GOOD - Prepare in evaluate, reference in prompt
- evaluate:
    birth_date_val: $ _.birth_date

- prompt: |-
    Birth Date: {steps[0].output.birth_date_val}

# ✅ GOOD - Describe structure in text
- prompt: |-
    Return a JSON object with these keys:
    - name: string (person's name)
    - age: number (person's age)

# ✅ GOOD - Simple string concatenation
- evaluate:
    context: $ _.date + " at " + _.time
```

#### 3. Register Task in Loader

**File:** `app/src/lib/tasks/loader.ts`

```typescript
const TASK_REGISTRY = {
  TRANSCRIPT_PROCESSOR: 'transcript-processor.yaml',
  CHART_CALCULATOR: 'chart-calculator.yaml',
  YOUR_NEW_TASK: 'your-task-name.yaml',  // Add here
} as const;
```

#### 4. Create API Endpoint (Optional)

**File:** `app/src/app/api/tasks/your-task/route.ts`

```typescript
import { auth } from "@/lib/auth";
import { getBackgroundWorkerAgentId, julepClient } from "@/lib/julep-client";
import { loadTaskDefinition } from "@/lib/tasks/loader";
import { getUsers } from "@/lib/mongo";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { input_field1, input_field2 } = await request.json();
  
  const users = getUsers();
  const user = await users.findOne({ id: session.user.id });
  
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Load task definition
  const taskDef = loadTaskDefinition('YOUR_NEW_TASK');
  const agentId = getBackgroundWorkerAgentId();

  // Execute task
  const result = await julepClient.createAndExecuteTask(
    agentId,
    taskDef,
    {
      input_field1,
      input_field2,
      julep_user_id: user.julep_user_id,
    },
    {
      maxAttempts: 60,
      intervalMs: 2000,
    }
  );

  if (result.status !== 'succeeded') {
    return NextResponse.json(
      { error: result.error || 'Task failed' },
      { status: 500 }
    );
  }

  // Sync to MongoDB
  await users.updateOne(
    { id: user.id },
    {
      $set: {
        'user_overview.your_field': result.output.data,
        'user_overview.last_updated': new Date(),
      },
    }
  );

  return NextResponse.json({ success: true, data: result.output });
}
```

#### 5. Update MongoDB Types

**File:** `app/src/lib/mongo.ts`

```typescript
export type UserOverview = {
  // ... existing fields
  your_new_field?: YourDataType;
  last_updated?: Date;
  updated_by?: string;
};
```

#### 6. Test Your Task

```typescript
// Create test script: app/scripts/test-your-task.ts
import { getBackgroundWorkerAgentId, julepClient } from '@/lib/julep-client';
import { loadTaskDefinition } from '@/lib/tasks/loader';

const taskDef = loadTaskDefinition('YOUR_NEW_TASK');
const agentId = getBackgroundWorkerAgentId();

const result = await julepClient.createAndExecuteTask(
  agentId,
  taskDef,
  {
    input_field1: 'test value',
    input_field2: 'test value 2',
  },
  {
    maxAttempts: 30,
    intervalMs: 2000,
    onProgress: (status, attempt) => {
      console.log(`[${attempt}] Status: ${status}`);
    },
  }
);

console.log('Result:', result.status);
console.log('Output:', JSON.stringify(result.output, null, 2));
process.exit(0);
```

**Run:** `bun run scripts/test-your-task.ts`

---

## Working Features (Current Status)

### ✅ Fully Operational

1. **Voice Sessions**
   - ElevenLabs React SDK integration
   - Real-time voice conversations
   - Session handshake with full context
   - Auto-disconnect on farewell phrases
   - 40+ dynamic variables sent to agent

2. **Transcript Processing**
   - Automatic trigger after conversation ends
   - Extracts insights, preferences, topics
   - Updates profile summary
   - Tracks conversation history
   - Extracts birth time/location if mentioned
   - Builds incident map of key moments
   - Generates personalized first message for next session

3. **Birth Chart Calculation**
   - Automatically triggers when all birth data present
   - Generates Vedic chart (sidereal zodiac)
   - Generates Western chart (tropical zodiac)
   - Finds famous people born on same date
   - Cultural awareness (prioritizes region-specific figures)
   - Calculated once and stored permanently
   - Includes nakshatras, dashas, aspects

4. **User Profile & Memory**
   - Complete user_overview stored in MongoDB
   - Preferences (Hinglish level, communication style)
   - Recent conversations (last 10 with summaries)
   - Incident map (creative sparks, key moments)
   - Gamification (streaks, total conversations)
   - Birth details with timezone detection
   - 85+ insights tracked per user

5. **Context Awareness**
   - Agent has full memory from first word
   - References past conversations
   - Knows user's projects and interests
   - Aware of philosophical vision
   - Personalized greetings
   - Mysterious "I sense..." phrasing

### 🚧 Planned Features

- Daily horoscope generation
- Weekly summary reports
- Persona enrichment analysis
- Gamification milestones tracking
- Memory Store MCP integration

---

## Development Commands

```bash
# Development
cd app
bun install
bun run dev              # Start dev server (http://localhost:3000)
bun run lint             # Type-check and format with Biome

# Task Testing
bun run scripts/test-chart-calc.ts          # Test chart calculation
bun run scripts/run-transcript-task.ts      # Process specific transcript
bun run scripts/inspect-my-profile.ts       # View your complete profile
bun run scripts/check-birth-data.ts         # Check birth data status

# Production
bun run build
bun run start
```

---

## Environment Variables

**Required** (stored in `app/.env` — never commit secrets):

```bash
# MongoDB
MONGODB_URI=mongodb+srv://...
# OR
MONGODB_USERNAME=user
MONGODB_PASSWORD=pass
MONGODB_CLUSTER=cluster.mongodb.net
MONGODB_DB=astra

# Auth
BETTER_AUTH_SECRET=random_secret_key
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google

# ElevenLabs
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_ID=...

# Julep
JULEP_API_KEY=julep_...
BACKGROUND_WORKER_AGENT_ID=...

# Optional
GOOGLE_ENABLE_BIRTHDAY_SCOPE=true
GOOGLE_ENABLE_GMAIL_READ_SCOPE=false
```

---

## Code Style Guidelines

### TypeScript / React

- Prefer server components except where interactivity demands client components
- Use async/await for data fetching; handle errors with meaningful responses
- Keep React components small and focused
- Validate external inputs (API routes) and return typed payloads
- Employ Biome (`bun run lint`) before committing

### Environment Handling

- Guard all required env vars via helper utilities (`app/src/lib/env.ts`)
- Never ship real secrets. Use `.env.example` for placeholders
- MongoDB access stays inside Next.js app; agents read/write through Julep APIs

### Testing Expectations

- Run `bun run lint` before committing
- For voice changes, perform manual smoke test
- For API changes, test session handshake returns correct data
- Use scripts in `app/scripts/` for debugging

---

## Quick Links

### 🎯 Getting Started
- 📘 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — **START HERE:** Complete system architecture
- ❓ [`docs/FAQ.md`](docs/FAQ.md) — **Answers to common questions**
- ✅ [`docs/IMPLEMENTATION_CHECKLIST.md`](docs/IMPLEMENTATION_CHECKLIST.md) — Development progress tracker

### 📚 Reference
- 👤 [`docs/PERSONA.md`](docs/PERSONA.md) — Samay persona details
- 📋 [`docs/julep.md`](docs/julep.md) — Julep SDK reference
- 📖 [`docs/react-sdk.mdx`](docs/react-sdk.mdx) — ElevenLabs React SDK reference
- 🗂️ [`agents/README.md`](agents/README.md) — Agent definitions and tasks
- 📦 [`.archive/`](.archive) — Old documentation files

---

## Support

- Documentation lives under `docs/`
- Report issues via GitHub Issues
- For project-wide context or clarifications, consult `AGENTS.md` (this file)

---

**Always answer in English**
