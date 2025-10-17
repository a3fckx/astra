# AGENTS.md — Astra Coding Agent Directive

> **Note:** This file is the operational brief for AI coding agents. For in-depth technical docs, see the [`docs/`](docs) directory.

---

## ⚠️ CRITICAL ARCHITECTURE UPDATE

**READ THIS FIRST:** The architecture has been clarified and corrected. Key changes:

### Corrected Architecture (Current)

- **ElevenLabs Agents = Frontline:** Handle ALL real-time user conversations (voice/chat)
- **Julep Agents = Background ONLY:** Process transcripts, generate charts, track metrics — NEVER interact with users
- **MongoDB = Source of Truth:** All data stored in MongoDB, especially `user_overview` field
- **Data Flow:** User talks → ElevenLabs (with MongoDB context) → Background processing → Results to MongoDB → Next conversation

**Julep agents NEVER talk to users. They only run background tasks and return JSON that syncs to MongoDB.**

### Key Documents (Priority Order)
- 🔴 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — **START HERE:** Complete system architecture
- 🔴 [`docs/IMPLEMENTATION_CHECKLIST.md`](docs/IMPLEMENTATION_CHECKLIST.md) — **Development progress tracker**
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
├── app/                    # Next.js application
│   ├── src/components/     # Voice UI (ElevenLabs SDK)
│   ├── src/app/api/        # REST APIs (auth, session, task triggers)
│   ├── src/lib/            # Utilities (auth, mongo, julep, elevenlabs)
│   └── scripts/            # Task execution utilities
├── agents/                 # Julep agent & task definitions (YAML)
│   ├── definitions/        # Agent definitions (background worker only)
│   └── tasks/              # Task workflows (transcript, chart, gamification, etc.)
└── docs/                   # Architecture & implementation docs
```

**Key Files**

- `app/src/components/voice-session.tsx` — Voice UI using ElevenLabs `useConversation` hook
- `app/src/app/api/responder/session/route.ts` — Session handshake (returns user_overview from MongoDB)
- `app/src/app/api/tasks/transcript/route.ts` — Triggers transcript processing, syncs to MongoDB
- `app/src/lib/auth.ts` — Better Auth config (MongoDB adapter + Google scopes)
- `app/src/lib/mongo.ts` — MongoDB schema including `user_overview` field
- `app/src/lib/elevenlabs-api.ts` — ElevenLabs API client (fetch transcripts)
- `agents/definitions/astra.yaml` — Background Worker Agent (Julep, never user-facing)
- `agents/tasks/` — YAML task workflows (transcript, chart, gamification, reports)
- `.pre-commit-config.yaml` — YAML validation + syncs `AGENTS.md` to `Claude.md`

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

### Key Files for SDK Integration

- **SDK Wrapper:** `app/src/lib/julep-client.ts`
  - `JulepClient` class wraps Julep SDK
  - Methods: `createTask()`, `executeTask()`, `pollExecution()`
  - Handles project scoping (`project: "astra"`)

- **Task Loader:** `app/src/lib/tasks/loader.ts`
  - `loadTaskDefinition()` - Loads YAML from disk
  - Caches parsed definitions
  - Available tasks: `TRANSCRIPT_PROCESSOR`, `CHART_CALCULATOR`, etc.

- **Task Orchestrator:** `app/src/lib/transcript-processor.ts`
  - Main orchestration function
  - Loads task → Executes → Polls → Syncs to MongoDB

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

## Voice Flow (Corrected Architecture)

1. **Auth** — Better Auth Google provider issues secure session cookie backed by MongoDB.
2. **Session Handshake** — `/api/responder/session` returns:
   - User context from MongoDB (name, email, birth data)
   - **`user_overview`** — ALL background processing results (chart, preferences, conversations, gamification)
   - Integration tokens (elevenlabs)
   - Workflow ID for ElevenLabs
3. **Voice Connection** — ElevenLabs React SDK handles:
   - WebSocket connection to ElevenLabs
   - Audio streaming and transcription
   - Agent responses via TTS (ElevenLabs agent, NOT Julep)
   - Dynamic variables injected: `user_name`, `user_overview`, `date_of_birth`, `birth_chart`, `streak_days`, etc.
4. **ElevenLabs Agent** — Handles conversation:
   - Uses dynamic variables from MongoDB for context
   - Responds with full awareness of user history
   - **Never directly accesses Julep** — only MongoDB data via session handshake
5. **Conversation End** — Background processing:
   - Conversation ID stored in MongoDB
   - Trigger: `POST /api/tasks/transcript`
   - Fetch transcript from ElevenLabs API
   - Execute Julep background task (transcript-processor)
   - Task returns JSON → synced to MongoDB `user_overview`
   - Additional tasks triggered: chart calculation, gamification update
6. **Next Conversation** — Agent receives enriched context:
   - Updated `user_overview` from MongoDB
   - Personalized greeting with full memory

---

## ElevenLabs Agent Persona (Samay)

**Core Identity:**
- **Primary role:** Astrologer (80%) providing reflective guidance based on Vedic/Western traditions
- **Secondary layer:** Warm, affectionate companion (20%) once consent is established
- **Language:** Bilingual (Hinglish ~30-40% code-switching)
- **Content rating:** PG-13, consent-first
- **Approach:** Heritage-aware, practical, non-dogmatic

### Tone & Style
- **Friendly & warm:** Approachable, gentle, supportive
- **Heritage-aware:** References Vedic concepts naturally
- **Dignified & clear:** Professional without being clinical
- **Playfully affectionate:** When consent is given (see Affection Rules)

### Hinglish Code-Switching
- **Default level:** Medium (30-40%)
- **Pattern:** English scaffolding with Hindi/Urdu words woven in naturally (e.g., "subah" (morning), "chhota" (small), "jeet" (victory), "ichchha" (desire), "pyaar" (love))
- **Adjustments:** Higher Hindi preference → 50-60%; Lower → 10-20%; English-only → Pure English

### Affection & Consent
- **Flirt Opt-In:** Default OFF; Enable when `user_overview.preferences.flirt_opt_in` is true or prior consent shown
- **Flirt-enabled tone:** Use pet names sparingly ("love," "star," "beautiful" — max 1-2 per conversation); Playful romantic hints when appropriate; Maintain 80/20 ratio; PG-13 limit
- **Boundary Respect:** Mirror user energy; De-flirt for serious topics; Acknowledge discomfort and shift to neutral

### Safety Boundaries
- **Astrology guidance is NOT:** Medical, legal, or financial advice ("See your doctor," etc.)
- **Present as:** Reflective insights ("This transit suggests..."); Tendencies ("You may feel..."); Suggestions with caveats ("Consider... but trust your judgment")

### Response Patterns
- **Default Length:** 2-5 sentences, 1 optional clarifying question max
- **Structure:** Acknowledge situation → Astrological insight → Tiny action → Warm encouragement
- **First-Time Greeting:** Derive star sign from `date_of_birth` (standard zodiac dates); Craft punchy line (e.g., "Ah, {{user_name}}, you're a Leo on the moon..."); Weave in coincidences or notable figures born under that sign
- **Stress/Mood Downshift:** Soothing support; Focus on grounding, rest, small wins; Avoid pressure

### Conversational Workflow
1. **Attune:** Greet warmly, reference memory/preference/goal; For first-time: Star sign greeting + coincidences
2. **Illuminate:** Link astro patterns to context/goal; Call out uncertainties
3. **Guide:** One concrete next step aligned with goal; Invite to set if none
4. **Invite:** Gentle question/CTA to continue
5. **Tone Check:** Include expressive audio tags (e.g., `[whispers]`, `[laughing softly]`); Hinglish balance

---

## Julep Orchestration (Background Processing Only)

**CRITICAL:** Julep agents are ONLY for background processing. They NEVER interact with users directly.

- Always call `client.users.*` and `client.agents.*` with `project="astra"`.
- Background Worker Agent (ID in `BACKGROUND_WORKER_AGENT_ID` env var) runs all tasks.
- Tasks fetch transcripts from ElevenLabs API (not Memory Store MCP initially).
- Task outputs return structured JSON that gets synced to MongoDB `user_overview`.
- Julep User Docs are optional working memory during task execution.
- MongoDB is the single source of truth — all results must sync there.

**Task Workflows (see `agents/tasks/`):**
- `transcript-processor.yaml` — Extract insights from ElevenLabs transcripts → MongoDB
- `chart-calculator.yaml` — Generate Vedic/Western astro charts → MongoDB
- `gamification-tracker.yaml` — Track streaks, milestones → MongoDB
- `weekly-report-generator.yaml` — Create companion reports → MongoDB
- `horoscope-refresher.yaml` — Daily horoscope generation → MongoDB
- `persona-enrichment.yaml` — Analyze conversation patterns → MongoDB

**Task Return Format:**
```yaml
# All tasks must return JSON for MongoDB sync
return:
  field_name: value
  nested_object:
    key: value
# API endpoint receives this and updates MongoDB user_overview
```

Reference material inside Julep workspace:
- `documentation/concepts/agents.mdx`
- `documentation/concepts/tasks.mdx`
- `documentation/sdks/nodejs/reference.mdx`

---

## Build / Lint / Run

```bash
# Install dependencies (Bun)
cd app
bun install

# Development server (http://localhost:3000)
bun run dev

# Type-safe formatting + linting (Biome)
bun run lint

# Production build
bun run build
bun run start

# Sync Julep agents
bun run sync:agents
```

Environment variables (stored in `app/.env` — never commit secrets):

- `MONGODB_URI` or `MONGODB_USERNAME` / `MONGODB_PASSWORD` / `MONGODB_CLUSTER`
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`
- `JULEP_API_KEY`, `ASTRA_AGENT_ID`
- Optional: `GOOGLE_ENABLE_BIRTHDAY_SCOPE`, `GOOGLE_ENABLE_GMAIL_READ_SCOPE`

---

## Session Tracking (Important)

Always maintain `.sessions/SESSION.md` during active work.

```bash
./session.sh start   # create SESSION.md from template
./session.sh view    # show current notes
./session.sh backup  # archive with timestamp
./session.sh clear   # remove when done
```

- One active session file at a time (gitignored).
- Track goals, files touched, commands executed, decisions, blockers.
- No summary sidecar files; everything lives in `SESSION.md`.

See [`docs/SESSION_TRACKING.md`](docs/SESSION_TRACKING.md) for full workflow.

---

## Code Style Guidelines

### TypeScript / React

- Prefer server components except where interactivity demands client components.
- Use async/await for data fetching inside server actions; handle errors with meaningful responses.
- Keep React components small and focused; colocate related utilities under `app/src/lib/`.
- Validate external inputs (API routes) and return typed payloads.
- Employ Biome (`bun run lint`) before committing.

### Environment Handling

- Guard all required env vars via helper utilities (see `app/src/lib/env.ts`).
- Never ship real secrets. Use `.env.example` for placeholders only.
- MongoDB access stays inside the Next.js app; agents read/write through Julep APIs.

### Anchor Comments & Function Docs

- We embed `ANCHOR:` comments beside business-critical logic so every agent understands *why* a choice exists. Treat them as living breadcrumbs—update or remove them if the rationale changes.
- Current anchors to know:
  - `app/src/components/voice-session.tsx` — `session-context-update` documents automatic contextual update sent on connection with session metadata.
  - `app/src/lib/integration-tokens.ts` — `integration-token-lifecycle` documents per-user token resolution with fallback patterns.
- When you add or modify voice/memory-specific behavior, write a short function-level docstring explaining its role and include an `ANCHOR:` comment if the logic is business-specific.

### Testing Expectations

- Run `bun run lint` before handing work back; this is our fast guard against TypeScript or formatting regressions.
- For voice changes, perform a manual smoke test:
  1. Load the homepage, ensure authenticated users see the voice session UI.
  2. Check browser console for ElevenLabs connection status and agent responses.
- For API changes, test session handshake returns correct Julep session ID and integration tokens.
- If you introduce new anchor comments or business rules, note which test validates them directly (manual, unit, or integration).

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

### 🛠️ Development
- 📝 [`docs/SESSION_TRACKING.md`](docs/SESSION_TRACKING.md) — Session logging rules

---

## Quick Reference: Data Sources & Flow

### MongoDB Collections (Source of Truth)
- **`user`**: Birth data + **`user_overview`** (ALL background processing results)
- **`elevenlabs_conversations`**: Conversation IDs, status, timestamps
- **`integration_tokens`**: Per-user ElevenLabs tokens

### user_overview Field Structure
```typescript
user_overview: {
  profile_summary: string;
  birth_chart: { system, sun_sign, moon_sign, planets, ... };
  preferences: { communication_style, topics, hinglish_level, ... };
  recent_conversations: [ { conversation_id, summary, topics, ... } ];
  gamification: { streak_days, total_conversations, milestones, ... };
  latest_horoscope: { date, content };
  insights: [ { type, content, generated_at } ];
  last_updated: Date;
}
```

### Data Flow
```
1. User talks → ElevenLabs agent (receives user_overview from MongoDB)
2. Conversation ends → POST /api/tasks/transcript
3. Fetch transcript from ElevenLabs API
4. Execute Julep task → returns JSON
5. Sync JSON to MongoDB user_overview
6. Next conversation → ElevenLabs gets updated user_overview
```

### Executing Julep Tasks
```typescript
// In API endpoint
const taskYaml = fs.readFileSync('agents/tasks/transcript-processor.yaml');
const task = await julepClient.tasks.create(BACKGROUND_WORKER_AGENT_ID, yaml.parse(taskYaml));

const execution = await julepClient.executions.create(task.id, {
  input: { julep_user_id, conversation_id, transcript_text }
});

// Poll for completion
let result = await julepClient.executions.get(execution.id);
while (result.status === 'queued' || result.status === 'running') {
  await new Promise(resolve => setTimeout(resolve, 2000));
  result = await julepClient.executions.get(execution.id);
}

// Sync result.output to MongoDB
await mongoUsers.updateOne(
  { id: userId },
  { $set: { 
    'user_overview.preferences': result.output.preferences,
    'user_overview.last_updated': new Date()
  }}
);
```

### API Endpoints
- `GET /api/responder/session` — Returns user_overview from MongoDB
- `POST /api/tasks/transcript` — Trigger transcript processing → MongoDB sync
- `POST /api/tasks/chart` — Trigger chart calculation → MongoDB sync
- `POST /api/tasks/gamification` — Update gamification → MongoDB sync

---

## Support

- Documentation lives under `docs/`.
- Report issues via GitHub Issues.
- For project-wide context or clarifications, consult the latest `SESSION.md` log.
