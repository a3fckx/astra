# Agents Directory

> **Purpose:** Julep agent definitions and task workflows for Astra's background processing system  
> **Important:** All agents here are BACKGROUND ONLY - they never interact with users directly

---

## Overview

This directory contains:
- **Agent Definitions** (`definitions/`) - Julep agent configurations
- **Task Workflows** (`tasks/`) - YAML-defined background tasks

**Critical Understanding:**
- **ElevenLabs agents** = Frontline (talk to users)
- **Julep agents** = Background (process data, never see users)
- **MongoDB** = Source of truth (stores all results)

---

## Directory Structure

```
agents/
├── definitions/
│   └── astra.yaml              # Background Worker Agent
├── tasks/
│   ├── transcript-processor-simple.yaml
│   ├── chart-calculator.yaml
│   ├── gamification-tracker.yaml
│   ├── weekly-report-generator.yaml
│   ├── horoscope-refresher.yaml
│   └── persona-enrichment.yaml
└── README.md                   # This file
```

---

## Background Worker Agent

**File:** `definitions/astra.yaml`

**Purpose:** Execute all background tasks asynchronously

**Key Properties:**
- **Model:** Claude 3.5 Sonnet (via OpenRouter)
- **Project:** `astra` (MUST match for all resources)
- **Never interacts with users** - only processes data
- **Returns JSON** that gets synced to MongoDB

**Environment Variable:**
```bash
BACKGROUND_WORKER_AGENT_ID=agent_xyz123
```

**Creating the Agent:**
```javascript
import { Julep } from '@julep/sdk';
import fs from 'fs';
import yaml from 'yaml';

const client = new Julep({ apiKey: process.env.JULEP_API_KEY });

const agentDef = yaml.parse(fs.readFileSync('agents/definitions/astra.yaml', 'utf8'));

const agent = await client.agents.create(agentDef);

console.log('Agent ID:', agent.id);
// Save to .env: BACKGROUND_WORKER_AGENT_ID=agent_xyz123
```

---

## Task Workflows

All tasks follow this pattern:

```yaml
name: Task Name
project: astra

input_schema:
  type: object
  required: [julep_user_id, ...]
  properties:
    julep_user_id: { type: string }

tools:
  - name: search_user_docs
    type: system
    # ... tool definition

main:
  # Task steps (prompts, tool calls, evaluations)
  
  # CRITICAL: Return JSON for MongoDB sync
  - return:
      field_name: value
      nested_object:
        key: value
```

---

## Task Descriptions

### transcript-processor-simple.yaml

**Purpose:** Extract insights from conversation transcripts

**Input:**
- `julep_user_id`: Julep user ID
- `conversation_id`: ElevenLabs conversation ID
- `transcript_text`: Full transcript text

**Process:**
1. Analyze transcript with Claude
2. Extract birth details (date, time, location)
3. Extract preferences (topics, style, tone)
4. Generate conversation summary
5. Identify key insights and questions

**Output (returned to API):**
```yaml
return:
  birth_details:
    date: "1990-08-15"
    time: "14:30"
    location: "Mumbai, India"
    timezone: "Asia/Kolkata"
  preferences:
    communication_style: "casual"
    hinglish_level: "medium"
    topics_of_interest: ["career", "relationships"]
  summary: "User asked about career timing..."
  insights: ["Considering job change"]
  questions: ["When is good time for career change?"]
  topics: ["career"]
```

**MongoDB Sync:**
- Updates `user.date_of_birth`, `birth_time`, `birth_location`
- Updates `user_overview.preferences`
- Adds to `user_overview.recent_conversations`

---

### chart-calculator.yaml

**Purpose:** Generate Vedic/Western birth charts

**Input:**
- `julep_user_id`: Julep user ID
- Birth data from MongoDB (passed or queried)

**Process:**
1. Validate birth data completeness
2. Calculate planetary positions
3. Determine houses, signs, aspects
4. Generate human-readable summary

**Output:**
```yaml
return:
  birth_chart:
    system: "vedic"
    sun_sign: "Leo"
    moon_sign: "Pisces"
    rising_sign: "Gemini"
    planets:
      - name: "Sun"
        sign: "Leo"
        house: 5
        degree: "23°45'"
    chart_text: "Human-readable summary..."
    calculated_at: "2025-01-15T10:30:00Z"
```

**MongoDB Sync:**
- Updates `user_overview.birth_chart`

---

### gamification-tracker.yaml

**Purpose:** Track engagement metrics and milestones

**Input:**
- `julep_user_id`: Julep user ID
- `conversation_id`: Latest conversation
- `event_type`: Trigger type

**Process:**
1. Count total conversations from MongoDB
2. Calculate streak (consecutive days)
3. Check profile completeness
4. Detect milestone unlocks
5. Extract unique topics

**Output:**
```yaml
return:
  gamification:
    streak_days: 5
    best_streak: 7
    total_conversations: 23
    milestones_unlocked:
      - "first_conversation"
      - "streak_3"
      - "conversations_10"
    topics_explored: ["career", "relationships"]
    chart_completion_percent: 80
```

**Milestones:**
- `first_conversation`: First chat
- `streak_3`: 3-day streak
- `conversations_10`, `conversations_25`, `conversations_50`, `conversations_100`
- `full_chart`: 100% birth data
- `topic_explorer`: 5+ topics discussed

**MongoDB Sync:**
- Updates `user_overview.gamification`

---

### weekly-report-generator.yaml

**Purpose:** Create companion-style weekly summaries

**Input:**
- `julep_user_id`: Julep user ID
- `week_start_date`: Optional start date

**Process:**
1. Fetch week's conversations from Julep docs
2. Fetch week's horoscopes
3. Get gamification progress
4. Generate warm, personalized report
5. Respect user's Hinglish level

**Output:**
```yaml
return:
  weekly_report:
    week_start: "2025-01-09"
    week_end: "2025-01-15"
    content: "Full report text..."
    stats:
      conversations_this_week: 5
      topics_discussed: ["career"]
      current_streak: 7
```

**MongoDB Sync:**
- Updates `user_overview.latest_report` (if added to schema)
- Or stores in separate reports collection

---

### horoscope-refresher.yaml

**Purpose:** Generate daily personalized horoscopes

**Input:**
- `julep_user_id`: Julep user ID

**Process:**
1. Get user's birth chart from Julep docs
2. Calculate current planetary transits
3. Generate personalized predictions
4. Provide practical guidance

**Output:**
```yaml
return:
  horoscope:
    date: "2025-01-16"
    content: "Full horoscope text (2-3 paragraphs)..."
    signs:
      sun: "Leo"
      moon: "Pisces"
    transits: ["Mercury in Capricorn"]
```

**MongoDB Sync:**
- Updates `user_overview.latest_horoscope`

---

### persona-enrichment.yaml

**Purpose:** Analyze conversation patterns to enrich preferences

**Input:**
- `julep_user_id`: Julep user ID
- `min_conversations`: Minimum conversations required

**Process:**
1. Fetch all conversation notes
2. Analyze patterns (topics, tone, style)
3. Extract recurring themes
4. Update preferences

**Output:**
```yaml
return:
  preferences:
    communication_style: "casual"
    topics_of_interest: ["career", "relationships"]
    emotional_patterns: ["curious", "optimistic"]
```

**MongoDB Sync:**
- Updates `user_overview.preferences`

---

## Task Metadata Schema

All tasks write to Julep docs during processing with this metadata:

```yaml
metadata:
  type: profile | preferences | horoscope | notes | analysis | chart | gamification | reports
  scope: background  # Always "background" for task outputs
  shared: true       # Always true for cross-agent access
  updated_by: task_execution_id
  timestamp_iso: "2025-01-15T10:30:00Z"
  source: transcript | calculation | scheduled_task
```

---

## Executing Tasks

### Via API Endpoint

```javascript
// POST /api/tasks/transcript
const response = await fetch('/api/tasks/transcript', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversation_id: 'conv_abc123',
    user_id: 'user_xyz789'
  })
});

const result = await response.json();
// { success: true, task_id: '...', execution_id: '...' }
```

### Manually with Julep SDK

```javascript
import { Julep } from '@julep/sdk';
import fs from 'fs';
import yaml from 'yaml';

const client = new Julep({ apiKey: process.env.JULEP_API_KEY });

// Load task definition
const taskYaml = fs.readFileSync('agents/tasks/transcript-processor-simple.yaml', 'utf8');
const taskDef = yaml.parse(taskYaml);

// Create task
const task = await client.tasks.create(
  process.env.BACKGROUND_WORKER_AGENT_ID,
  taskDef
);

// Execute task
const execution = await client.executions.create(task.id, {
  input: {
    julep_user_id: 'julep_user_123',
    conversation_id: 'conv_abc',
    transcript_text: 'USER: Hello...'
  }
});

// Poll for completion
let result;
while (true) {
  result = await client.executions.get(execution.id);
  if (result.status === 'succeeded' || result.status === 'failed') break;
  await new Promise(resolve => setTimeout(resolve, 2000));
}

console.log('Output:', result.output);
```

---

## MongoDB Sync Pattern

After task completes, API endpoint syncs output to MongoDB:

```javascript
// In POST /api/tasks/transcript/route.ts

const execution = await julepClient.executions.get(executionId);

if (execution.status === 'succeeded') {
  const output = execution.output;
  
  // Build MongoDB update
  const updates = {
    'user_overview.last_updated': new Date(),
    'user_overview.updated_by': executionId
  };
  
  // Add birth data if extracted
  if (output.birth_details?.date) {
    updates.date_of_birth = new Date(output.birth_details.date);
    updates.birth_time = output.birth_details.time;
    updates.birth_location = output.birth_details.location;
  }
  
  // Add preferences if extracted
  if (output.preferences) {
    updates['user_overview.preferences'] = output.preferences;
  }
  
  // Add to recent conversations
  await mongoUsers.updateOne(
    { id: userId },
    {
      $set: updates,
      $push: {
        'user_overview.recent_conversations': {
          $each: [conversationSummary],
          $slice: -10  // Keep last 10
        }
      }
    }
  );
}
```

---

## YAML Validation

### Pre-commit Hook

Automatically validates YAML syntax on commit:

```bash
# Install pre-commit
pip install pre-commit
pre-commit install

# Now validates on every commit
git add agents/tasks/my-task.yaml
git commit -m "Add task"
# ↑ Auto-validates syntax
```

### Manual Validation

```bash
cd app && bun x js-yaml ../agents/tasks/my-task.yaml
```

---

## Creating New Tasks

1. **Copy existing task as template:**
   ```bash
   cp agents/tasks/transcript-processor-simple.yaml agents/tasks/my-task.yaml
   ```

2. **Edit task definition:**
   - Update `name` and `description`
   - Define `input_schema`
   - List required `tools`
   - Write `main` workflow steps
   - Ensure final `return` outputs JSON

3. **Validate syntax:**
   ```bash
   cd app && bun x js-yaml ../agents/tasks/my-task.yaml
   ```

4. **Test task:**
   ```bash
   bun run scripts/test-task.ts my-task
   ```

5. **Create API endpoint:**
   ```bash
   # Create app/src/app/api/tasks/my-task/route.ts
   ```

6. **Implement MongoDB sync:**
   - Extract task output
   - Update `user_overview` fields
   - Handle errors gracefully

---

## Best Practices

### Task Design

- **Keep tasks focused** - One responsibility per task
- **Always return JSON** - For MongoDB sync
- **Use working memory** - Julep docs for intermediate data
- **Handle errors** - Return clear error messages
- **Document metadata** - Use proper metadata schema

### YAML Guidelines

- **Consistent indentation** - 2 spaces
- **Quote special chars** - Strings with `:` or `{}`
- **Validate before commit** - Use pre-commit hook
- **Comment complex logic** - Help future maintainers

### MongoDB Sync

- **Atomic updates** - Use `$set` and `$push`
- **Preserve history** - Don't overwrite arrays
- **Track sources** - Include `updated_by`, `timestamp`
- **Validate data** - Check types before writing

---

## Troubleshooting

### Task execution fails

**Check:**
1. Task YAML syntax valid?
2. Input schema matches provided data?
3. Tools defined correctly?
4. Agent ID correct?

**Debug:**
```javascript
const execution = await client.executions.get(executionId);
console.log('Status:', execution.status);
console.log('Error:', execution.error);
```

### MongoDB sync fails

**Check:**
1. User exists in MongoDB?
2. `julep_user_id` field populated?
3. Update query correct?
4. Field paths exist?

**Debug:**
```javascript
const user = await mongoUsers.findOne({ id: userId });
console.log('user_overview:', user.user_overview);
```

### Task output wrong format

**Check:**
1. Final `return` step returns JSON?
2. Field names match expected schema?
3. Data types correct?

---

## Related Documentation

- [ARCHITECTURE.md](../docs/ARCHITECTURE.md) - Complete system design
- [FAQ.md](../docs/FAQ.md) - Common questions
- [WALKTHROUGH.md](../docs/WALKTHROUGH.md) - Step-by-step guide
- [PRACTICAL_IMPLEMENTATION.md](../docs/PRACTICAL_IMPLEMENTATION.md) - Code examples

---

## Summary

**Key Principles:**
1. Julep agents = Background only, never user-facing
2. Tasks return JSON that syncs to MongoDB
3. MongoDB `user_overview` stores all enriched data
4. ElevenLabs agents read from MongoDB for context
5. Simple, elegant, MongoDB-first architecture

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

---

**Built with ❤️ for Astra - Your AI Astrology Companion**