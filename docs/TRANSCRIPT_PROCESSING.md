# Transcript Processing System

## Overview

The transcript processing system automatically extracts insights from voice conversations and syncs them to MongoDB for continuous personalization. After each ElevenLabs conversation, the system:

1. Fetches the transcript from ElevenLabs API
2. Processes it through a Julep background task
3. Updates MongoDB with extracted insights
4. Generates a personalized first message for the next conversation

---

## Architecture

```
User ends conversation
  ↓
useVoiceConnection.onDisconnect() triggers
  ↓
POST /api/tasks/transcript
  ↓
transcript-processor.ts orchestrates:
  ↓
├─ Fetch transcript from ElevenLabs API
├─ Load task YAML from disk
├─ Create Julep task dynamically
├─ Execute task with user context
├─ Poll for completion (2s intervals)
└─ Sync results to MongoDB
  ↓
MongoDB user_overview updated:
├─ incident_map (new incidents)
├─ preferences (communication style, hinglish level)
├─ conversation_summary
├─ insights
├─ first_message (for next conversation)
└─ birth_details (if mentioned)
```

---

## Critical Implementation Learnings

### 1. Julep Task YAML Structure

**✅ CORRECT:**
```yaml
name: Task Name
description: Task description
# NO project field here

input_schema:
  type: object
  properties:
    field_name:
      type: string

main:  # NOT 'steps'
  - evaluate:
      variable_name: $ expression
  - prompt: "..."
    unwrap: true
```

**❌ INCORRECT:**
- Using `project: astra` in task definition (set at agent level, not task)
- Using `steps:` instead of `main:`
- Defining explicit MCP tools (Julep auto-discovers when needed)
- Using `if/then/else` nested blocks (causes "steps should be a valid list" error)

### 2. Step References

**✅ CORRECT:**
```yaml
- evaluate:
    my_var: $ some_value

- evaluate:
    next_var: $ steps[0].output.my_var  # Access via .output
```

**❌ INCORRECT:**
```yaml
- evaluate:
    next_var: $ steps[0].my_var  # Missing .output
```

### 3. Template Variables in Prompts

**Issue:** Julep interprets `{variable}` as template placeholders and tries to resolve them.

**✅ SOLUTION for user_name placeholder:**
```yaml
# In YAML prompt - use simple marker
- prompt: "Generate message with [USERNAME] placeholder"

# In Node.js post-processing
const newFirstMessage = extracted.first_message
  .replace(/\[USERNAME\]/g, "{{user_name}}");
```

**❌ AVOID:**
- Using `{{user_name}}` directly in prompts (Julep unescapes to `{user_name}`)
- Using `{{{{user_name}}}}` (too complex)
- Asking LLM to "use double curly braces" (inconsistent results)

### 4. JSON Format in Prompts

**Issue:** JSON examples with `{...}` cause f-string interpolation errors.

**✅ SOLUTION:**
```yaml
- prompt: |-
    Return JSON with these keys:
    - overview_updates: object with profile_summary, preferences
    - incident_map: array of objects with description, tags
    
    Do NOT include JSON examples with curly braces.
    Return ONLY valid JSON, no markdown, no explanations.
```

**❌ AVOID:**
```yaml
- prompt: |-
    Return this format:
    {
      "field": "value"  # This causes errors!
    }
```

### 5. Input Variables

**✅ CORRECT:**
```yaml
input_schema:
  properties:
    julep_user_id:
      type: string

main:
  - evaluate:
      user_id: $ steps[0].input.julep_user_id  # Access via steps[0].input
```

**❌ INCORRECT:**
```yaml
- evaluate:
    user_id: $ _.julep_user_id  # _ doesn't work in return statements
```

### 6. ElevenLabs Transcript Structure

**✅ CORRECT:**
```typescript
// Transcript is array of messages directly
const transcript = conversationData.transcript as Array<{
  message: string;
  role: 'user' | 'assistant';
}>;
```

**❌ INCORRECT (old assumption):**
```typescript
// There's no nested .messages field
const transcript = conversationData.messages; // undefined
```

---

## File Structure

### Core Files

| File | Purpose |
|------|---------|
| `agents/tasks/transcript-processor.yaml` | Julep task definition for processing transcripts |
| `app/src/lib/transcript-processor.ts` | Orchestrates task execution and MongoDB sync |
| `app/src/lib/tasks/loader.ts` | Loads YAML task definitions from disk |
| `app/src/lib/elevenlabs-api.ts` | Fetches transcripts from ElevenLabs API |
| `app/src/components/voice-session/useVoiceConnection.ts` | Triggers processing on disconnect |

### Task YAML Structure

```yaml
name: Update User Overview From Transcript
description: Process conversation transcript and extract insights

input_schema:
  type: object
  required:
    - julep_user_id
    - conversation_id  
    - transcript_text
  properties:
    julep_user_id: {type: string}
    conversation_id: {type: string}
    transcript_text: {type: string}
    existing_overview: {type: object}

main:
  # Step 0: Prepare context
  - evaluate:
      overview_json: $ json.dumps(_.existing_overview or {}, indent=2)
      transcript_context: $ _.transcript_text.strip()

  # Step 1: LLM extracts insights
  - prompt: "Extract insights from transcript..."
    unwrap: true

  # Step 2: Clean markdown code blocks
  - evaluate:
      cleaned: $ steps[1].output.strip().removeprefix('```json').removesuffix('```').strip()

  # Step 3: Parse JSON
  - evaluate:
      parsed: $ json.loads(steps[2].output.cleaned)

  # Step 4: Normalize fields
  - evaluate:
      overview_updates: $ steps[3].output.parsed.get("overview_updates", {})
      incident_map: $ steps[3].output.parsed.get("incident_map", [])

  # Step 5: Generate first message
  - prompt: "Generate first message with [USERNAME] placeholder..."
    unwrap: true

  # Step 6: Return results
  - return:
      overview_updates: $ steps[4].output.overview_updates
      incident_map: $ steps[4].output.incident_map
      first_message: $ steps[5].output.strip()
```

---

## MongoDB Schema Updates

### user_overview.incident_map

**Purpose:** Track emotionally significant moments, creative sparks, pivotal realizations for mysterious callbacks.

**Structure:**
```typescript
incident_map: Array<{
  title?: string | null;          // Optional short label
  description: string;             // 1-2 sentences with temporal context
  tags: string[];                  // Concise keywords
}>
```

**Example:**
```json
{
  "title": null,
  "description": "User explicitly defined the 'incident map' concept to track 'fleeting ideas or moments of inspiration' related to innovation, creativity, and technology aspirations.",
  "tags": ["creativity", "incident_map_concept", "user_contribution"]
}
```

**Removed Field:** `occurred_at` - Temporal information now embedded naturally in description.

### user_overview.first_message

**Purpose:** Personalized greeting for next conversation, generated by background task.

**Format:** 
- Contains `{{user_name}}` placeholder for ElevenLabs dynamic variable
- References incident_map mysteriously
- Uses user's preferred communication style

**Example:**
```
"I sense the cosmic whispers from our last talk are still resonating, {{user_name}}. Have any fleeting ideas for your 'incident map' emerged from the currents of your day, hinting at new innovation, creativity, or technology aspirations?"
```

---

## Testing

### Manual Test Script

```bash
cd app
bun run scripts/manual-transcript-test.ts <conversation_id>
```

**What it does:**
1. Fetches conversation from MongoDB
2. Fetches transcript from ElevenLabs API
3. Executes Julep task
4. Displays extracted insights, incident map, first message
5. Verifies MongoDB update

### Verification Checklist

- [ ] Transcript fetched successfully (8000+ chars expected)
- [ ] Task creates without YAML validation errors
- [ ] Task executes and returns "succeeded" status
- [ ] JSON parsing succeeds (no markdown artifacts)
- [ ] incident_map populates with 5-10 incidents
- [ ] first_message contains `{{user_name}}` placeholder
- [ ] MongoDB user_overview updates
- [ ] Next conversation starts with first_message

---

## Troubleshooting

### "steps should be a valid list"

**Cause:** Using `steps:` instead of `main:` in YAML, or using `project:` field in task.

**Fix:** Use `main:` and remove `project:` from task definition.

### "Field required: main"

**Cause:** Using `steps:` instead of `main:`.

**Fix:** Rename `steps:` to `main:` in YAML.

### "Invalid format specifier"

**Cause:** JSON example in prompt with `{...}` interpreted as f-string template.

**Fix:** Remove JSON examples from prompts, describe structure in plain text.

### "Attribute does not exist"

**Cause:** Accessing step output incorrectly (e.g., `steps[0].field` instead of `steps[0].output.field`).

**Fix:** Always use `steps[X].output.field_name`.

### Task fails with "Expecting value: line 1 column 1"

**Cause:** LLM returned non-JSON (explanation text or markdown code blocks).

**Fix:** Add explicit instructions: "Return ONLY valid JSON, no markdown, no explanations." Also strip markdown code blocks before parsing.

### First message has [USERNAME] instead of {{user_name}}

**Cause:** Missing post-processing replacement.

**Fix:** Ensure `transcript-processor.ts` replaces `[USERNAME]` with `{{user_name}}`.

---

## Best Practices

### 1. Prompt Engineering for JSON

```yaml
- prompt: |-
    CRITICAL: Return ONLY valid JSON, no explanations, no markdown.
    Start with { and end with }.
    Do NOT wrap in ```json code blocks.
```

### 2. Step References

Always access via `.output`:
```yaml
- evaluate:
    my_data: $ steps[2].output.parsed.get("field", {})
```

### 3. Error Handling

Check execution status:
```typescript
if (result.status !== "succeeded") {
  throw new Error(result.error || "Task execution failed");
}
```

### 4. Placeholder Strategy

Use simple markers that won't be interpreted:
- `[USERNAME]` for user name
- `[DATE]` for dates
- Replace in post-processing

### 5. Task Reusability

Load YAML from disk, create task on-demand:
```typescript
const taskDef = loadTaskDefinition('TRANSCRIPT_PROCESSOR');
const task = await julepClient.tasks.create(agentId, taskDef);
const execution = await julepClient.executions.create(task.id, {input: {...}});
```

---

## Future Improvements

- [ ] Add Memory Store MCP integration for long-term storage
- [ ] Implement chart calculation task (chart-calculator.yaml needs same fixes)
- [ ] Add gamification update task
- [ ] Implement weekly report generation
- [ ] Add horoscope refresh task
- [ ] Optimize: Cache task IDs instead of creating new tasks each time
- [ ] Add retry logic with exponential backoff
- [ ] Implement partial updates (only changed fields)

---

## Related Documentation

- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) - Overall system architecture
- [`docs/FAQ.md`](./FAQ.md) - Common questions
- [`agents/README.md`](../agents/README.md) - Agent definitions
- [`app/docs/responder.md`](../app/docs/responder.md) - ElevenLabs agent prompt
