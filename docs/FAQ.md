# Frequently Asked Questions (FAQ)

> **Purpose:** Answer common questions about the multi-agent system implementation  
> **Last Updated:** 2025-01-XX  
> **For:** Developers implementing and maintaining the system

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [MongoDB vs Julep Docs](#mongodb-vs-julep-docs)
3. [Agent Creation & Management](#agent-creation--management)
4. [User Mapping & Workflow](#user-mapping--workflow)
5. [Auto-Tool Calling](#auto-tool-calling)
6. [Memory & Context Retrieval](#memory--context-retrieval)
7. [YAML Validation](#yaml-validation)
8. [Troubleshooting](#troubleshooting)

---

## System Architecture

### Q: How does the multi-agent system work?

**A:** The system has three layers:

1. **MongoDB (Storage Layer)** - Source of truth for:
   - User profiles with birth data
   - Conversation IDs and metadata
   - Integration tokens

2. **Julep (AI Layer)** - Agent orchestration with:
   - Agents (Responder for chat, Background Worker for tasks)
   - User Docs (AI-readable memory)
   - Tasks (YAML workflows for processing)
   - Sessions (conversation state with memory recall)

3. **Next.js (Presentation Layer)** - User interface with:
   - Voice UI (ElevenLabs React SDK)
   - API routes (session handshake, task triggers)
   - Dashboard (horoscope, chart, gamification)

**Data flows:** MongoDB → Julep (sync on signup) → Tasks enrich Julep docs → Next conversation recalls enriched context

### Q: Why use both MongoDB and Julep?

**A:** They serve different purposes:

- **MongoDB** = Persistent, queryable, relational storage (what Better Auth needs)
- **Julep** = AI-accessible, searchable, contextual memory (what agents need)

Example: Birth date in MongoDB as `Date` object, in Julep as human-readable text "Date of Birth: 1990-08-15" that agents can understand.

---

## MongoDB vs Julep Docs

### Q: What data lives in MongoDB vs Julep Docs?

**MongoDB (Source of Truth):**
- User authentication data (Better Auth)
- Birth data: `date_of_birth`, `birth_time`, `birth_location`
- Conversation IDs and status
- Integration tokens
- Audit trail with timestamps

**Julep Docs (AI Memory):**
- Profile (name, email, birth data in readable format)
- Preferences (communication style, topics, Hinglish level)
- Notes (conversation summaries)
- Horoscopes (daily predictions)
- Charts (calculated astrology charts)
- Gamification (streaks, milestones)
- Reports (weekly companion summaries)

**Key Insight:** MongoDB stores raw data, Julep stores enriched, AI-readable context.

### Q: How do we keep MongoDB and Julep in sync?

**A:** One-way sync on specific events:

```javascript
// On user signup:
1. Better Auth creates user in MongoDB
2. Create Julep user with project="astra"
3. Seed Julep docs with MongoDB birth data
4. Store Julep user ID in MongoDB

// On birth data update:
1. User updates in app → MongoDB updated
2. Create new Julep profile doc (versioned)
3. Optionally: Background task validates and enriches

// On conversation end:
1. Conversation ID stored in MongoDB
2. Transcript fetched from ElevenLabs API
3. Julep task extracts insights → writes to Julep docs
4. MongoDB not updated (insights live in Julep only)
```

**MongoDB is primary for identity, Julep is primary for insights.**

### Q: Do we store transcripts in MongoDB or Julep?

**A:** Neither! Transcripts are:
- **Fetched on-demand** from ElevenLabs API using conversation ID
- **Processed once** by Julep tasks
- **Insights extracted** and stored in Julep docs
- **Original transcript discarded** (not stored anywhere)

This keeps storage lean and respects privacy.

---

## Agent Creation & Management

### Q: How do I create the agents?

**A:** Use the Julep Node.js SDK:

```javascript
import { Julep } from '@julep/sdk';

const client = new Julep({ apiKey: process.env.JULEP_API_KEY });

// 1. Create Responder Agent (Frontline)
const responder = await client.agents.create({
  name: "Astra",
  model: "claude-3.5-sonnet",
  about: "Astra is a mystical astrology companion",
  project: "astra",  // ← MUST be "astra" for all agents
  // Instructions from agents/definitions/astra.yaml
});

console.log("Responder Agent ID:", responder.id);
// Save to .env: ASTRA_AGENT_ID=agent_xyz123

// 2. Create Background Worker Agent
const worker = await client.agents.create({
  name: "Astra Background Worker",
  model: "claude-3.5-sonnet",
  about: "Background processing agent",
  project: "astra",  // ← Same project
});

console.log("Worker Agent ID:", worker.id);
// Save to .env: BACKGROUND_WORKER_AGENT_ID=agent_abc789
```

**Do this once during initial setup.** Agents persist in Julep workspace.

### Q: What is `project: "astra"` and why is it required?

**A:** Julep organizes resources by project. All agents, users, tasks, and sessions must belong to the same project to interact.

```javascript
// Create agent in "astra" project
await client.agents.create({ project: "astra", ... });

// Create user in "astra" project
await client.users.create({ project: "astra", ... });

// Create task for agent in "astra" project
await client.tasks.create(agentId, { /* task def */ });

// If projects don't match → agents can't access user docs!
```

**Always use `project: "astra"` everywhere.**

### Q: Can I update agent instructions without recreating?

**A:** Yes, use `agents.update()`:

```javascript
await client.agents.update(agentId, {
  instructions: "Updated instructions here...",
  // Other fields you want to change
});
```

Existing sessions continue with new instructions after update.

---

## User Mapping & Workflow

### Q: How are MongoDB users mapped to Julep users?

**A:** Via `julep_user_id` field in MongoDB:

```javascript
// MongoDB user document
{
  id: "user_sarah_123",        // Better Auth ID
  name: "Sarah Johnson",
  email: "sarah@example.com",
  julep_user_id: "julep_01234567",  // ← Link to Julep
  julep_project: "astra",
  date_of_birth: Date("1990-08-15"),
}

// Julep user
{
  id: "julep_01234567",
  name: "Sarah Johnson",
  about: "User email: sarah@example.com",
  project: "astra",
  metadata: {
    email: "sarah@example.com",
    mongodb_id: "user_sarah_123",  // ← Link back
  }
}
```

**Two-way reference enables seamless lookups.**

### Q: What happens when a new user signs up?

**Complete flow:**

```javascript
// 1. Better Auth creates user (automatic)
const mongoUser = {
  id: "user_new_123",
  name: "New User",
  email: "new@example.com",
  date_of_birth: new Date("1995-05-20"),  // From Google People API
};

// 2. Create Julep user (in auth callback)
const julepUser = await client.users.create({
  name: mongoUser.name,
  about: `User email: ${mongoUser.email}`,
  project: "astra",
  metadata: {
    email: mongoUser.email,
    mongodb_id: mongoUser.id,
  },
});

// 3. Link back in MongoDB
await mongoUsers.updateOne(
  { id: mongoUser.id },
  { $set: { julep_user_id: julepUser.id } }
);

// 4. Seed initial Julep docs
await client.users.docs.create(julepUser.id, {
  title: "User Profile",
  content: [
    `Name: ${mongoUser.name}`,
    `Email: ${mongoUser.email}`,
    `Date of Birth: ${mongoUser.date_of_birth.toISOString().split('T')[0]}`,
  ].join('\n'),
  metadata: {
    type: "profile",
    scope: "frontline",
    shared: true,
    updated_by: "system",
    timestamp_iso: new Date().toISOString(),
  },
});

await client.users.docs.create(julepUser.id, {
  title: "User Preferences",
  content: ["No preferences set yet. This will be enriched over time."],
  metadata: {
    type: "preferences",
    scope: "frontline",
    shared: true,
    updated_by: "system",
    timestamp_iso: new Date().toISOString(),
  },
});

// 5. User is ready for first conversation!
```

**Result:** MongoDB user ↔ Julep user linked, initial docs seeded.

### Q: How does a conversation get processed end-to-end?

**Step-by-step:**

```javascript
// 1. User starts voice session (ElevenLabs React SDK)
const conversation = useConversation({
  onConnect: async (conversationId) => {
    // 2. Store in MongoDB
    await fetch("/api/responder/conversations", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: conversationId,
        user_id: session.user.id,
      }),
    });
  },
});

// 3. Conversation happens (ElevenLabs handles audio/transcription)

// 4. User ends conversation
conversation.onDisconnect(async (details) => {
  // 5. Trigger transcript processing
  await fetch("/api/tasks/transcript", {
    method: "POST",
    body: JSON.stringify({
      conversation_id: details.conversationId,
    }),
  });
});

// 6. API route processes:
// - Fetches transcript from ElevenLabs API
// - Gets user's Julep ID from MongoDB
// - Creates Julep task from YAML
// - Executes task with transcript as input

// 7. Task runs (in Julep cloud):
// - Extracts birth details, preferences, insights
// - Creates/updates Julep user docs
// - Returns success status

// 8. Next conversation:
// - Julep session with recall=true
// - Agent automatically retrieves enriched docs
// - Personalized response with context
```

**MongoDB tracks what, Julep enriches how.**

---

## Auto-Tool Calling

### Q: What is auto-tool calling?

**A:** When `auto_run_tools: true` is set, agents automatically call tools as needed without explicit instructions:

```yaml
# In task YAML or agent definition
main:
  - prompt:
      - role: user
        content: "What's in my birth chart?"
    auto_run_tools: true  # ← Agent calls tools automatically
```

**What happens:**
1. Agent receives user message
2. Realizes it needs birth data
3. **Automatically calls** `search_user_docs` tool
4. Gets birth data from profile doc
5. **Automatically calls** chart calculation tool (if available)
6. Responds with chart insights

**No manual orchestration needed!**

### Q: How does auto-tool calling work with ElevenLabs?

**A:** ElevenLabs passes user messages to Julep agent, which has tools enabled:

```javascript
// 1. ElevenLabs conversation configuration
const conversation = useConversation({
  agentId: process.env.ELEVENLABS_AGENT_ID,
  // ElevenLabs agent is configured to call Julep agent
});

// 2. User speaks: "Show me my horoscope for today"

// 3. ElevenLabs transcribes → sends to Julep agent

// 4. Julep agent (with auto_run_tools: true):
//    - Searches user docs for horoscope (type="horoscope")
//    - Finds latest horoscope doc
//    - Reads content
//    - Responds with horoscope

// 5. ElevenLabs speaks response to user
```

**Completely transparent to user—feels like natural conversation.**

### Q: What tools does the Responder agent have?

**A:** From `agents/definitions/astra.yaml`:

```yaml
tools:
  - name: search_user_docs
    description: Search user documents for any information
    type: system
    system:
      resource: user
      subresource: doc
      operation: search

  - name: list_user_docs
    description: List documents filtered by metadata
    type: system
    system:
      resource: user
      subresource: doc
      operation: list
```

**Agent can search and list user docs automatically during conversation.**

### Q: Can I add custom tools to agents?

**A:** Yes! Add to the `tools` section:

```yaml
tools:
  - name: calculate_transit
    description: Calculate current planetary transits for user's chart
    type: integration
    integration:
      provider: astrology_api
      method: transits
      setup:
        api_key: "{ASTROLOGY_API_KEY}"
```

**Agent will automatically call this when user asks about transits.**

---

## Memory & Context Retrieval

### Q: How does memory recall work in conversations?

**A:** Via Julep sessions with `recall: true`:

```javascript
const session = await client.sessions.create({
  user: "julep_01234567",
  agent: ASTRA_AGENT_ID,
  recall: true,  // ← Enable memory retrieval
  recallOptions: {
    mode: "hybrid",  // Semantic + keyword search
    limit: 10,       // Max docs to retrieve
    numSearchMessages: 4,  // Look at last 4 messages for context
    metadataFilter: {
      scope: "frontline",  // Only recall frontline docs
      shared: true,
    },
  },
});
```

**What happens:**
- User sends message
- Julep searches user's docs for relevant context
- Injects relevant docs into agent's context window
- Agent responds with full awareness of user's history

**No manual memory management needed!**

### Q: What does "frontline" vs "background" scope mean?

**A:** Controls which docs agents can recall:

- **`scope: "frontline"`** - User-facing information:
  - Profile (birth data)
  - Preferences (communication style)
  - Notes (conversation summaries)
  - Agents recall these during conversations

- **`scope: "background"`** - Internal processing:
  - Horoscopes (for dashboard display)
  - Charts (for visualization)
  - Gamification (for progress tracking)
  - Not recalled in chat, but queried explicitly for UI

**Prevents information overload in conversation context.**

### Q: How do I retrieve previous conversations?

**A:** Query notes docs:

```javascript
// Get all conversation summaries
const notes = await client.users.docs.list("julep_01234567", {
  metadata_filter: {
    type: "notes",
    scope: "frontline",
  },
  sort_by: "updated_at",
  direction: "desc",
  limit: 100,
});

console.log(`User has ${notes.items.length} conversations`);

notes.items.forEach(note => {
  console.log(`${note.title}: ${note.content[0].substring(0, 100)}...`);
});
```

**Conversations are summarized in notes docs with metadata linking to conversation IDs.**

### Q: Can users see their own Julep docs?

**A:** Not directly, but you can expose them via API:

```javascript
// API route: GET /api/user/memory
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const mongoUser = await mongoUsers.findOne({ id: session.user.id });
  
  const docs = await client.users.docs.list(mongoUser.julep_user_id, {
    metadata_filter: { scope: "frontline" },
  });
  
  return NextResponse.json({
    profile: docs.items.find(d => d.metadata.type === "profile"),
    preferences: docs.items.find(d => d.metadata.type === "preferences"),
    conversations: docs.items.filter(d => d.metadata.type === "notes"),
  });
}
```

**Build a "My Memory" page showing their docs in human-readable format.**

### Q: How is memory different from Memory Store MCP?

**A:** Different systems:

- **Julep User Docs** - Current implementation:
  - Stored in Julep's database
  - Accessible via Julep SDK
  - Structured documents with metadata
  - Used NOW

- **Memory Store MCP** - Future integration:
  - External memory service via MCP protocol
  - Standardized memory access across tools
  - Optional enhancement layer
  - Can be added LATER

**Start with Julep docs, add Memory Store MCP when ready.**

---

## YAML Validation

### Q: How do I validate my YAML files?

**A:** Pre-commit hook automatically validates:

```bash
# Install pre-commit
pip install pre-commit
pre-commit install

# Now every commit automatically validates YAML
git add agents/tasks/my-task.yaml
git commit -m "Add new task"
# ↑ Will fail if YAML is invalid
```

**Manual validation:**

```bash
# Validate single file
cd app && bun x js-yaml agents/tasks/my-task.yaml

# If valid: outputs parsed YAML
# If invalid: shows error with line number
```

### Q: What are common YAML errors?

**A:** Watch out for:

```yaml
# ❌ BAD: Inconsistent indentation
main:
  - prompt: "Hello"
   auto_run_tools: true  # Wrong indent!

# ✅ GOOD: Consistent 2-space indentation
main:
  - prompt: "Hello"
    auto_run_tools: true

# ❌ BAD: Missing quotes around special characters
name: Task with: colon

# ✅ GOOD: Quoted strings with special chars
name: "Task with: colon"

# ❌ BAD: Wrong list syntax
tools:
- name: search_docs
type: system  # Wrong indent!

# ✅ GOOD: Proper list with nested objects
tools:
  - name: search_docs
    type: system

# ❌ BAD: Invalid variable syntax
evaluate:
  result: $.wrong_syntax

# ✅ GOOD: Julep expression syntax
evaluate:
  result: $ _.correct_syntax
```

### Q: How do I test a task before deploying?

**A:** Use test script:

```bash
# Create test script: app/scripts/test-task.ts
import { Julep } from '@julep/sdk';
import yaml from 'yaml';
import fs from 'fs';

const client = new Julep({ apiKey: process.env.JULEP_API_KEY });

// Load task
const taskYaml = fs.readFileSync('agents/tasks/my-task.yaml', 'utf8');
const taskDef = yaml.parse(taskYaml);

// Create task
const task = await client.tasks.create(
  process.env.BACKGROUND_WORKER_AGENT_ID!,
  taskDef
);

// Execute with test data
const execution = await client.executions.create(task.id, {
  input: {
    julep_user_id: "test_user_123",
    // ... other test inputs
  },
});

// Wait for completion
let result;
while (true) {
  result = await client.executions.get(execution.id);
  if (result.status === 'succeeded' || result.status === 'failed') break;
  console.log(result.status);
  await new Promise(resolve => setTimeout(resolve, 2000));
}

console.log("Result:", result.output || result.error);
```

**Run:** `bun run scripts/test-task.ts`

---

## Troubleshooting

### Q: Error: "User not found or missing Julep ID"

**A:** MongoDB user not linked to Julep:

```javascript
// Check MongoDB
const user = await mongoUsers.findOne({ id: userId });
console.log("Julep ID:", user.julep_user_id);  // Should exist

// If null, create Julep user:
const julepUser = await client.users.create({
  name: user.name,
  project: "astra",
  // ...
});

await mongoUsers.updateOne(
  { id: userId },
  { $set: { julep_user_id: julepUser.id } }
);
```

### Q: Error: "Agent not found in project astra"

**A:** Agent created in wrong project:

```javascript
// Check agent's project
const agent = await client.agents.get(agentId);
console.log("Project:", agent.project);  // Must be "astra"

// If wrong, recreate with correct project:
const newAgent = await client.agents.create({
  name: "Astra",
  project: "astra",  // ← Must match
  // ...
});
```

### Q: Agent doesn't recall user's birth data

**A:** Check session recall configuration:

```javascript
// Ensure recall is enabled
const session = await client.sessions.create({
  user: julepUserId,
  agent: agentId,
  recall: true,  // ← Must be true
  recallOptions: {
    metadataFilter: {
      scope: "frontline",  // Must match doc scope
      shared: true,
    },
  },
});

// Check doc exists
const docs = await client.users.docs.list(julepUserId, {
  metadata_filter: {
    type: "profile",
    scope: "frontline",
  },
});
console.log("Profile docs:", docs.items);
```

### Q: Transcript processing fails

**A:** Debug checklist:

```javascript
// 1. Verify conversation exists in MongoDB
const conv = await mongoConversations.findOne({ conversation_id });
console.log("Conversation:", conv);

// 2. Verify transcript fetchable from ElevenLabs
const response = await fetch(
  `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
  { headers: { Authorization: `Bearer ${ELEVENLABS_API_KEY}` } }
);
console.log("Status:", response.status);

// 3. Check task execution status
const execution = await client.executions.get(executionId);
console.log("Status:", execution.status);
console.log("Error:", execution.error);

// 4. Verify Julep user ID mapping
const user = await mongoUsers.findOne({ id: userId });
console.log("Julep ID:", user.julep_user_id);
```

### Q: How do I debug Julep task execution?

**A:** Check execution logs:

```javascript
const execution = await client.executions.get(executionId);

console.log("Status:", execution.status);
console.log("Output:", execution.output);
console.log("Error:", execution.error);

// Get detailed steps (if available)
if (execution.steps) {
  execution.steps.forEach((step, i) => {
    console.log(`Step ${i}:`, step.status, step.output || step.error);
  });
}
```

**Common issues:**
- Missing input fields → Check task's `input_schema`
- Tool call failures → Verify tool names and arguments
- Timeout → Increase `timeout_seconds` in task definition

### Q: Pre-commit hook fails on YAML

**A:** Fix YAML syntax:

```bash
# See which file failed
cat .git/hooks/pre-commit

# Validate manually
cd app && bun x js-yaml ../agents/tasks/failing-file.yaml

# Fix errors shown, then commit again
git add agents/tasks/failing-file.yaml
git commit -m "Fix YAML syntax"
```

---

## Quick Reference

### MongoDB → Julep User Creation

```javascript
const julepUser = await client.users.create({
  name: mongoUser.name,
  project: "astra",
  about: `Email: ${mongoUser.email}`,
  metadata: { mongodb_id: mongoUser.id },
});

await mongoUsers.updateOne(
  { id: mongoUser.id },
  { $set: { julep_user_id: julepUser.id } }
);
```

### Create Julep Doc

```javascript
await client.users.docs.create(julepUserId, {
  title: "Document Title",
  content: ["Text content here"],
  metadata: {
    type: "profile",
    scope: "frontline",
    shared: true,
    updated_by: "system",
    timestamp_iso: new Date().toISOString(),
  },
});
```

### Execute Julep Task

```javascript
const taskYaml = fs.readFileSync("agents/tasks/task.yaml", "utf8");
const task = await client.tasks.create(agentId, yaml.parse(taskYaml));

const execution = await client.executions.create(task.id, {
  input: { julep_user_id: "user_123", /* ... */ },
});

// Poll for completion
let result;
while (true) {
  result = await client.executions.get(execution.id);
  if (result.status === 'succeeded' || result.status === 'failed') break;
  await new Promise(resolve => setTimeout(resolve, 2000));
}
```

### Query User Docs

```javascript
const docs = await client.users.docs.list(julepUserId, {
  metadata_filter: { type: "notes", scope: "frontline" },
  sort_by: "updated_at",
  direction: "desc",
  limit: 10,
});
```

---

**Still have questions?** Check:
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) - Complete system architecture
- [`IMPLEMENTATION_CHECKLIST.md`](./IMPLEMENTATION_CHECKLIST.md) - Development progress tracker