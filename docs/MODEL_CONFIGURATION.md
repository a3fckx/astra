# Model Configuration Guide

## Overview

Astra supports flexible model configuration via environment variables. You can override the model for all agents or keep per-agent models in YAML files.

---

## Environment Variable Configuration

### Primary Model Variable

**`ASTRA_MODEL`** - Specifies the LLM model to use for all agents

**Location**: `app/.env`

```bash
# Override model for all agents
ASTRA_MODEL=openrouter/anthropic/claude-4.5-sonnet
```

### How It Works

1. **Sync script reads `ASTRA_MODEL`** from environment
2. **If set**: Uses this model for ALL agents (overrides YAML)
3. **If not set**: Uses model specified in each agent's YAML file

### Priority Order

```
1. ASTRA_MODEL environment variable (highest priority)
   ↓
2. model field in agent YAML file (fallback)
```

---

## Supported Models

### OpenRouter Models (via OpenRouter API)

**Format**: `openrouter/provider/model-name`

**Examples**:
```bash
# Anthropic Claude
ASTRA_MODEL=openrouter/anthropic/claude-4.5-sonnet
ASTRA_MODEL=openrouter/anthropic/claude-opus-4

# OpenAI GPT
ASTRA_MODEL=openrouter/openai/gpt-4o
ASTRA_MODEL=openrouter/openai/gpt-4-turbo

# Google Gemini
ASTRA_MODEL=openrouter/google/gemini-2.5-pro

# Meta Llama
ASTRA_MODEL=openrouter/meta-llama/llama-4-scout
```

**Requirements**:
- `OPENROUTER_API_KEY` must be set in `.env`
- API key stored in Julep Secrets (sync script does this)

### Direct Julep Models

**Format**: `model-name` (no prefix)

**Examples**:
```bash
# Claude models (direct via Julep)
ASTRA_MODEL=claude-sonnet-4-5
ASTRA_MODEL=claude-opus-4

# OpenAI models
ASTRA_MODEL=gpt-4o
ASTRA_MODEL=gpt-4o-mini

# Google models
ASTRA_MODEL=gemini-2.5-pro
```

**Requirements**:
- Julep handles API keys internally
- May be billed through Julep account

---

## Configuration Examples

### Scenario 1: Use OpenRouter for All Agents

```bash
# app/.env
ASTRA_MODEL=openrouter/anthropic/claude-4.5-sonnet
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
```

### Scenario 2: Use Direct Julep Models

```bash
# app/.env
ASTRA_MODEL=claude-sonnet-4-5
# No OpenRouter key needed
```

### Scenario 3: Different Models per Agent

**Don't set `ASTRA_MODEL`**, instead configure in YAML:

```yaml
# agents/definitions/astra.yaml
model: openrouter/anthropic/claude-4.5-sonnet

# agents/definitions/background-worker.yaml
model: gpt-4o-mini  # Cheaper model for background tasks
```

### Scenario 4: Testing Different Models

Easily switch models without editing YAML:

```bash
# Try Claude
ASTRA_MODEL=openrouter/anthropic/claude-4.5-sonnet
bun run sync:agents

# Try GPT-4
ASTRA_MODEL=openrouter/openai/gpt-4o
bun run sync:agents

# Try Gemini
ASTRA_MODEL=openrouter/google/gemini-2.5-pro
bun run sync:agents
```

---

## Verifying Model Configuration

### Check What Model Will Be Used

Run sync script and look for output:

```bash
cd app
bun run sync:agents
```

**Output**:
```
🤖 Processing agent: Astra
   🔧 Using model from ASTRA_MODEL env: openrouter/anthropic/claude-4.5-sonnet
   ↻ Updating existing agent (agent_xxxxx)
   ✓ Updated successfully
```

**OR** (if ASTRA_MODEL not set):
```
🤖 Processing agent: Astra
   📦 Using model from YAML: openrouter/anthropic/claude-4.5-sonnet
   + Creating new agent
   ✓ Created with ID: agent_xxxxx
```

### Verify in Julep Dashboard

1. Go to [dashboard.julep.ai](https://dashboard.julep.ai)
2. Navigate to project `astra`
3. Click on agent (e.g., "Astra")
4. Check "Model" field

---

## Best Practices

### 1. Use Environment Variable for Consistency

**Recommended**: Set `ASTRA_MODEL` in `.env` for consistent model across all agents

```bash
ASTRA_MODEL=openrouter/anthropic/claude-4.5-sonnet
```

### 2. Document Model Choice

Add comment in `.env` explaining why you chose this model:

```bash
# Using Claude 4.5 Sonnet for best reasoning + Hinglish support
ASTRA_MODEL=openrouter/anthropic/claude-4.5-sonnet
```

### 3. Cost Optimization

Use cheaper models for background tasks:

**Option A**: Set per-agent in YAML (don't use ASTRA_MODEL)

```yaml
# Astra - premium model
model: openrouter/anthropic/claude-4.5-sonnet

# Background Worker - budget model
model: gpt-4o-mini
```

**Option B**: Use separate sync for different agents (advanced)

### 4. Test Before Production

Always test model changes in development:

```bash
# Development
ASTRA_MODEL=openrouter/anthropic/claude-4.5-sonnet
bun run sync:agents
bun run dev
# Test conversations

# If good, deploy to production with same model
```

---

## Finding Model Identifiers

### OpenRouter Models

**Browse**: [openrouter.ai/models](https://openrouter.ai/models)

**Format**: `openrouter/provider/model-id`

Example:
- Display name: "Claude 4.5 Sonnet"
- Identifier: `openrouter/anthropic/claude-4.5-sonnet`

### Julep Direct Models

**Check error message** when sync fails - it lists available models:

```
Available models: ['claude-sonnet-4-5', 'gpt-4o', 'gemini-2.5-pro', ...]
```

**Or check**: Julep documentation at [docs.julep.ai](https://docs.julep.ai)

---

## Troubleshooting

### Issue: Model not found

**Error**: `Model xxx not available`

**Fix**: Check model identifier format
- OpenRouter: Must start with `openrouter/`
- Direct: Check against available models list

### Issue: Authentication error

**Error**: `401 Unauthorized` or similar

**Fix**: 
1. For OpenRouter models: Verify `OPENROUTER_API_KEY` is set
2. Check Julep Secrets has the API key:
   - Go to dashboard.julep.ai → Secrets
   - Verify `OPENROUTER_API_KEY` exists

### Issue: Different models for different agents

**Solution**: Don't set `ASTRA_MODEL`, configure per-agent in YAML

---

## Advanced: Per-Environment Models

Use different models for dev/staging/production:

```bash
# .env.development
ASTRA_MODEL=gpt-4o-mini  # Cheaper for testing

# .env.production
ASTRA_MODEL=openrouter/anthropic/claude-4.5-sonnet  # Best quality

# .env.staging
ASTRA_MODEL=openrouter/anthropic/claude-opus-4  # Latest features
```

---

## Quick Reference

| Use Case | Configuration | Example |
|----------|---------------|---------|
| Same model for all agents | Set `ASTRA_MODEL` in `.env` | `ASTRA_MODEL=openrouter/anthropic/claude-4.5-sonnet` |
| Different models per agent | Leave `ASTRA_MODEL` unset, use YAML | `model:` in each YAML file |
| Test different models | Change `ASTRA_MODEL`, re-sync | Switch value, run `bun run sync:agents` |
| Use OpenRouter | Set `OPENROUTER_API_KEY` | Required for `openrouter/` prefix models |
| Use Julep direct | No API key needed | Models without prefix |

---

**Documentation**: [docs/RUNNING_THE_APP.md](./RUNNING_THE_APP.md)  
**Agent Management**: [docs/AGENT_MANAGEMENT.md](./AGENT_MANAGEMENT.md)
