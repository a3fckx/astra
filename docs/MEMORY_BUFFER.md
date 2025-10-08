# Memory Buffer — Field Reference

## Overview

The memory buffer (`buffer/memory_buffer.json`) is a structured JSON document that holds per-user context for conversations. All fields are injected as dynamic variables into the agent prompt via `{{placeholder}}` replacement.

**Purpose:**
- Personalize every conversation turn with user-specific context
- Maintain continuity across sessions
- Enable read-only agent design (no external tool calls needed)
- Support incremental updates via file watcher or API

**File Location:** `buffer/memory_buffer.json`

**Flow:**
```
1. Load JSON → Python dict
2. Convert to string map (stringify dicts/lists)
3. Render prompt template (replace {{placeholders}})
4. Send to ElevenLabs as dynamic_variables
```

---

## Field Specifications

### `pinned_facts` (object)

**Purpose:** Core birth details for astrological calculations

**Type:** Object (stringified when injected)

**Schema:**
```json
{
  "name": "string",
  "system": "vedic|western",
  "ayanamsha": "Lahiri|KP|...",
  "birth_date": "YYYY-MM-DD",
  "birth_time": "HH:mm (24-hour format)",
  "birth_place": "City, Country",
  "timezone": "IANA timezone (e.g., Asia/Kolkata)"
}
```

**Example:**
```json
{
  "name": "Aarav",
  "system": "vedic",
  "ayanamsha": "Lahiri",
  "birth_date": "1996-05-14",
  "birth_time": "07:20",
  "birth_place": "Mumbai, India",
  "timezone": "Asia/Kolkata"
}
```

**Update frequency:** Rarely (only when user corrects or adds birth details)

**Usage in prompt:**
```markdown
• pinned_facts: {{pinned_facts}}
```

**Agent behavior:**
- If empty → Trigger seeding flow
- If partial → Ask for missing fields (reference `missing_fields`)
- If complete → Use for all astrological guidance

---

### `astro_snapshot` (string)

**Purpose:** Current astrological overview for the user (planetary positions, transits, insights)

**Type:** String (Markdown-friendly)

**Format:** Human-readable text, optionally with Markdown formatting

**Example:**
```
Sun: Taurus; Moon: Virgo; Asc: Gemini; Mercury Rx: Taurus

Current transits: Mars in 3rd house (communication), Jupiter favorable
for growth. Saturn heavy—advise rest and small steps.
```

**Alternative format (Markdown table):**
```markdown
# Sun in Leo

| Planet   | Sign     | House |
|----------|----------|-------|
| Sun      | Leo      | 5     |
| Moon     | Virgo    | 6     |
| Asc      | Gemini   | 1     |

**Insights:** Creative energy peaks; Jupiter transit favorable for growth.
```

**Update frequency:** Weekly or when transits change significantly

**Usage in prompt:**
```markdown
• astro_snapshot: {{astro_snapshot}}
```

**Agent behavior:**
- If empty → Cannot provide astrological guidance; may trigger WAIT
- If present → Reference specific placements in responses
- Use as foundation for all astrological insights

---

### `user_preferences` (object)

**Purpose:** Personalization settings for tone, language, and boundaries

**Type:** Object (stringified when injected)

**Schema:**
```json
{
  "tone": "warm|professional|casual|...",
  "pacing": "concise|detailed",
  "hinglish_level": 0.0-1.0,
  "flirt_opt_in": boolean
}
```

**Example:**
```json
{
  "tone": "warm",
  "pacing": "concise",
  "hinglish_level": 0.35,
  "flirt_opt_in": false
}
```

**Field details:**

- **`tone`**
  - Values: `"warm"`, `"professional"`, `"casual"`, `"playful"`
  - Default: `"warm"`
  - Agent mirrors this in response style

- **`pacing`**
  - Values: `"concise"` (2-5 sentences), `"detailed"` (can expand)
  - Default: `"concise"`
  - Controls response length

- **`hinglish_level`**
  - Range: `0.0` (pure English) to `1.0` (heavy Hindi mixing)
  - Default: `0.35` (30-40% code-switching)
  - Agent adjusts code-switching frequency

- **`flirt_opt_in`**
  - Values: `true` (enable affectionate tone), `false` (professional only)
  - Default: `false`
  - Gates pet names, playful romantic hints (see [docs/PERSONA.md](PERSONA.md))

**Update frequency:** Occasionally (when user requests tone adjustment)

**Usage in prompt:**
```markdown
• user_preferences: {{user_preferences}}
```

---

### `conversation_focus` (string)

**Purpose:** Current conversation context or goal

**Type:** String

**Example:**
```
"weekly planning"
"career decision about job offer"
"relationship advice"
"stress management"
```

**Update frequency:** Per conversation or when topic shifts significantly

**Usage in prompt:**
```markdown
• conversation_focus: {{conversation_focus}}
```

**Agent behavior:**
- Grounds responses in current context
- Ties astrological insights to focus area
- Helps maintain conversation coherence

---

### `recent_messages` (array)

**Purpose:** Conversation history slice for context continuity

**Type:** Array of objects

**Schema:**
```json
[
  {"role": "user|assistant", "text": "string"},
  {"role": "user|assistant", "text": "string"}
]
```

**Example:**
```json
[
  {"role": "user", "text": "Hi Jadugar, can you read my chart?"},
  {"role": "assistant", "text": "Absolutely—do you have your birth time in HH:mm (24h)?"},
  {"role": "user", "text": "Yes, it's 07:20 in Mumbai."},
  {"role": "assistant", "text": "Great. What's your goal for this week?"}
]
```

**Size limit:** Configurable via `recent_max` in config.json (default: 10 messages)

**Update frequency:** Every turn (managed by runner)

**Usage in prompt:**
```markdown
• recent_messages: {{recent_messages}}
```

**Agent behavior:**
- Reference previous exchanges naturally
- Avoid repetition
- Build on prior context

**Note:** For longer history, agent can call `getConversationHistory` tool if user explicitly asks for recap.

---

### `missing_fields` (array)

**Purpose:** List of data still needed from user

**Type:** Array of strings

**Example:**
```json
["birth_time", "timezone"]
```

**Possible values:**
- `"birth_date"`
- `"birth_time"`
- `"birth_place"`
- `"timezone"`
- `"system"` (western vs vedic)
- `"ayanamsha"` (if vedic)
- `"name"`

**Update frequency:** As user provides information

**Usage in prompt:**
```markdown
• missing_fields: {{missing_fields}}
```

**Agent behavior:**
- If non-empty → Ask for ONE field at a time (or use seeding flow if multiple missing)
- If empty → Proceed with full astrological guidance
- Do NOT ask for fields not in this list

---

### `latest_user_message` (string)

**Purpose:** The most recent message from the user

**Type:** String

**Example:**
```
"Big presentation Thursday—how should I pace prep?"
```

**Update frequency:** Every user turn (managed by runner)

**Usage in prompt:**
```markdown
• latest_user_message: {{latest_user_message}}
```

**Agent behavior:**
- Primary input to respond to
- Cross-reference with context fields for personalized response

---

### `prefilled_response` (string or null)

**Purpose:** Pre-composed response from background agent (bypasses normal generation)

**Type:** String or null

**Example:**
```json
"prefilled_response": "Your Mars transit analysis is ready: Energy peaks on Thursday—perfect for your presentation!"
```

**Update frequency:** Rarely (only when background agent composes specific response)

**Usage in prompt:**
```markdown
• prefilled_response (optional): {{prefilled_response}}
```

**Agent behavior:**
- If non-empty → Return value **verbatim**, no modifications, no questions
- If empty/null → Generate response normally

**Use case:** Background agent analyzes something complex (e.g., transit predictions) and pre-writes response for consistency.

---

## Update Patterns

### Manual Edit (Development)

**When:** Testing, debugging, quick changes

**How:**
1. Edit `buffer/memory_buffer.json` directly
2. If file watcher enabled, agent receives contextual update automatically
3. If not, changes apply at next session start

**Best for:** Local development, prototyping

---

### File Watcher (Automatic)

**When:** Development mode, simple deployments

**How:**
1. Enable in config.json: `"watch_memory_updates": true`
2. Set poll interval: `"watch_interval_ms": 1500`
3. Runner monitors file for changes
4. On change, sends `contextual_update` event with brief summary

**Config:**
```json
{
  "watch_memory_updates": true,
  "watch_interval_ms": 1500
}
```

**Example flow:**
1. External script updates `astro_snapshot` field
2. File watcher detects change
3. Sends: `{"type": "contextual_update", "text": "astro_snapshot updated: Mars transit in 3rd house"}`
4. Agent incorporates in next response

**Best for:** Single-user development, prototyping

---

### Update Queue (Multi-Agent)

**When:** Multiple processes need to coordinate updates

**How:**
1. Enable in config.json: `"enable_updates_queue": true`
2. Set queue path: `"updates_queue_path": "buffer/updates.ndjson"`
3. Append updates to NDJSON file
4. Runner reads and sends to active conversation

**CLI:**
```bash
python scripts/elevenlabs_agent_runner.py --enqueue-update "New insight: Jupiter favorable"
```

**With conversation targeting:**
```bash
python scripts/elevenlabs_agent_runner.py \
  --enqueue-update "Chart updated" \
  --conversation-id "conv_abc123"
```

**Queue format (NDJSON):**
```json
{"conversation_id": "conv_abc123", "text": "astro_snapshot updated"}
{"conversation_id": null, "text": "System-wide update"}
```

**Best for:** Production, multi-agent systems, background processors

---

### API Endpoint (Planned)

**When:** Production, external systems, webhooks

**How:**
1. FastAPI endpoint: `POST /api/users/{user_id}/context`
2. Update MongoDB document
3. If active session exists, push contextual update
4. Return success

**Example:**
```bash
curl -X POST https://astra.example.com/api/users/user123/context \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "astro_snapshot": "Updated transit info",
    "conversation_focus": "new goal"
  }'
```

**Best for:** Production deployments, scalable multi-user

---

## Best Practices

### Initialization (Session Start)

**Do:**
- Load complete buffer before starting conversation
- Validate required fields (especially `pinned_facts` for astrology)
- Set sensible defaults if fields missing

**Don't:**
- Start with empty buffer (leads to repetitive seeding questions)
- Inject massive data blobs (keep variables compact, a few KB max)

---

### Mid-Session Updates

**Do:**
- Use `contextual_update` events for incremental changes
- Keep update text brief (1-2 sentences)
- Update only changed fields, not entire buffer
- Time updates to natural conversation pauses

**Don't:**
- Send updates every turn (overwhelming)
- Include meta-information ("System updated..." → Just say "Mars transit active")
- Re-send entire buffer (use contextual updates for deltas)

---

### Variable Stringification

**Rules applied by runner:**
- `dict` or `list` → `json.dumps(value, ensure_ascii=False)`
- `None` → `""` (empty string)
- Everything else → `str(value)`

**Example:**
```python
# Input
{
  "pinned_facts": {"name": "Aarav", "birth_date": "1996-05-14"},
  "astro_snapshot": "Sun: Taurus",
  "missing_fields": []
}

# Stringified
{
  "pinned_facts": '{"name": "Aarav", "birth_date": "1996-05-14"}',
  "astro_snapshot": "Sun: Taurus",
  "missing_fields": "[]"
}
```

**Why:** ElevenLabs `dynamic_variables` only accept string values

---

### Size Considerations

**Limits:**
- Total buffer size: Keep under 10KB (a few KB is ideal)
- Individual string fields: ~1-2KB max
- Recent messages: 10-20 messages max (configurable)

**If data is large:**
- Summarize in `context` field
- Store full details in MongoDB
- Provide only essential context in buffer

---

### Context Continuity

**Maintain across sessions:**
- Store buffer in MongoDB per user (planned)
- Load at session start
- Update during conversation
- Persist on session end

**Current (single-user):**
- Buffer lives in `buffer/memory_buffer.json`
- Manually updated or via file watcher
- No automatic persistence

**Future (multi-user):**
- Each user has MongoDB document
- Buffer loaded from DB at session init
- Updates saved to DB in real-time
- Sessions table tracks active conversations

---

## Validation

### Required for Basic Conversation
- `user_preferences` (can use defaults)
- `conversation_focus` (can be generic)
- `latest_user_message` (always present)

### Required for Astrology Guidance
- `pinned_facts.birth_date` (minimum)
- `pinned_facts.system` (western vs vedic)
- `astro_snapshot` (computed from birth details)

### Optional but Recommended
- `pinned_facts.birth_time` (improves accuracy)
- `pinned_facts.birth_place` (for house calculations)
- `pinned_facts.timezone` (for precise timing)
- `recent_messages` (for context continuity)

### Validation Script (Planned)

```python
def validate_buffer(buffer: dict) -> tuple[bool, list[str]]:
    """Validate buffer completeness and return (valid, errors)"""
    errors = []

    if not buffer.get("pinned_facts"):
        errors.append("Missing pinned_facts")
    elif not buffer["pinned_facts"].get("birth_date"):
        errors.append("Missing birth_date in pinned_facts")

    if not buffer.get("astro_snapshot"):
        errors.append("Missing astro_snapshot")

    if not buffer.get("user_preferences"):
        errors.append("Missing user_preferences")

    return (len(errors) == 0, errors)
```

---

## Examples

### Complete Buffer (Ideal State)
```json
{
  "pinned_facts": {
    "name": "Aarav",
    "system": "vedic",
    "ayanamsha": "Lahiri",
    "birth_date": "1996-05-14",
    "birth_time": "07:20",
    "birth_place": "Mumbai, India",
    "timezone": "Asia/Kolkata"
  },
  "astro_snapshot": "Sun: Taurus; Moon: Virgo; Asc: Gemini; Mercury Rx: Taurus. Mars transit in 3rd house (communication energy). Jupiter favorable for growth.",
  "user_preferences": {
    "tone": "warm",
    "pacing": "concise",
    "hinglish_level": 0.35,
    "flirt_opt_in": false
  },
  "conversation_focus": "weekly planning",
  "recent_messages": [
    {"role": "user", "text": "Hi Jadugar, can you read my chart?"},
    {"role": "assistant", "text": "Absolutely—do you have your birth time in HH:mm (24h)?"},
    {"role": "user", "text": "Yes, it's 07:20 in Mumbai."},
    {"role": "assistant", "text": "Great. What's your goal for this week?"}
  ],
  "missing_fields": [],
  "latest_user_message": "Big presentation Thursday—how should I pace prep?",
  "prefilled_response": null
}
```

### Minimal Buffer (First-Time User)
```json
{
  "pinned_facts": {},
  "astro_snapshot": "",
  "user_preferences": {
    "tone": "warm",
    "pacing": "concise",
    "hinglish_level": 0.35,
    "flirt_opt_in": false
  },
  "conversation_focus": "",
  "recent_messages": [],
  "missing_fields": ["birth_date", "birth_time", "birth_place", "timezone", "system"],
  "latest_user_message": "Hi, can you read my chart?",
  "prefilled_response": null
}
```

**Expected agent behavior:** Trigger seeding flow (numbered list to collect birth details)

---

→ **See [docs/PERSONA.md](PERSONA.md) for how agent uses these fields**
→ **See [docs/COMPONENTS.md](COMPONENTS.md) for technical implementation**
→ **See [docs/WORKFLOWS.md](WORKFLOWS.md) for update flows**
