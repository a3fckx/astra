# Components — Technical Reference

## Overview

Astra is built from modular components that work together to deliver personalized astrology conversations:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Google OAuth   │────▶│  MongoDB Atlas   │────▶│  ElevenLabs     │
│  (Auth Service) │     │  (Context Store) │     │  (Voice Agent)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                         │
        │ DOB extraction         │ User context            │ Conversation
        ▼                        ▼                         ▼
   User Profile            Memory Buffer             Jadugar Persona
```

**Tech Stack:**
- **Next.js 14 + TypeScript** for the auth gateway & control center
- **Better Auth** for Google OAuth + session management
- **Python 3.8+** with asyncio for agent workloads
- **WebSockets** for ElevenLabs real-time connection & responder streaming
- **MongoDB Atlas** (serverless NoSQL) for per-user context and responder queues
- **flatlib/swisseph** (planned) for astrological calculations

---

## App Gateway (Next.js + Better Auth)

**Files:**
- `app/src/lib/auth.ts` — Better Auth configuration (Mongo adapter, Google scopes)
- `app/src/app/api/auth/[...all]/route.ts` — Better Auth HTTP handler
- `app/src/app/api/responder/messages/route.ts` — Authenticated REST ingress for user prompts
- `app/src/pages/api/responder/socket.ts` — Node WebSocket bridge streaming responder events
- `app/src/components/responder-console.tsx` — Real-time React console

**Responsibilities:**
1. **Google OAuth & sessions**
   - Uses Better Auth social provider (`google`) with env-driven scopes for birthday/Gmail access.
   - Stores `users`, `sessions`, and linked social accounts in MongoDB.
   - Issues signed HttpOnly cookies that server components + API routes validate via `auth.api.*` helpers.

2. **Responder ingress**
   - `POST /api/responder/messages` validates the session cookie, applies payload limits, and writes to `responder_outbox`.
   - Supports optional metadata payloads for future agent signals.

3. **Realtime streaming**
   - `/api/responder/socket` upgrades to WebSocket, attaches a MongoDB change stream on `responder_events`, and streams `messages:init`/`messages:append` packets.
   - Gracefully degrades when change streams are unavailable (e.g., free-tier clusters).

4. **Control center UI**
   - Landing page exposes Google sign-in; `/dashboard` renders session-aware view with the responder console and sign-out actions.
   - Client utilities (`auth-buttons`, `auth-client`) wrap Better Auth’s React helpers.

**Environment variables (`app/.env`):**
- `MONGODB_USERNAME`, `MONGODB_PASSWORD`, `MONGODB_CLUSTER`, `MONGODB_DB`
- *(optional)* `MONGODB_URI` (overrides the above when set)
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `GOOGLE_ENABLE_BIRTHDAY_SCOPE`, `GOOGLE_ENABLE_GMAIL_READ_SCOPE`
- `NEXT_PUBLIC_APP_URL`

---

## ElevenLabs Agent Runner

**File:** `scripts/elevenlabs_agent_runner.py`

### Purpose
WebSocket client that connects to ElevenLabs Conversational AI and manages personalized voice conversations with the Jadugar agent.

### Key Capabilities

1. **Dynamic Variable Injection**
   - Loads `buffer/memory_buffer.json` at session start
   - Converts structured JSON to string map for ElevenLabs dynamic_variables
   - Renders `responder.md` template by replacing `{{placeholders}}`
   - Sends `conversation_initiation_client_data` with rendered prompt + variables

2. **Auth Modes** (via `auth_mode` in config.json)
   - `auto` (default): Fetches signed URL on launch using API key
   - `signed_url_fetch`: Explicitly forces signed URL fetch (same as auto)
   - `public`: Uses public agent_id without authentication (for public agents only)

3. **Contextual Updates** (mid-session)
   - **File Watcher**: Monitors `buffer/memory_buffer.json` for changes
     - Enabled via `watch_memory_updates: true`
     - Poll interval: `watch_interval_ms` (default: 1500ms)
     - Sends `contextual_update` event with brief text summary
   - **Update Queue**: NDJSON queue for multi-agent coordination
     - Enabled via `enable_updates_queue: true`
     - Path: `updates_queue_path` (default: `buffer/updates.ndjson`)
     - CLI: `python scripts/elevenlabs_agent_runner.py --enqueue-update "Update text"`

4. **Client Tools** (agent → runner)
   - `getMemoryBuffer`: Returns current memory_buffer.json as string variables
   - `getConversationHistory`: Returns recent transcript slice (configurable via `recent_max`)

5. **Transcript Logging**
   - Console: Prints `[user]` and `[agent]` messages to stdout
   - File: Optional via `log_transcripts: true` and `log_transcripts_to_file` path

### Configuration Options

**Core settings:**
```json
{
  "elevenlabs_api_key": "",
  "agent_id": "agent_...",
  "auth_mode": "auto",
  "language": "en",
  "override_language": false,
  "override_first_message": false
}
```

**Memory & updates:**
```json
{
  "memory_buffer_source": {
    "type": "structured_json",
    "path": "buffer/memory_buffer.json"
  },
  "memory_buffer_tool_enabled": true,
  "history_tool_enabled": true,
  "watch_memory_updates": true,
  "watch_interval_ms": 1500,
  "enable_updates_queue": true,
  "updates_queue_path": "buffer/updates.ndjson"
}
```

**Prompt customization:**
```json
{
  "prompt_override": true,
  "render_template_locally": true,
  "responder_template_path": "responder.md"
}
```

**LLM parameters:**
```json
{
  "custom_llm_extra_body": {
    "temperature": 0.7,
    "max_tokens": 160
  }
}
```

### Environment Variable Overrides

Priority: **Environment variables > config.json**

- `ELEVENLABS_API_KEY` → `elevenlabs_api_key`
- `ELEVENLABS_AGENT_ID` → `agent_id`
- `ELEVENLABS_SIGNED_URL` → `signed_url`
- `ELEVENLABS_AGENT_LANGUAGE` → `language`
- `ELEVENLABS_USER_ID` → `user_id`
- `ELEVENLABS_AUTH_MODE` → `auth_mode`

### Usage Examples

**Basic run:**
```bash
python scripts/elevenlabs_agent_runner.py
```

**Dry run (test without connecting):**
```bash
python scripts/elevenlabs_agent_runner.py --dry
```

**Enqueue update (for multi-agent systems):**
```bash
python scripts/elevenlabs_agent_runner.py --enqueue-update "astro_snapshot updated: Mars transit"
```

**With conversation targeting:**
```bash
python scripts/elevenlabs_agent_runner.py --enqueue-update "New insight" --conversation-id "conv_abc123"
```

### Variable Injection Flow

1. Load `buffer/memory_buffer.json` → Python dict
2. Convert to string map:
   - `dict`/`list` → JSON string
   - `None` → empty string
   - Others → `str(value)`
3. Render `responder.md`:
   - Replace `{{key}}` with string values
   - Remove unmatched `{{...}}` placeholders
4. Build `conversation_initiation_client_data`:
   - `conversation_config_override.agent.prompt.prompt` = rendered prompt
   - `dynamic_variables` = string map
   - Optional: `custom_llm_extra_body`, `user_id`
5. Send on WebSocket connection

### Best Practices

- **Session start**: Use dynamic variables for initial context (birth details, preferences)
- **Mid-session**: Use `contextual_update` events for incremental changes (new insights, updated focus)
- **Keep variables compact**: A few KB max; put longer text in `context` field and summarize
- **Major changes**: Restart session to re-inject full prompt + variables
- **Signed URLs**: Are temporary (~1 hour); runner fetches fresh on each launch

---

## Memory Buffer System

**File:** `buffer/memory_buffer.json`

### Purpose
Structured JSON storage for per-user context that flows into every conversation turn as dynamic variables.

### Structure
```json
{
  "pinned_facts": {
    "name": "string",
    "system": "vedic|western",
    "ayanamsha": "Lahiri|...",
    "birth_date": "YYYY-MM-DD",
    "birth_time": "HH:mm",
    "birth_place": "City, Country",
    "timezone": "IANA timezone"
  },
  "astro_snapshot": "string (Markdown-friendly)",
  "user_preferences": {
    "tone": "warm|professional|...",
    "pacing": "concise|detailed",
    "hinglish_level": 0.35,
    "flirt_opt_in": false
  },
  "conversation_focus": "string",
  "recent_messages": [
    {"role": "user|assistant", "text": "string"}
  ],
  "missing_fields": ["birth_date", "..."],
  "latest_user_message": "string",
  "prefilled_response": "string|null"
}
```

### Update Mechanisms

1. **Manual edit**: Edit `buffer/memory_buffer.json` directly
2. **File watcher**: Runner detects changes and sends contextual update
3. **Background agent** (planned): Analyzes transcripts → Updates buffer → Pushes events
4. **API endpoint** (planned): FastAPI routes for programmatic updates

### Integration with Prompts

Variables are injected as `{{variable_name}}` in `responder.md`:
```markdown
### Use only this buffer (variables injected per turn)
• pinned_facts: {{pinned_facts}}
• astro_snapshot: {{astro_snapshot}}
• user_preferences: {{user_preferences}}
...
```

Runner replaces placeholders with stringified values before sending to ElevenLabs.

→ **See [docs/MEMORY_BUFFER.md](MEMORY_BUFFER.md) for detailed field specifications**

---

## Google Auth Service

**File:** `services/google_auth_service.py`

### Purpose
Handles complete Google OAuth 2.0 flow for user authentication and profile data extraction, with emphasis on **date of birth** (critical for astrology features).

### OAuth Flow

```
1. Generate Authorization URL
   ↓
2. User Approves on Google Consent Screen
   ↓
3. Google Redirects with Authorization Code
   ↓
4. Exchange Code for Tokens (access + refresh)
   ↓
5. Fetch User Profile (name, email, DOB)
   ↓
6. Store in MongoDB + Calculate Initial Star Sign
```

### Configuration Sources

**Priority:** Environment variables (.env) **>** config.json

**Environment variables:**
```bash
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
GOOGLE_ENABLE_BIRTHDAY_SCOPE=true
GOOGLE_ENABLE_GMAIL_READ_SCOPE=false
GOOGLE_INCLUDE_GRANTED_SCOPES=true
GOOGLE_ACCESS_TYPE=offline
GOOGLE_PROMPT=consent
```

**config.json:**
```json
{
  "google_auth": {
    "redirect_uri": "http://localhost:8000/auth/google/callback",
    "enable_birthday_scope": true,
    "enable_gmail_read_scope": false,
    "include_granted_scopes": true,
    "access_type": "offline",
    "prompt": "consent",
    "additional_scopes": []
  }
}
```

### Scopes Requested

**Base (always):**
- `openid`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`

**Birthday (enabled by default):**
- `https://www.googleapis.com/auth/user.birthday.read` (People API)

**Gmail (disabled by default):**
- `https://www.googleapis.com/auth/gmail.readonly` (Gmail API)

### Key Methods

**`authorization_url(state: str) -> str`**
- Builds Google OAuth consent URL with configured scopes
- `state` parameter for CSRF protection
- Returns full authorization URL to redirect user

**`exchange_code(code: str) -> dict`**
- Exchanges authorization code for tokens
- Returns: `{"access_token": str, "refresh_token": str, "expires_in": int, "token_type": str}`

**`fetch_user_profile(access_token: str) -> dict`**
- Fetches user profile from People API
- Returns: `{"name": str, "email": str, "birthday": str}` (birthday format: YYYY-MM-DD or MM-DD)

**`fetch_gmail_profile(access_token: str) -> dict`**
- Fetches Gmail profile when gmail scope enabled
- Returns: `{"emailAddress": str, "messagesTotal": int, ...}`

**`refresh_access_token(refresh_token: str) -> dict`**
- Refreshes expired access token
- Returns new tokens dict

### Usage Example

```python
from services.google_auth_service import GoogleAuthService

# Initialize (loads from .env + config.json)
auth = GoogleAuthService()

# Step 1: Generate authorization URL
auth_url = auth.authorization_url(state="random_csrf_token")
# Redirect user to auth_url

# Step 2: Exchange code (from callback) for tokens
tokens = auth.exchange_code(code="authorization_code_from_google")
access_token = tokens["access_token"]
refresh_token = tokens.get("refresh_token")

# Step 3: Fetch user profile (includes DOB)
profile = auth.fetch_user_profile(access_token)
print(f"Name: {profile['name']}, DOB: {profile['birthday']}")

# Step 4: Store in MongoDB + calculate star sign
# (implementation in auth server)
```

### Google Cloud Setup Requirements

**Project:** astra-474015

**Required:**
1. OAuth 2.0 credentials (Client ID + Secret)
2. People API enabled (for birthday access)
3. OAuth consent screen configured
4. Redirect URI registered: `http://localhost:8000/auth/google/callback` (dev) + production URI

**Optional:**
5. Gmail API enabled (if `enable_gmail_read_scope: true`)

**Cost:** $0 (OAuth and People API are free)

---

## MongoDB Context Store

**Status:** 🚧 Planned

**Purpose:** Per-user persistent storage for astrology context, conversation history, and personalization data.

### Database Design

**Connection:**
- MongoDB Atlas (serverless tier)
- Connection string: `mongodb+srv://{username}:{password}@{cluster}.mongodb.net/?retryWrites=true&w=majority`
- Environment variables: `MONGODB_USERNAME`, `MONGODB_PASSWORD`, `MONGODB_CLUSTER`

**Database:** `astra`

**Collections:**

1. **`users`** - User profiles and astrology data
   ```json
   {
     "_id": "ObjectId",
     "user_id": "string (from Google OAuth)",
     "email": "string",
     "name": "string",
     "dob": "YYYY-MM-DD",
     "star_sign": "string",
     "pinned_facts": {
       "name": "string",
       "system": "vedic|western",
       "ayanamsha": "string",
       "birth_date": "YYYY-MM-DD",
       "birth_time": "HH:mm",
       "birth_place": "string",
       "timezone": "string"
     },
     "astro_overview": "string (Markdown)",
     "events": [
       {
         "date": "YYYY-MM-DD",
         "description": "string",
         "astro_tie": "string"
       }
     ],
     "overview": "string",
     "preferences": {
       "tone": "string",
       "pacing": "string",
       "hinglish_level": 0.35,
       "flirt_opt_in": false
     },
     "memory_tokens": ["string"],
     "created_at": "ISODate",
     "updated_at": "ISODate"
   }
   ```

2. **`sessions`** - Active conversation sessions
   ```json
   {
     "_id": "ObjectId",
     "user_id": "string",
     "conversation_id": "string",
     "signed_url": "string",
     "active": true,
     "started_at": "ISODate",
     "ended_at": "ISODate|null"
   }
   ```

3. **`transcripts`** - Conversation logs
   ```json
   {
     "_id": "ObjectId",
     "user_id": "string",
     "conversation_id": "string",
     "messages": [
       {
         "role": "user|assistant",
         "text": "string",
         "timestamp": "ISODate"
       }
     ],
     "created_at": "ISODate"
   }
   ```

### Indexes

```javascript
// users collection
db.users.createIndex({ "user_id": 1 }, { unique: true })
db.users.createIndex({ "email": 1 })

// sessions collection
db.sessions.createIndex({ "user_id": 1, "active": 1 })
db.sessions.createIndex({ "conversation_id": 1 })

// transcripts collection
db.transcripts.createIndex({ "user_id": 1, "conversation_id": 1 })
```

### Test Connection

**File:** `test_mongo.py`

```bash
# Install dependencies
uv pip install "pymongo[srv]" python-dotenv

# Set up .env with MongoDB credentials
cp .env.example .env
# Edit .env with your MONGODB_USERNAME and MONGODB_PASSWORD

# Test connection
python test_mongo.py
```

---

## SDK Runner (Alternative)

**File:** `scripts/elevenlabs_sdk_runner.py`

### Purpose
Minimal alternative using ElevenLabs Python SDK for quick sessions without custom orchestration.

### When to Use
- Quick testing without WebSocket complexity
- Don't need file watcher or update queue
- Don't need custom client tools
- Simpler use cases

### Installation
```bash
uv pip install elevenlabs
```

### Usage
```bash
python scripts/elevenlabs_sdk_runner.py
```

### Limitations
- No file watcher for memory buffer updates
- No update queue system
- No custom tool implementations
- Less control over session lifecycle

### Recommendation
Use `elevenlabs_agent_runner.py` (WebSocket) for production; SDK runner is for quick prototyping only.

---

## Implementation Status

| Component | Status | Files |
|-----------|--------|-------|
| ElevenLabs Agent Runner | ✅ Implemented | `scripts/elevenlabs_agent_runner.py` |
| Memory Buffer System | ✅ Implemented | `buffer/memory_buffer.json` |
| Google Auth Service | ✅ Implemented | `services/google_auth_service.py` |
| MongoDB Test | ✅ Implemented | `test_mongo.py` |
| FastAPI Auth Server | 🚧 Planned | `auth.py` (to be created) |
| MongoDB Context Store | 🚧 Planned | Schema designed, not implemented |
| Background Updater | 🚧 Planned | Async transcript analysis |
| Astrology Calculations | 🚧 Planned | flatlib integration |
| Conversation Manager | 🚧 Planned | Token validation + proxy |

---

→ **See [docs/WORKFLOWS.md](WORKFLOWS.md) for component interaction flows**
→ **See [docs/PERSONA.md](PERSONA.md) for Jadugar agent specifications**
→ **See [docs/MEMORY_BUFFER.md](MEMORY_BUFFER.md) for buffer field details**
