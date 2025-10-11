# Agent Management Guide

Complete guide to managing Julep agents in the Astra platform using YAML-based configuration.

---

## Overview

Astra uses a **YAML-based infrastructure-as-code** approach for agent management. Agent configurations are defined in YAML files, version controlled, and synchronized to the Julep platform via scripts.

### Benefits

- ✅ **Version Control**: All agent configs in git
- ✅ **Reproducible**: Recreate agents from YAML files
- ✅ **Review-able**: Changes visible in git diffs
- ✅ **Easy Multi-Agent**: Add new agents by creating YAML files
- ✅ **Clear Relationships**: See agent → task mappings in `julep.yaml`

---

## Architecture

```
astra/
├── julep.yaml                          # Root project config
├── julep-lock.json                     # Agent IDs (gitignored)
├── agents/
│   ├── definitions/
│   │   ├── astra.yaml                 # Frontline agent
│   │   └── background-worker.yaml     # Background agent
│   ├── responder/
│   │   └── prompt.md                  # Detailed prompts
│   └── tasks/
│       ├── horoscope-refresher.yaml
│       └── persona-enrichment.yaml
└── app/
    └── scripts/
        └── sync-agents.ts              # Sync script
```

---

## Agent YAML Structure

### Basic Structure

```yaml
name: Agent Name
model: openrouter/anthropic/claude-sonnet-4.5
project: astra
about: >
  Brief description of the agent's purpose and personality.

instructions: |
  Detailed system instructions for the agent.
  Can be multiple lines.

metadata:
  type: frontline | background
  role: conversational_agent | task_executor
  version: "1.0"

default_settings:
  temperature: 0.7
  max_tokens: 1500
  top_p: 0.9
  frequency_penalty: 0.0
  presence_penalty: 0.0

tools:
  - name: tool_name
    description: Tool description
    type: system
    system:
      resource: user
      subresource: doc
      operation: search
```

### Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Agent display name (unique identifier) |
| `model` | Yes | LLM model (e.g., `openrouter/anthropic/claude-sonnet-4.5`) |
| `project` | Yes | Julep project name (must be "astra") |
| `about` | Yes | Brief description (1-2 sentences) |
| `instructions` | Yes | Detailed system prompt/instructions |
| `metadata` | No | Custom metadata (key-value pairs) |
| `default_settings` | No | LLM generation settings |
| `tools` | No | Array of tool definitions |

### Model Options

**OpenRouter models** (recommended for flexibility):
```yaml
model: openrouter/anthropic/claude-sonnet-4.5
model: openrouter/openai/gpt-4-turbo
model: openrouter/google/gemini-pro-1.5
```

**Direct provider models**:
```yaml
model: claude-3.5-sonnet
model: gpt-4o
model: gpt-4o-mini
```

---

## Creating a New Agent

### Step 1: Create YAML Definition

Create `agents/definitions/my-agent.yaml`:

```yaml
name: My New Agent
model: openrouter/anthropic/claude-sonnet-4.5
project: astra
about: >
  A specialized agent for [specific purpose].

instructions: |
  You are an AI agent specialized in [domain].
  
  Your responsibilities:
  - [Responsibility 1]
  - [Responsibility 2]
  
  Guidelines:
  - [Guideline 1]
  - [Guideline 2]

metadata:
  type: specialized
  domain: [domain]
  version: "1.0"

default_settings:
  temperature: 0.5
  max_tokens: 2000
```

### Step 2: Update Root Configuration

Edit `julep.yaml`:

```yaml
agents:
  - definition: agents/definitions/astra.yaml
  - definition: agents/definitions/background-worker.yaml
  - definition: agents/definitions/my-agent.yaml  # NEW

tasks:
  # Assign tasks to your new agent
  - agent_id: "{agents[2].id}"
    definition: agents/tasks/my-task.yaml
```

### Step 3: Update Sync Script (if needed)

If the agent needs special handling, update `app/scripts/sync-agents.ts`:

```typescript
const agentFiles = [
  "agents/definitions/astra.yaml",
  "agents/definitions/background-worker.yaml",
  "agents/definitions/my-agent.yaml",  // ADD THIS
];
```

### Step 4: Sync to Julep

```bash
cd app
bun run sync:agents
```

### Step 5: Update Environment

Add the new agent ID to `.env`:

```bash
ASTRA_AGENT_ID=agent_xxx
BACKGROUND_AGENT_ID=agent_yyy
MY_AGENT_ID=agent_zzz  # NEW
```

Also update code to reference the new agent:

```typescript
// app/src/lib/julep.ts
export const julepEnv = {
  // ...existing agents...
  myAgentId: process.env.MY_AGENT_ID,
};
```

---

## Updating Existing Agents

### Making Changes

1. **Edit the YAML file**:
   ```bash
   vim agents/definitions/astra.yaml
   ```

2. **Make your changes** (instructions, model, settings, etc.)

3. **Run sync script**:
   ```bash
   cd app
   bun run sync:agents
   ```

The script will **update** the existing agent (matched by name) rather than creating a new one.

### What Can Be Updated

✅ `about` - Agent description  
✅ `instructions` - System prompt  
✅ `model` - LLM model  
✅ `metadata` - Custom metadata  
✅ `default_settings` - Generation parameters  
❌ `name` - Cannot be changed (used as identifier)  
❌ `project` - Cannot be changed

### Example: Changing Model

```yaml
# Before
model: openrouter/anthropic/claude-sonnet-4.5

# After
model: openrouter/openai/gpt-4-turbo
```

Run `bun run sync:agents` and the agent will now use GPT-4 Turbo.

---

## Managing Multiple Agents

### Use Cases for Multiple Agents

1. **Specialized Domains**: Different agents for different expertise areas
2. **Different Personalities**: Formal vs casual communication styles
3. **Resource Optimization**: Cheaper models for simple tasks, expensive for complex
4. **Rate Limiting**: Distribute load across different API keys
5. **A/B Testing**: Compare different prompts or models

### Example: Multi-Agent Setup

```yaml
# julep.yaml
agents:
  - definition: agents/definitions/astra.yaml           # Frontline chat
  - definition: agents/definitions/background-worker.yaml  # Batch processing
  - definition: agents/definitions/horoscope-expert.yaml   # Specialized horoscope generation
  - definition: agents/definitions/relationship-advisor.yaml  # Relationship guidance

tasks:
  - agent_id: "{agents[2].id}"  # Horoscope expert
    definition: agents/tasks/horoscope-refresher.yaml
  
  - agent_id: "{agents[3].id}"  # Relationship advisor
    definition: agents/tasks/relationship-analysis.yaml
```

---

## Agent Tools

### System Tools

Julep provides built-in system tools for common operations:

```yaml
tools:
  # Search user documents
  - name: search_user_docs
    description: Search user documents for information
    type: system
    system:
      resource: user
      subresource: doc
      operation: search

  # Create user document
  - name: create_user_doc
    description: Create a new user document
    type: system
    system:
      resource: user
      subresource: doc
      operation: create

  # List agent documents
  - name: list_agent_docs
    description: List documents belonging to this agent
    type: system
    system:
      resource: agent
      subresource: doc
      operation: list
```

### Integration Tools

```yaml
tools:
  # Web search
  - name: web_search
    type: integration
    integration:
      provider: brave
      method: search
      setup:
        api_key: BRAVE_API_KEY  # References Julep Secret

  # Send email
  - name: send_email
    type: integration
    integration:
      provider: email
      method: send
      setup:
        host: smtp.example.com
        port: 587
        user: SMTP_USER
        password: SMTP_PASSWORD
```

### Custom Function Tools

```yaml
tools:
  - name: calculate_transit
    description: Calculate planetary transit dates
    type: function
    function:
      parameters:
        type: object
        properties:
          planet:
            type: string
            description: Planet name
          sign:
            type: string
            description: Zodiac sign
```

---

## Best Practices

### 1. Naming Conventions

- **Agent names**: PascalCase (e.g., "Astra", "Background Worker")
- **File names**: kebab-case (e.g., `astra.yaml`, `background-worker.yaml`)
- **Environment variables**: UPPER_SNAKE_CASE (e.g., `ASTRA_AGENT_ID`)

### 2. Instructions

- Be specific and detailed
- Include examples when helpful
- Define boundaries (what the agent should/shouldn't do)
- Reference user documents for context
- Specify output format if important

### 3. Metadata

Use metadata to organize agents:

```yaml
metadata:
  type: frontline | background | specialized
  role: conversational_agent | task_executor | analyst
  domain: astrology | relationships | career
  version: "1.0"
```

### 4. Temperature Settings

- **0.0-0.3**: Deterministic, consistent outputs (good for data extraction, background tasks)
- **0.4-0.7**: Balanced creativity and consistency (good for general chat)
- **0.8-1.0**: Creative, varied outputs (good for brainstorming, storytelling)

### 5. Version Control

- Commit YAML files to git
- Use meaningful commit messages: "Update Astra instructions for birth time handling"
- Tag major changes: `git tag v1.1-astra-personality-update`

### 6. Testing Changes

Before deploying to production:

1. Create a test agent (add `-test` suffix to name)
2. Test in development environment
3. Compare responses with original agent
4. If satisfied, update production agent

---

## Troubleshooting

### Issue: Agent not found after sync

**Cause:** Name mismatch or sync script error.

**Fix:**
```bash
# Check Julep dashboard for agent list
# Verify name in YAML matches exactly (case-sensitive)

# Re-run sync with verbose output:
cd app
bun run sync:agents
```

### Issue: Changes not reflected

**Cause:** Agent ID cached or Julep API delay.

**Fix:**
```bash
# Force update
bun run sync:agents

# Verify in Julep dashboard
# Restart dev server
cd app
bun run dev
```

### Issue: Model not supported

**Error:** "Model not found" or similar.

**Fix:**
Check model name format:
- OpenRouter: `openrouter/provider/model`
- Direct: `provider-model`

Verify model is available:
- OpenRouter: [openrouter.ai/models](https://openrouter.ai/models)
- Julep: [Supported models documentation](https://docs.julep.ai)

---

## CLI Alternative (Optional)

While we use the SDK-based sync script, you can also use Julep CLI:

```bash
# Install Julep CLI
npm install -g @julep/cli

# Login
julep login

# Create agent from YAML
julep agents create --definition agents/definitions/astra.yaml

# Update agent
julep agents update --id agent_xxx --definition agents/definitions/astra.yaml

# List agents
julep agents list

# Sync entire project
julep sync
```

---

## Additional Resources

- [Julep Agent Documentation](https://docs.julep.ai/concepts/agents)
- [Julep CLI Reference](https://docs.julep.ai/cli)
- [OpenRouter Models](https://openrouter.ai/models)
- [Running the App](./RUNNING_THE_APP.md)
- [Julep Implementation Guide](./JULEP_IMPLEMENTATION.md)
