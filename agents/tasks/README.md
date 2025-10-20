# Astra Background Tasks

This directory contains Julep task definitions for background agent operations. These tasks run independently of user interactions and manage long-term memory, data enrichment, and scheduled updates.

## Available Tasks

### 1. Horoscope Refresher (`horoscope-refresher.yaml`)
**Purpose**: Generate daily personalized horoscopes based on user birth data.

**Trigger**: Daily cron (recommended: 6:00 AM user timezone)

**Input**:
- `julep_user_id`: The Julep user ID

**Workflow**:
1. Searches user profile for birth data
2. Generates personalized horoscope using LLM
3. Writes to user docs with `type=horoscope`, `scope=background`

**Output**: Horoscope document accessible to frontline agent

---

### 2. Persona Enrichment (`persona-enrichment.yaml`)
**Purpose**: Analyze conversation patterns and update user preferences.

**Trigger**: After every 5+ conversations or weekly

**Input**:
- `julep_user_id`: The Julep user ID
- `min_conversations`: Minimum conversations needed (default: 5)

**Workflow**:
1. Retrieves all conversation notes
2. Checks if enough data exists
3. Analyzes patterns for communication style, interests, emotional patterns
4. Updates preferences document

**Output**: Enhanced preferences document for personalized interactions

---

## Registering Tasks

### Method 1: Using Julep SDK (TypeScript)

```typescript
import { julepClient } from "@/lib/julep";
import * as fs from "fs";
import * as yaml from "yaml";

// Load task definition
const taskDef = yaml.parse(
  fs.readFileSync("agents/tasks/horoscope-refresher.yaml", "utf-8")
);

// Create task
const task = await julepClient.tasks.create({
  agentId: process.env.BACKGROUND_AGENT_ID, // Create a background agent first
  ...taskDef
});

console.log(`Task created: ${task.id}`);
```

### Method 2: Using Julep Dashboard

1. Go to https://dashboard.julep.ai
2. Navigate to your `astra` project
3. Click "Tasks" → "Create Task"
4. Upload the YAML file or paste its contents
5. Save and note the task ID

---

## Executing Tasks

### One-time Execution

```typescript
import { julepClient } from "@/lib/julep";
import { getUsers } from "@/lib/mongo";

// Get users who need horoscope updates
const users = await getUsers().find({ 
  date_of_birth: { $exists: true },
  julep_user_id: { $exists: true }
}).toArray();

// Execute task for each user
for (const user of users) {
  const execution = await julepClient.executions.create({
    taskId: HOROSCOPE_TASK_ID,
    input: {
      julep_user_id: user.julep_user_id
    }
  });
  
  console.log(`Horoscope task started for ${user.email}: ${execution.id}`);
}
```

### Scheduled Execution (Cron)

Create a cron job or scheduled function:

```typescript
// app/src/lib/scheduled-tasks.ts
export async function runDailyHoroscopes() {
  const users = await getUsers().find({
    date_of_birth: { $exists: true },
    julep_user_id: { $exists: true }
  }).toArray();

  const results = await Promise.allSettled(
    users.map(user => 
      julepClient.executions.create({
        taskId: process.env.HOROSCOPE_TASK_ID,
        input: { julep_user_id: user.julep_user_id }
      })
    )
  );

  console.log(`Horoscope updates: ${results.filter(r => r.status === 'fulfilled').length}/${users.length} succeeded`);
}

// Schedule with your preferred method (Vercel Cron, AWS EventBridge, etc.)
```

---

## Monitoring Task Execution

```typescript
// Check execution status
const execution = await julepClient.executions.get(executionId);

console.log(`Status: ${execution.status}`); // queued, running, succeeded, failed

if (execution.status === "succeeded") {
  console.log("Output:", execution.output);
} else if (execution.status === "failed") {
  console.error("Error:", execution.error);
}
```

---

## Best Practices

1. **Error Handling**: Tasks include try/catch blocks and graceful degradation
2. **Metadata Consistency**: Always use the defined metadata schema (`type`, `scope`, `shared`, etc.)
3. **Rate Limiting**: Don't execute tasks for all users simultaneously; batch in groups
4. **Monitoring**: Log task executions to track success rates
5. **Testing**: Test tasks with a single user before rolling out to all users

---

## Environment Variables

Required in `.env`:
```bash
JULEP_API_KEY=your_key
JULEP_PROJECT=astra
HOROSCOPE_TASK_ID=task_xxxxx  # After registration
PERSONA_ENRICHMENT_TASK_ID=task_xxxxx  # After registration
```

---

## Future Tasks

Potential tasks to implement:
- **Data Analyzer**: Weekly insights from conversation patterns
- **Reminder Agent**: Schedule follow-ups based on user mentions
- **Content Curator**: Find relevant articles/resources based on interests
- **Mood Tracker**: Analyze sentiment trends over time
