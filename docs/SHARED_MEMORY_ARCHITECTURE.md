# Shared Memory Architecture

## Overview

Astra uses a **shared document-based memory system** where both the Responder Agent (Astra) and Background Worker Agent interact with the same user documents via Julep's RAG capabilities.

---

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────┐
│                       User Login                            │
│        (Better Auth → MongoDB → Julep User Sync)           │
└──────────────────────┬─────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────┐
│                 User Birth Data Captured                    │
│      - Date of Birth (YYYY-MM-DD)                          │
│      - Birth Time (HH:mm, 24h, timezone)                   │
│      - Birth Location (city, country)                      │
└──────────────────────┬─────────────────────────────────────┘
                       ↓
         ┌─────────────────────────────┐
         │    Background Worker        │
         │  Generates Vedic Charts     │
         │  - Calculates planets       │
         │  - Houses, Dashas           │
         │  - Transits, Aspects        │
         └──────────┬──────────────────┘
                    ↓
         ┌─────────────────────────────┐
         │   SHARED MEMORY LAYER       │
         │   (Julep User Documents)    │
         │                             │
         │  ┌──────────────────────┐  │
         │  │  Profile Document    │  │
         │  │  - Birth data        │  │
         │  │  - Vedic chart data  │  │
         │  └──────────────────────┘  │
         │                             │
         │  ┌──────────────────────┐  │
         │  │ Preferences Document │  │
         │  │ - Communication style│  │
         │  │ - Interests          │  │
         │  └──────────────────────┘  │
         │                             │
         │  ┌──────────────────────┐  │
         │  │ Horoscope Documents  │  │
         │  │ - Daily readings     │  │
         │  │ - Transit predictions│  │
         │  └──────────────────────┘  │
         │                             │
         │  ┌──────────────────────┐  │
         │  │  Notes Documents     │  │
         │  │  - Conversation logs │  │
         │  │  - Insights          │  │
         │  └──────────────────────┘  │
         └──────┬──────────┬───────────┘
                ↓          ↓
    ┌───────────────┐  ┌──────────────────┐
    │  Astra Agent  │  │ Background Worker│
    │  (Responder)  │  │     Agent        │
    │               │  │                  │
    │  - Real-time  │  │ - Scheduled      │
    │    chat       │  │   tasks          │
    │  - Recall=true│  │ - Data analysis  │
    │  - Uses docs  │  │ - Updates docs   │
    │    for context│  │                  │
    └───────────────┘  └──────────────────┘
```

---

## How It Works

### 1. User Onboarding Flow

```typescript
// When user signs in with Google (Better Auth)
// → User created in MongoDB
// → Post-signup hook triggers Julep sync
// → Julep user created
// → Baseline documents seeded:
//    - profile (empty birth data slots)
//    - preferences (learning over time)
```

### 2. Birth Data Collection

User provides birth information through UI:
- **Date**: YYYY-MM-DD
- **Time**: HH:mm (24-hour format) + IANA timezone
- **Location**: City, Country (or lat/long)
- **System preference**: Vedic (default) or Western
- **Ayanamsha**: Lahiri (default for Vedic)

Stored in profile document:

```javascript
{
  title: "User Profile",
  content: [
    "Name: John Doe",
    "Email: john@example.com",
    "Date of Birth: 1990-05-15",
    "Birth Time: 14:30 IST",
    "Birth Location: Mumbai, India (19.0760° N, 72.8777° E)",
    "System: Vedic",
    "Ayanamsha: Lahiri"
  ],
  metadata: {
    type: "profile",
    scope: "frontline",
    shared: true,
    updated_by: "system",
    timestamp_iso: "2025-01-15T10:30:00Z"
  }
}
```

### 3. Background Chart Generation

Background Worker Agent task triggered:

```yaml
# Task: Generate Vedic Chart
- tool: search_user_profile
  arguments:
    user_id: $ _.julep_user_id
    metadata_filter:
      type: "profile"

- evaluate:
    birth_data: $ steps[0].output.docs[0].content

# Call Vedic calculation tool (MCP or custom)
- tool: calculate_vedic_chart
  arguments:
    date: $ _.birth_data.date
    time: $ _.birth_data.time
    location: $ _.birth_data.location
    ayanamsha: "Lahiri"

# Store results in shared memory
- tool: create_user_doc
  arguments:
    user_id: $ _.julep_user_id
    title: "Vedic Birth Chart"
    content:
      - $ steps[1].output.chart_data
    metadata:
      type: "analysis"
      scope: "frontline"
      shared: true
      updated_by: $ _.current_task_id
      chart_type: "natal"
```

Chart data includes:
- Planetary positions (degrees in signs)
- House cusps
- Ascendant (Lagna)
- Moon sign, Sun sign
- Dashas (planetary periods)
- Yogas (combinations)

### 4. Responder Agent Uses Shared Memory

When user chats with Astra:

```typescript
// Session created with recall=true
const session = await julepClient.sessions.create({
  userId: julepUserId,
  agentId: astraAgentId,
  recall: true,  // ENABLES MEMORY SEARCH
  recallOptions: {
    mode: "hybrid",  // BM25 + vector search
    limit: 10,
    numSearchMessages: 4,
    metadataFilter: {
      scope: "frontline",  // Only frontline docs
      shared: true         // Only shared docs
    }
  }
});

// When user asks: "What's my moon sign?"
// → Julep automatically searches user docs
// → Finds profile + chart documents
// → Injects as context to Astra
// → Astra responds: "Your moon is in Pisces..."
```

---

## Document Types & Scopes

### Profile Documents
- **Type**: `profile`
- **Scope**: `frontline` (accessible to Astra)
- **Content**: Birth data, chart calculations, personal info
- **Updated by**: User input, background tasks

### Preferences Documents
- **Type**: `preferences`
- **Scope**: `frontline`
- **Content**: Communication style, interests, topics discussed
- **Updated by**: Background persona enrichment task

### Horoscope Documents
- **Type**: `horoscope`
- **Scope**: `background` initially, `frontline` after processing
- **Content**: Daily predictions, transit effects
- **Updated by**: Background horoscope task

### Notes Documents
- **Type**: `notes`
- **Scope**: `frontline`
- **Content**: Conversation summaries, insights
- **Updated by**: Astra after each conversation

### Analysis Documents
- **Type**: `analysis`
- **Scope**: `frontline` or `background`
- **Content**: Chart interpretations, pattern analysis
- **Updated by**: Background tasks

---

## Memory Search Mechanism

### Hybrid Search (BM25 + Vector)

When Astra receives a message:

1. **Message History**: Last N messages in session
2. **Keyword Search (BM25)**: Exact term matching in documents
3. **Semantic Search (Vector)**: Meaning-based similarity
4. **Metadata Filter**: Only `scope=frontline, shared=true`
5. **Ranking**: Combine scores, return top K documents
6. **Context Injection**: Docs added to system prompt

Example:
```
User: "Tell me about my Venus placement"

Search executes:
- BM25: Matches "Venus" in chart document
- Vector: Understands "placement" → "position", "house"
- Returns: Chart doc with Venus at 12° Cancer in 7th house

Astra receives context:
"User's Venus: 12° Cancer, 7th House, aspects Jupiter..."

Astra responds:
"Your Venus in Cancer in the 7th house suggests..."
```

---

## TTS Integration Flow

```typescript
// In socket-bun.ts handler:

// 1. Get text response from Astra
const chatResponse = await julepClient.sessions.chat({
  sessionId,
  messages: [{ role: "user", content: userMessage }],
  stream: false
});

const text = chatResponse.response[0].content[0].text;

// 2. Send text to client immediately
sendJSON(ws, {
  type: "message:assistant",
  data: { role: "assistant", content: text, timestamp: ... }
});

// 3. Stream audio chunks (non-blocking)
try {
  const audioStream = await textToSpeechStream(text);
  
  for await (const chunk of audioStream) {
    sendJSON(ws, {
      type: "audio:chunk",
      data: Buffer.from(chunk).toString("base64")
    });
  }
  
  sendJSON(ws, { type: "audio:end" });
} catch (error) {
  // Audio fails gracefully - text still delivered
  console.error("TTS error:", error);
}
```

**TTS Status**: ✅ **FULLY CONFIGURED AND READY**
- ElevenLabs client initialized
- Streaming support via `convertAsStream`
- Model: `eleven_turbo_v2_5` (fast, high quality)
- Voice: Configurable via `ELEVENLABS_VOICE_ID`
- Fallback: If TTS fails, text message still works

---

## Background Task Workflow

### Daily Horoscope Generation

**Trigger**: Cron job at 6:00 AM user timezone

```typescript
// Scheduled function
export async function generateDailyHoroscopes() {
  const users = await getUsers().find({
    date_of_birth: { $exists: true },
    julep_user_id: { $exists: true }
  }).toArray();
  
  for (const user of users) {
    await julepClient.executions.create({
      taskId: process.env.HOROSCOPE_TASK_ID,
      input: { julep_user_id: user.julep_user_id }
    });
  }
}
```

**Task flow**:
1. Search user profile for birth data + chart
2. Calculate current transits
3. Generate daily prediction (LLM prompt)
4. Write to horoscope document (scope=frontline)
5. Next time user chats, Astra can reference today's horoscope

### Persona Enrichment

**Trigger**: After 5+ conversations

```typescript
// Check conversation count
const notesCount = await julepClient.users.docs.list({
  userId: julepUserId,
  metadataFilter: { type: "notes" },
  limit: 100
}).length;

if (notesCount >= 5) {
  await julepClient.executions.create({
    taskId: process.env.PERSONA_ENRICHMENT_TASK_ID,
    input: { julep_user_id: julepUserId }
  });
}
```

**Task flow**:
1. Retrieve all notes documents
2. Analyze patterns (topics, tone, questions)
3. Update preferences document
4. Astra automatically adapts in future conversations

---

## MCP Tools Integration

### What is MCP?

**Model Context Protocol** - A standardized way for agents to discover and use external tools dynamically.

### How Astra Will Use MCP

#### 1. Vedic Astrology Calculations (Custom MCP Server)

We'll create a custom MCP server for Vedic calculations:

```typescript
// Custom MCP server (separate service)
// Exposes tools like:
// - calculate_planet_positions
// - calculate_house_cusps
// - calculate_dashas
// - find_yogas
// - calculate_transits
```

**In agent YAML**:
```yaml
tools:
  - name: vedic_calculator
    type: integration
    integration:
      provider: mcp
      method: list_tools
      setup:
        transport: http
        http_url: https://vedic-mcp.astra.app/mcp
        http_headers:
          Authorization: "Bearer {VEDIC_MCP_API_KEY}"
```

#### 2. External Knowledge (DeepWiki MCP)

```yaml
tools:
  - name: astro_wiki
    type: integration
    integration:
      provider: mcp
      method: call_tool
      setup:
        transport: http
        http_url: https://mcp.deepwiki.com/mcp

# Astra can now search astrology wikis for concepts:
# "What is Kuja Dosha?" → Searches documentation
```

#### 3. Dynamic Tool Discovery

```yaml
# In background task
- tool: vedic_calculator
  arguments:
    tool_name: "calculate_planet_positions"
    arguments:
      date: "1990-05-15"
      time: "14:30"
      timezone: "Asia/Kolkata"
      ayanamsha: "Lahiri"
```

Julep automatically:
1. Discovers available tools from MCP server
2. Validates parameters
3. Executes tool
4. Returns results in normalized format

---

## Next Steps Architecture

### Phase 1: Get App Running ✅
- [x] Create agents via YAML
- [ ] Run `bun run sync:agents`
- [ ] Test WebSocket connection
- [ ] Test chat with Astra
- [ ] Verify TTS streaming

### Phase 2: Birth Data Collection
- [ ] Create birth data input form UI
- [ ] Store in MongoDB user record
- [ ] Update Julep profile document
- [ ] Test data persistence

### Phase 3: Vedic Chart Generation
- [ ] Research Vedic calculation libraries (Swiss Ephemeris)
- [ ] Create custom MCP server for calculations OR
- [ ] Use existing library with custom integration tool
- [ ] Create background task for chart generation
- [ ] Test chart storage in shared memory

### Phase 4: Enhanced Memory & Context
- [ ] Implement conversation summarization
- [ ] Set up persona enrichment schedule
- [ ] Test RAG recall quality
- [ ] Tune hybrid search weights

### Phase 5: Advanced Features
- [ ] Daily horoscope generation
- [ ] Transit notifications
- [ ] Relationship compatibility
- [ ] Voice-to-voice pipeline

---

## Key Takeaways

1. **Shared Memory = Julep User Documents**: Both agents read/write to the same document store
2. **Scope Controls Access**: `frontline` docs visible to Astra, `background` internal only
3. **Recall System**: Automatic context injection via hybrid search
4. **TTS Ready**: ElevenLabs streaming configured and functional
5. **MCP Extensibility**: Can add any tool via MCP protocol
6. **Background Processing**: Tasks update shared memory asynchronously
7. **Metadata Drives Behavior**: Type, scope, shared flags control document visibility

---

## Implementation Priority

**Right now, focus on**:
1. ✅ Agents created (`bun run sync:agents`)
2. 🔄 App running and chat working
3. 🔄 Birth data form + storage
4. 🔄 Basic Vedic calculation (start simple)
5. 🔄 Document updates working

**Later, enhance with**:
- Sophisticated MCP tools
- Advanced astrology features
- Voice-to-voice
- Multiple agent specializations
