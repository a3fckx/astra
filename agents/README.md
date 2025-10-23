# Agents Directory — Julep Background Processing

> **Purpose:** Background task workflows for Astra's data processing system  
> **Important:** All agents here are BACKGROUND ONLY - they never interact with users directly

---

## Overview

This directory contains Julep agent definitions and task workflows that run asynchronously after voice conversations end.

**Critical Understanding:**
- **ElevenLabs agents** = Frontline (talk to users with voice)
- **Julep agents** = Background (process data, return JSON)
- **MongoDB** = Source of truth (stores all results in `user_overview`)

**Data Flow:**
```
User conversation → ElevenLabs agent (with MongoDB context)
  ↓
Conversation ends → Julep task triggered
  ↓
Task processes transcript → Returns JSON
  ↓
JSON synced to MongoDB → Available for next conversation
```

---

## Directory Structure

```
agents/
├── definitions/
│   └── astra.yaml              # Background Worker Agent (reference only)
├── tasks/
│   ├── transcript-processor.yaml   # ✅ WORKING: Extract insights from conversations
│   ├── chart-calculator.yaml       # ✅ WORKING: Generate Vedic/Western birth charts
│   ├── gamification-tracker.yaml  # 🚧 Planned
│   ├── weekly-report-generator.yaml # 🚧 Planned
│   ├── horoscope-refresher.yaml   # 🚧 Planned
│   └── persona-enrichment.yaml    # 🚧 Planned
└── README.md                   # This file
```

---

## Background Worker Agent

**File:** `definitions/astra.yaml` (reference only, not used for deployment)

**Purpose:** Execute all background tasks asynchronously

**Key Properties:**
- **Model:** Gemini 2.5 Flash (fast, cost-effective)
- **Project:** `astra` (scoped to project)
- **Never interacts with users** - only processes data
- **Returns JSON** that gets synced to MongoDB

**Environment Variable:**
```bash
BACKGROUND_WORKER_AGENT_ID=agent_xyz123
```

**Creating the Agent (One-Time Setup):**
```javascript
import { Julep } from '@julep/sdk';

const client = new Julep({ apiKey: process.env.JULEP_API_KEY });

const agent = await client.agents.create({
  name: "Astra Background Worker",
  model: "gemini-2.5-flash",
  about: "Background processing agent for Astra astrology companion",
  instructions: "Process transcripts, generate charts, and return structured JSON for MongoDB sync"
});

console.log('Agent ID:', agent.id);
// Save to .env: BACKGROUND_WORKER_AGENT_ID=agent_xyz123
```

---

## Working Tasks

### 1. Transcript Processor ✅

**File:** `tasks/transcript-processor.yaml`

**Purpose:** Extract insights, preferences, and birth data from conversation transcripts

**Trigger:** Automatic after every conversation ends

**Input:**
```typescript
{
  julep_user_id: string;
  conversation_id: string;
  transcript_text: string;
  existing_overview: object;  // Current user_overview from MongoDB
}
```

**Process:**
1. Analyze transcript with LLM (Gemini 2.5 Flash)
2. Extract birth details (time in HH:MM 24-hour, location)
3. Extract preferences (communication style, topics, Hinglish level)
4. Generate conversation summary
5. Identify key insights and incident map entries
6. Create personalized first message for next session

**Output (returned to API):**
```yaml
return:
  overview_updates:
    profile_summary: "Updated personality summary..."
    preferences: {communication_style, topics_of_interest, hinglish_level, flirt_opt_in}
    insights: [{type, content, generated_at}]
  conversation_summary:
    summary: "User discussed..."
    topics: ["intelligence", "memory"]
    key_insights: ["Working on background agents"]
    emotional_tone: "curious"
  birth_details:
    birth_time: "07:15"  # HH:MM 24-hour format
    city: "Jhajjar"
    country: "India"
    place_text: "Jhajjar, Haryana, India"
  incident_map:
    - title: "Background Agents Vision"
      description: "User detailed work on background agents..."
      tags: ["innovation", "AI"]
  first_message: "I sense those realms of intelligence..."
```

**MongoDB Sync:**
- Updates `user.birth_time`, `birth_location`, `birth_timezone`
- Updates `user_overview.preferences`
- Adds to `user_overview.recent_conversations`
- Updates `user_overview.incident_map`
- Updates `user_overview.first_message`

**API Endpoint:** `app/src/app/api/tasks/transcript/route.ts`

---

### 2. Chart Calculator ✅

**File:** `tasks/chart-calculator.yaml`

**Purpose:** Generate Vedic and Western astrology birth charts with culturally aware famous people

**Trigger:** Automatic when all birth data present (date + time + location) AND chart doesn't exist

**Input:**
```typescript
{
  birth_date: string;      // YYYY-MM-DD
  birth_time: string;      // HH:MM 24-hour
  birth_location: string;  // "City, Country"
  birth_timezone: string;  // "Asia/Kolkata"
  ayanamsha: string;       // "lahiri"
}
```

**Process:**
1. **Step 0:** Prepare context variables (CRITICAL pattern for all tasks)
2. **Steps 1-3:** Generate Vedic chart (sidereal zodiac)
   - Sun, Moon, Ascendant signs
   - 9 planets with houses, degrees, nakshatras
   - Current Dasha period
   - Chart summary
3. **Steps 4-6:** Generate Western chart (tropical zodiac)
   - Sun, Moon, Rising signs
   - 10 planets with houses, degrees
   - Major aspects
   - Chart summary
4. **Steps 7-9:** Find famous people born on same date
   - Cultural awareness (prioritize user's region)
   - 5-7 diverse categories
   - Include origin field

**Output:**
```yaml
return:
  success: true
  birth_chart:
    vedic:
      sun_sign: "Cancer"
      moon_sign: "Libra"
      ascendant: "Leo"
      planets: [{name, sign, house, degree, nakshatra, retrograde}]
      dasha: {current_mahadasha, current_antardasha, start_date}
      chart_summary: "Personality insights..."
    western:
      sun_sign: "Leo"
      moon_sign: "Aries"
      rising_sign: "Cancer"
      planets: [{name, sign, house, degree, retrograde}]
      aspects: [{type, planets, orb}]
      chart_summary: "Personality insights..."
    famous_people:
      - name: "Steve Martin"
        category: "Artist"
        known_for: "Celebrated comedian..."
        birth_year: 1945
        origin: "United States"
```

**MongoDB Sync:**
- Updates `user_overview.birth_chart` (stored permanently, never recalculated)

**API Endpoint:** `app/src/app/api/tasks/chart/route.ts`

**Fire-and-Forget:** Triggered from `transcript-processor.ts:544-608`, runs in background

---

## Creating New Tasks — Complete Guide

### Step-by-Step Process

#### 1. Create YAML Task Definition

**Location:** `agents/tasks/your-task-name.yaml`

**CRITICAL YAML Rules (Learned from Chart Calculator Debug):**

**✅ DO:**
- **Always prepare context in step 0** with `evaluate` block
- Reference variables as `{steps[N].output.variable_name}` in prompts
- **Describe JSON structure in text**, not actual JSON with braces
- Clean LLM output with `removeprefix`/`removesuffix` before parsing
- Use `$ expression` for all dynamic values
- Use `json.loads()` to parse JSON strings from LLM
- Return flat objects or use evaluate step to build nested structures
- Use string concatenation (`+`) instead of f-strings with complex expressions

**❌ DON'T:**
- Use `{_.field}` directly in prompts (won't resolve, causes f-string errors)
- Show JSON examples with curly braces `{}` in prompts (causes f-string parse errors)
- Use f-strings with quotes inside (escaping issues)
- Use `datetime.now()` in tasks (add timestamps in TypeScript instead)
- Return nested objects directly in return step
- Include `project: astra` in YAML (handled by SDK)

**Template Structure:**
```yaml
name: Your Task Name
description: Brief description

input_schema:
  type: object
  required: [field1, field2]
  properties:
    field1:
      type: string
      description: Description

main:
  # Step 0: ALWAYS prepare context first
  - evaluate:
      context_var1: $ _.field1
      context_var2: $ _.field2 or "default"
      json_context: $ json.dumps(_.object_field or {}, indent=2)

  # Step 1: LLM prompt (use steps[0].output.variable_name)
  - prompt: |-
      You are a [role]. Analyze this data.
      
      Input: {steps[0].output.context_var1}
      Context: {steps[0].output.context_var2}
      
      CRITICAL: Return ONLY valid JSON. No markdown, no code blocks.
      Do NOT wrap in backticks. Start with opening brace, end with closing brace.
      
      REQUIRED JSON STRUCTURE:
      Return a JSON object with these keys:
      - field1: string (description of field)
      - field2: array of strings
      - field3: object with subfield1 and subfield2
      
      DO NOT show JSON examples with braces - describe structure only.
    unwrap: true

  # Step 2: Clean LLM output
  - evaluate:
      cleaned: $ steps[1].output.strip().removeprefix('```json').removeprefix('```').removesuffix('```').strip()
  
  # Step 3: Parse JSON
  - evaluate:
      parsed: $ json.loads(steps[2].output.cleaned)

  # Step 4: Build result (if nested structure needed)
  - evaluate:
      result_data:
        field1: $ steps[3].output.parsed.get("field1")
        field2: $ steps[3].output.parsed.get("field2", [])

  # Step 5: Return for MongoDB sync
  - return:
      success: $ True
      data: $ steps[4].output.result_data
```

**Common Pitfalls (From Chart Calculator Debug):**

**❌ BAD - Direct variable in prompt:**
```yaml
- prompt: |-
    Birth Date: {_.birth_date}  # FAILS: f-string error
```

**✅ GOOD - Prepare in evaluate first:**
```yaml
- evaluate:
    birth_date_val: $ _.birth_date

- prompt: |-
    Birth Date: {steps[0].output.birth_date_val}  # WORKS
```

**❌ BAD - JSON example with braces:**
```yaml
- prompt: |-
    Return JSON like:
    {
      "name": "value"  # FAILS: f-string parse error
    }
```

**✅ GOOD - Describe structure:**
```yaml
- prompt: |-
    Return a JSON object with these keys:
    - name: string (person's name)
    - age: number (person's age)
```

**❌ BAD - Complex f-string:**
```yaml
- evaluate:
    text: $ f"{_.date} at {_.time} in {_.location}"  # FAILS: quote escaping
```

**✅ GOOD - String concatenation:**
```yaml
- evaluate:
    text: $ _.date + " at " + _.time + " in " + _.location
```

#### 2. Register Task in Loader

**File:** `app/src/lib/tasks/loader.ts`

```typescript
const TASK_REGISTRY = {
  TRANSCRIPT_PROCESSOR: 'transcript-processor.yaml',
  CHART_CALCULATOR: 'chart-calculator.yaml',
  YOUR_NEW_TASK: 'your-task-name.yaml',  // Add here
} as const;
```

#### 3. Create Test Script

**File:** `app/scripts/test-your-task.ts`

```typescript
import { getBackgroundWorkerAgentId, julepClient } from '@/lib/julep-client';
import { loadTaskDefinition } from '@/lib/tasks/loader';

const taskDef = loadTaskDefinition('YOUR_NEW_TASK');
const agentId = getBackgroundWorkerAgentId();

const result = await julepClient.createAndExecuteTask(
  agentId,
  taskDef,
  {
    // Task input
    field1: 'test value',
    field2: 'test value 2',
  },
  {
    maxAttempts: 60,
    intervalMs: 2000,
    onProgress: (status, attempt) => {
      console.log(`[${attempt}] Status: ${status}`);
    },
  }
);

console.log('Result:', result.status);
if (result.status === 'succeeded') {
  console.log('Output:', JSON.stringify(result.output, null, 2));
} else {
  console.error('Error:', result.error);
}

process.exit(0);
```

**Run:** `bun run scripts/test-your-task.ts`

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

  const { input_field } = await request.json();
  
  const users = getUsers();
  const user = await users.findOne({ id: session.user.id });
  
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const taskDef = loadTaskDefinition('YOUR_NEW_TASK');
  const agentId = getBackgroundWorkerAgentId();

  const result = await julepClient.createAndExecuteTask(
    agentId,
    taskDef,
    {
      input_field,
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
};
```

---

## Task Execution Flow

### Via API Endpoint (Recommended)

```typescript
// POST /api/tasks/transcript
const response = await fetch('/api/tasks/transcript', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversation_id: 'conv_abc123'
  }),
  credentials: 'include'  // Required for session auth
});

const result = await response.json();
```

### Manual Execution (For Testing)

```typescript
import { julepClient } from '@/lib/julep-client';
import { loadTaskDefinition } from '@/lib/tasks/loader';

// Load YAML definition from disk
const taskDef = loadTaskDefinition('TRANSCRIPT_PROCESSOR');

// Create task instance + execute + poll in one call
const result = await julepClient.createAndExecuteTask(
  process.env.BACKGROUND_WORKER_AGENT_ID,
  taskDef,
  {
    julep_user_id: 'user_123',
    conversation_id: 'conv_abc',
    transcript_text: 'USER: Hello...'
  },
  {
    maxAttempts: 120,  // 4 minutes max
    intervalMs: 2000,   // Poll every 2s
    onProgress: (status, attempt) => {
      console.log(`[${attempt}] ${status}`);
    }
  }
);

console.log('Output:', result.output);
```

---

## MongoDB Sync Pattern

After task completes successfully, sync output to MongoDB:

```typescript
const output = execution.output;

// Build atomic update
const updateDoc = {
  $set: {
    'user_overview.last_updated': new Date(),
    'user_overview.updated_by': execution.id
  }
};

// Add specific fields
if (output.birth_details?.birth_time) {
  updateDoc.$set.birth_time = output.birth_details.birth_time;
}

if (output.preferences) {
  updateDoc.$set['user_overview.preferences'] = {
    ...existingPreferences,
    ...output.preferences
  };
}

// Add to arrays (keep last N)
if (output.conversation_summary) {
  updateDoc.$push = {
    'user_overview.recent_conversations': {
      $each: [output.conversation_summary],
      $slice: -10  // Keep last 10
    }
  };
}

await users.updateOne({ id: userId }, updateDoc);
```

---

## Best Practices

### Task Design
- Keep tasks focused (one responsibility)
- Always return JSON for MongoDB sync
- Handle errors gracefully
- Use descriptive names for evaluate steps

### YAML Guidelines
- Consistent 2-space indentation
- Validate before commit (pre-commit hook)
- Quote strings with special chars
- Comment complex logic

### MongoDB Sync
- Use atomic updates (`$set`, `$push`)
- Preserve history with `$slice`
- Track sources (`updated_by`, `last_updated`)
- Validate data types before writing

---

## Troubleshooting

### Task Execution Fails

**Check:**
1. YAML syntax valid? (`bun x js-yaml task.yaml`)
2. Input schema matches provided data?
3. Step references correct? (`steps[N].output.field`)
4. Agent ID environment variable set?

**Debug:**
```typescript
const execution = await julepClient.getExecution(executionId);
console.log('Status:', execution.status);
console.log('Output:', execution.output);  // Shows error message
```

### MongoDB Sync Fails

**Check:**
1. User exists with `julep_user_id`?
2. Field paths match schema?
3. Data types correct?

**Debug:**
```typescript
const user = await users.findOne({ id: userId });
console.log('user_overview:', user.user_overview);
```

---

## Related Documentation

- [`AGENTS.md`](../AGENTS.md) — Complete system overview + architecture
- [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) — Technical design
- [`IMPLEMENTATION_SUMMARY.md`](../IMPLEMENTATION_SUMMARY.md) — Current status
- [`docs/PERSONA.md`](../docs/PERSONA.md) — Samay voice agent specification

---

## Summary

**Key Principles:**
1. Julep agents = Background only, never user-facing
2. Tasks return JSON that syncs to MongoDB `user_overview`
3. MongoDB is single source of truth
4. ElevenLabs agents read from MongoDB for context
5. YAML syntax matters: prepare context first, describe JSON structure

**Data Flow:**
```
User talks → ElevenLabs (with MongoDB context)
  ↓
Conversation ends → Julep task processes
  ↓
Task returns JSON → Synced to MongoDB
  ↓
Next conversation → ElevenLabs gets updated context
```

**Current Status:**
- ✅ Transcript processing (working)
- ✅ Birth chart calculation (working)
- 🚧 Gamification tracking (planned)
- 🚧 Weekly reports (planned)
- 🚧 Horoscope generation (planned)
- 🚧 Persona enrichment (planned)

---

**Built with ❤️ for Astra - Your AI Astrology Companion**
