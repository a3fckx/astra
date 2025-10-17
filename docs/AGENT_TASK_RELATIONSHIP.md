# Agent and Task Relationship in Julep

## The Key Question: Where Do We Call the Agent?

**Short Answer:** We call the agent **implicitly** when we create a task. The agent ID is passed to `createTask()`, which binds the task to that agent.

## How It Works

### 1. Agent (Created Once)

The agent is created **one time** (manually or via script) and its ID is stored in environment variables.

```typescript
// ONE-TIME SETUP (not in code, done manually or via setup script)
const agent = await julepClient.agents.create({
  name: "Astra Background Worker",
  model: "gemini-2.5-flash",
  project: "astra",
  about: "Background processing agent for Astra...",
  instructions: "You are a background processor..."
});

// Returns: { id: "agent_abc123", ... }
// Store this ID in .env file:
// BACKGROUND_WORKER_AGENT_ID=agent_abc123
```

**Agent Definition Reference:** `agents/definitions/astra.yaml`
- This YAML file documents what the agent should look like
- NOT used for deployment or runtime
- Useful for manual creation/updates via Julep dashboard

### 2. Task (Created Every Time)

Tasks are created **dynamically** from YAML definitions each time we need to run a workflow.

```typescript
// RUNTIME - Every Request
// 1. Load task definition from YAML
const taskDef = loadTaskDefinition('CHART_CALCULATOR');
// Reads: agents/tasks/chart-calculator.yaml

// 2. Get agent ID from environment
const agentId = getBackgroundWorkerAgentId();
// Returns: "agent_abc123" from env var

// 3. Create task instance FOR THIS AGENT
const task = await julepClient.createTask(agentId, taskDef);
//                                         ^^^^^^^ AGENT CALLED HERE!
// Returns: { id: "task_xyz789", agent_id: "agent_abc123", ... }

// 4. Execute the task (which runs on the agent)
const execution = await julepClient.executeTask(task.id, { input: {...} });
```

## The Relationship

```
┌─────────────────────────────────────────────────────────────┐
│                         JULEP AGENT                          │
│                  (Created once, ID in env)                   │
│                                                               │
│  ID: agent_abc123                                            │
│  Model: gemini-2.5-flash                                     │
│  Instructions: "You are a background processor..."           │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                     TASK INSTANCE 1                    │  │
│  │  (Created from chart-calculator.yaml)                 │  │
│  │                                                         │  │
│  │  ID: task_001                                          │  │
│  │  Agent ID: agent_abc123  ← Bound to this agent       │  │
│  │  Input: {birth_date: "1990-08-15", ...}              │  │
│  │  Execution: exec_001                                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                     TASK INSTANCE 2                    │  │
│  │  (Created from transcript-processor.yaml)             │  │
│  │                                                         │  │
│  │  ID: task_002                                          │  │
│  │  Agent ID: agent_abc123  ← Same agent!               │  │
│  │  Input: {transcript_text: "...", ...}                │  │
│  │  Execution: exec_002                                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                     TASK INSTANCE 3                    │  │
│  │  (Created from gamification-tracker.yaml)             │  │
│  │                                                         │  │
│  │  ID: task_003                                          │  │
│  │  Agent ID: agent_abc123  ← Same agent!               │  │
│  │  Input: {conversation_id: "...", ...}                │  │
│  │  Execution: exec_003                                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Code Flow with Agent

### In Chart Calculation API

```typescript
// app/src/app/api/tasks/chart/route.ts

export async function POST(request: Request) {
  // ... validation ...

  // Load task definition from YAML
  const taskDef = loadTaskDefinition("CHART_CALCULATOR");
  
  // ⭐ GET AGENT ID - This is where we "call" the agent
  const agentId = getBackgroundWorkerAgentId();
  // Returns: "agent_abc123" from env var BACKGROUND_WORKER_AGENT_ID
  
  // Create task instance bound to this agent
  const result = await julepClient.createAndExecuteTask(
    agentId,  // ← AGENT IS REFERENCED HERE
    taskDef,
    {
      birth_date: birthDate,
      birth_time: birthTime,
      // ... input ...
    }
  );
  
  // Agent executes the task and returns result
  // result.output contains the chart data
}
```

### Inside createAndExecuteTask

```typescript
// app/src/lib/julep-client.ts

async createAndExecuteTask(
  agentId: string,  // ← Agent ID passed in
  taskDefinition: unknown,
  input: Record<string, unknown>,
  pollOptions?: PollOptions
) {
  // 1. Create task FOR THIS AGENT
  const task = await this.createTask(agentId, taskDefinition);
  //                                  ^^^^^^^ Agent bound to task here
  
  // 2. Execute the task (runs on the agent)
  const result = await this.executeTask(task.id, { input, pollOptions });
  
  return result;
}

async createTask(agentId: string, taskDefinition: unknown) {
  // Julep SDK call - binds task to agent
  const task = await this.client.tasks.create(agentId, taskDefinition);
  //                                           ^^^^^^^ Agent ID used here
  
  return task;
}
```

### Inside Julep SDK (conceptual)

```typescript
// @julep/sdk (Julep's SDK - not our code)

class TasksClient {
  async create(agentId: string, definition: TaskDefinition) {
    // POST to Julep API
    const response = await fetch('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: agentId,  // ← Agent associated with task
        definition: definition,
        project: 'astra'
      })
    });
    
    return response.data; // { id: "task_xyz", agent_id: "agent_abc123" }
  }
}

class ExecutionsClient {
  async create(taskId: string, options: ExecutionOptions) {
    // Julep backend knows which agent to use from task.agent_id
    // Runs the task steps using the agent's model and instructions
    
    // The agent processes:
    // - Uses its configured model (gemini-2.5-flash)
    // - Follows its instructions
    // - Executes each step in the task YAML
    // - Returns structured output
  }
}
```

## Where Agent is "Called"

The agent is implicitly invoked at these points:

### 1. Task Creation
```typescript
const task = await julepClient.createTask(agentId, taskDef);
//                                        ^^^^^^^ Agent bound here
```

### 2. Task Execution
```typescript
const execution = await julepClient.executeTask(task.id, options);
// Julep backend knows task.agent_id and uses that agent to run the workflow
```

## Environment Variables

```bash
# .env file
BACKGROUND_WORKER_AGENT_ID=agent_abc123  # Created once in Julep
ASTRA_AGENT_ID=agent_abc123              # Fallback (same agent)
```

### How Agent ID is Retrieved

```typescript
// app/src/lib/julep-client.ts

export function getBackgroundWorkerAgentId(): string {
  const agentId = env.backgroundWorkerAgentId || env.astraAgentId;
  
  if (!agentId) {
    throw new Error("Background worker agent ID not configured");
  }
  
  return agentId; // "agent_abc123"
}
```

### Used Everywhere

```typescript
// Chart calculation
const agentId = getBackgroundWorkerAgentId();
const result = await julepClient.createAndExecuteTask(agentId, taskDef, input);

// Transcript processing
const agentId = getBackgroundWorkerAgentId();
const result = await julepClient.createAndExecuteTask(agentId, taskDef, input);

// Gamification
const agentId = getBackgroundWorkerAgentId();
const result = await julepClient.createAndExecuteTask(agentId, taskDef, input);

// All tasks use the SAME agent!
```

## Key Concepts

### Agent = Worker
- Created once
- Has a model (gemini-2.5-flash)
- Has instructions (general guidelines)
- Can run many different tasks

### Task = Job Definition
- Created every time we need to run a workflow
- Defines specific steps to execute
- Bound to an agent at creation time
- Receives specific input data

### Execution = Job Run
- One instance of running a task
- Uses the task's bound agent
- Processes the input
- Returns output

## Analogy

Think of it like a restaurant:

```
Agent = Chef (skilled worker)
  - Has expertise and tools
  - Can cook many dishes
  - Follows general cooking principles

Task = Recipe (specific instructions)
  - Defines steps to make a specific dish
  - Given to the chef to execute
  - New recipe instance for each order

Execution = Cooking Instance
  - Chef follows the recipe
  - Uses specific ingredients (input)
  - Produces a dish (output)
```

In Astra:
- **1 Chef (Agent):** Background Worker Agent
- **5 Recipes (Tasks):** transcript-processor, chart-calculator, gamification-tracker, horoscope-refresher, weekly-report
- **Many Cooking Instances (Executions):** Every time a user ends a conversation, needs a chart, etc.

## Summary

**Q: Where do we call the agent?**

**A:** We call the agent when we create a task:
```typescript
const agentId = getBackgroundWorkerAgentId(); // Get agent ID from env
const task = await julepClient.createTask(agentId, taskDef); // Bind task to agent
```

**The agent is never called directly.** Instead:
1. We load a task definition (YAML)
2. We create a task instance bound to the agent
3. We execute the task
4. Julep backend uses the agent to run the task

**All our tasks use the same agent** (Background Worker Agent), but each task defines different workflows and produces different outputs.
