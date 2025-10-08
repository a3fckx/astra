# Workflows — Process Flows & Sequences

## Overview

This document describes the key workflows in Astra, from authentication through conversation management to background updates.

**Status Legend:**
- ✅ Implemented
- 🚧 Planned

---

## Authentication Flow

**Status:** ✅ Implemented (Next.js + Better Auth)

### Purpose
Authenticate users through Google OAuth, collect DOB for astrology features, and provision session cookies that both the app service and Python services can trust.

### Flow Diagram

```
┌──────────────┐        ┌────────────────────┐        ┌──────────────────┐
│   Browser    │ ─────▶ │ Next.js Gateway    │ ─────▶ │  Google OAuth    │
│  (Next.js)   │        │ (Better Auth)      │        │ Consent Screen   │
└──────┬───────┘        └─────────┬──────────┘        └─────────┬────────┘
       │ 1. POST /auth/social         │ 2. Exchange code & fetch profile      │
       │                               ▼                                      │
       │                         ┌──────────────┐                              │
       │                         │ MongoDB Atlas│◀────────────────────────────┘
       │ 5. Session cookie ▼     └──────────────┘
┌──────┴───────┐
│  Dashboard   │
└──────────────┘
```

### Step-by-Step

1. **User initiates Google sign-in**
   ```tsx
   await authClient.signIn.social({ provider: "google" });
   ```
   The Better Auth client redirects to Google with scopes derived from `app/.env` (`GOOGLE_ENABLE_BIRTHDAY_SCOPE`, `GOOGLE_ENABLE_GMAIL_READ_SCOPE`).

2. **Better Auth handles the OAuth callback**
   - `/api/auth/[...all]` receives the authorization code.
   - The Better Auth handler exchanges the code for tokens, fetches the Google profile (name, email, birthday), and normalizes it.

3. **User record is written to MongoDB**
   - Better Auth’s Mongo adapter persists/updates `users`, `sessions`, and the linked Google account documents inside the configured database.
   - DOB and profile data are available for downstream agents to hydrate the astro memory buffer.

4. **Session cookie issued**
   - Better Auth generates a signed session token and sets it as an HttpOnly cookie (optionally mirrored in a short-lived cookie cache).
   - No JWT is minted; the session id is validated server-side via Better Auth APIs.

5. **Next.js dashboard fetches the session**
   ```tsx
   const session = await auth.api.getSession({ headers: await headers() });
   ```
   - Server components, API routes, and middleware use the Better Auth API helpers to validate requests.
   - Clients never handle raw Google tokens directly.

6. **Python services verify identities**
   - Internal requests include the Better Auth session id (e.g., in headers) or rely on MongoDB documents created during login.
   - Workers trust the Next.js gateway to manage browser-facing auth, focusing on agent workloads only.

### Error Handling

- **Birthday scope disabled or denied:** the feature flag in `.env` is off, or the user rejected the People API scope. Agents should degrade gracefully (no DOB-dependent insights) and optionally prompt the UI to re-authorize via `authClient.linkSocial` with `scopes: ["user.birthday.read"]`.
- **Mongo unresponsive:** Better Auth raises an error, and the Next.js route returns a 503. Verify Atlas credentials and network rules.
- **Session tampering:** Invalid/expired cookies are rejected by Better Auth APIs, prompting a redirect to `/` with a fresh sign-in.

---

## Conversation Initialization Flow

**Status:** ✅ Implemented (Responder streaming path)

### Purpose
Move user prompts from the authenticated UI into the Python responder agent and stream agent replies back to the dashboard in real time.

### Flow Diagram

```
┌──────────────┐        ┌────────────────────┐        ┌────────────────────┐
│  Browser UI  │ ─────▶ │ Next.js API        │ ─────▶ │ MongoDB: Outbox    │
│ (Responder)  │        │ /api/responder/... │        │ responder_outbox   │
└──────┬───────┘        └─────────┬──────────┘        └─────────┬──────────┘
       │                                │                           │
       │                                ▼                           │
       │                         ┌──────────────┐                   │
       │                         │ Python Agent │ ◀─────────────────┘
       │                         │ (FastAPI)    │ ─────▶ ElevenLabs WS
       │                                │
       │                                ▼
       │                         ┌──────────────┐
       │                         │ MongoDB:     │
       │                         │ responder_events
       │                                │
       │                                ▼
┌──────┴───────┐        ┌─────────┴──────────┐
│  Browser UI  │ ◀───── │ Next.js WebSocket  │
└──────────────┘        └────────────────────┘
```

### Step-by-Step

1. **User submits a prompt from the dashboard**
   ```tsx
   await fetch("/api/responder/messages", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ content: input })
   });
   ```
   - Better Auth validates the session cookie and injects the user id.
   - The API route writes `{ userId, content, status: "pending" }` to `responder_outbox`.

2. **Python responder picks up work**
   ```python
   outbox = db.responder_outbox
   doc = outbox.find_one_and_update(
       {"status": "pending"},
       {"$set": {"status": "processing", "locked_at": datetime.utcnow()}},
       sort=[("createdAt", 1)],
   )
   ```
   - Worker enriches the payload with memory buffer data, runs ElevenLabs via `scripts/agent_runner.py`, and builds the assistant response.

3. **Agent reply persisted to `responder_events`**
   ```python
   events.insert_one(
       {
           "userId": doc["userId"],
           "role": "assistant",
           "content": reply_text,
           "createdAt": datetime.utcnow(),
           "metadata": {"source": "responder"}
       }
   )
   outbox.update_one({"_id": doc["_id"]}, {"$set": {"status": "delivered"}})
   ```

4. **Next.js WebSocket broadcasts updates**
   - `/api/responder/socket` keeps a change stream on `responder_events` filtered by `userId`.
   - When a new document arrives, the route emits `messages:append` to the client.
   - Initial connection seeds the last ~25 events via `messages:init`.

5. **React client renders the stream**
   ```tsx
   ws.addEventListener("message", (event) => {
     const payload = JSON.parse(event.data);
     if (payload.type === "messages:append") {
       setMessages((prev) => [...prev, payload.data]);
     }
   });
   ```

### Error Handling

- **Duplicate submissions:** The API route trims whitespace, enforces length caps, and returns 400 if the payload is invalid.
- **Outbox contention:** Workers should use `find_one_and_update` with a status transition to avoid double-processing.
- **Change streams unavailable:** The WebSocket route surfaces a clear error message and falls back to manual polling.

## Background Analysis Flow

**Status:** 🚧 Planned

### Purpose
Continuously analyze transcripts, update user context with insights, and push updates to active conversations.

### Flow Diagram

```
┌──────────────────┐
│  Active          │
│  Conversation    │
└──────┬───────────┘
       │ 1. Messages exchanged
       │ 2. Transcript logged to MongoDB
       ▼
┌──────────────────┐
│  MongoDB         │
│  (transcripts)   │
└──────┬───────────┘
       │
       │ 3. Background worker polls
       ▼
┌──────────────────┐
│  Background      │
│  Analyzer        │
│  (Async Task)    │
└──────┬───────────┘
       │ 4. Fetch recent transcripts
       │ 5. Send to LLM for analysis
       ▼
┌──────────────────┐
│  LLM (GPT-4)     │
└──────┬───────────┘
       │ 6. Return insights
       ▼
┌──────────────────┐
│  Background      │
│  Analyzer        │
└──────┬───────────┘
       │ 7. Compare with astro_snapshot
       │ 8. Generate updated overview
       │ 9. Update MongoDB users collection
       ▼
┌──────────────────┐
│  MongoDB         │
│  (users)         │
└──────┬───────────┘
       │ 10. Document updated
       ▼
┌──────────────────┐
│  Background      │
│  Analyzer        │
└──────┬───────────┘
       │ 11. If conversation still active
       │ 12. Enqueue contextual_update
       ▼
┌──────────────────┐
│  Update Queue    │
└──────┬───────────┘
       │ 13. Agent runner reads queue
       ▼
┌──────────────────┐
│  Active          │
│  Conversation    │
│  (Update shown   │
│   in next turn)  │
└──────────────────┘
```

### Implementation Sketch

```python
import asyncio
from openai import OpenAI

async def background_analyzer():
    """Continuously analyze transcripts and update user context"""

    while True:
        # 1. Find recent unprocessed transcripts
        transcripts = db.transcripts.find({
            "processed": False,
            "created_at": {"$gte": datetime.utcnow() - timedelta(minutes=5)}
        })

        for transcript in transcripts:
            # 2. Load user context
            user = db.users.find_one({"user_id": transcript["user_id"]})
            astro_snapshot = user.get("astro_overview", "")

            # 3. Build analysis prompt
            messages_text = "\n".join([
                f"{msg['role']}: {msg['text']}"
                for msg in transcript["messages"]
            ])

            prompt = f"""
            Analyze this conversation transcript in context of the user's astrology:

            Astro Context: {astro_snapshot}

            Transcript:
            {messages_text}

            1. What life events or themes emerged?
            2. How do they relate to current transits?
            3. What updated overview would help future conversations?

            Return JSON:
            {{
              "events": [list of events],
              "updated_overview": "string",
              "contextual_update_text": "brief update for agent"
            }}
            """

            # 4. Send to LLM
            client = OpenAI()
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)

            # 5. Update user document
            db.users.update_one(
                {"user_id": transcript["user_id"]},
                {
                    "$set": {
                        "overview": result["updated_overview"],
                        "updated_at": datetime.utcnow()
                    },
                    "$push": {
                        "events": {"$each": result["events"]}
                    }
                }
            )

            # 6. If conversation still active, enqueue update
            session = db.sessions.find_one({
                "user_id": transcript["user_id"],
                "active": True
            })

            if session:
                enqueue_update(
                    session["conversation_id"],
                    result["contextual_update_text"]
                )

            # 7. Mark transcript as processed
            db.transcripts.update_one(
                {"_id": transcript["_id"]},
                {"$set": {"processed": True}}
            )

        # Wait before next poll
        await asyncio.sleep(30)
```

### Analysis Patterns

**Event extraction:**
- "Got a promotion" → `{"date": "2024-01-15", "desc": "Career advancement", "astro_tie": "Jupiter transit"}`
- "Feeling stressed" → `{"date": "2024-01-15", "desc": "High stress period", "astro_tie": "Saturn pressure"}`

**Overview generation:**
- Synthesize events with astrological context
- Provide actionable insights for future conversations
- Keep concise (2-3 sentences)

**Contextual update text:**
- Brief, natural language
- "New insight: Your promotion aligns with Jupiter's favorable transit—momentum continues through March."

---

## Seeding Flow

**Status:** ✅ Implemented (Agent persona)

### Purpose
Collect birth details from new users to enable astrological guidance.

### Flow Diagram

```
┌──────────────────┐
│  User: "Read     │
│  my chart"       │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Agent checks    │
│  pinned_facts    │
└──────┬───────────┘
       │
       │ If empty/incomplete
       ▼
┌──────────────────┐
│  Agent: Seeding  │
│  mode activated  │
└──────┬───────────┘
       │ Numbered list (max 4 items)
       │ Request all essentials in ONE message
       ▼
┌──────────────────┐
│  "To get your    │
│  chart, bas yeh  │
│  chahiye:        │
│  1) Birth date   │
│  2) Birth time   │
│  3) Birth place  │
│  4) Timezone &   │
│     system"      │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  User provides   │
│  details         │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Background      │
│  processor       │
│  extracts data   │
└──────┬───────────┘
       │ Parse user response
       │ Validate format
       │ Update pinned_facts
       ▼
┌──────────────────┐
│  Astrology       │
│  Calculator      │
└──────┬───────────┘
       │ Calculate chart
       │ Generate astro_snapshot
       ▼
┌──────────────────┐
│  Update MongoDB  │
│  & memory buffer │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Agent receives  │
│  contextual      │
│  update          │
└──────┬───────────┘
       │ "Birth details saved, chart calculated"
       ▼
┌──────────────────┐
│  Agent: Provide  │
│  astrological    │
│  guidance        │
└──────────────────┘
```

### Detection Logic

**In prompt:** `responder.md`

```markdown
### Seeding policy (only when astro is unseeded)
• Unseeded condition: if pinned_facts lacks birth date/time/place/tz
  and astro_snapshot is empty, assume astro is not yet seeded.
• In this condition, present a brief numbered list (max 4 items) in a
  single reply to seed essentials.
```

**Triggered when:**
- `pinned_facts` is `{}` or missing critical fields
- `astro_snapshot` is empty string
- `missing_fields` contains birth-related fields

### Example Exchange

**User:** "Hi, can you read my chart?"

**Agent (seeding mode):**
```
To get your chart, bas yeh chahiye:
1) Birth date (YYYY-MM-DD)
2) Birth time (HH:mm, 24h; if unknown, say so)
3) Birth place (city, country)
4) Timezone (IANA, e.g., Asia/Kolkata) and your preferred system
   (western or vedic; if vedic, which ayanamsha?)
```

**User:** "1996-05-14, 07:20, Mumbai India, Asia/Kolkata, vedic with Lahiri"

**Background processor:**
```python
# Parse response
details = extract_birth_details(user_message)
# {
#   "birth_date": "1996-05-14",
#   "birth_time": "07:20",
#   "birth_place": "Mumbai, India",
#   "timezone": "Asia/Kolkata",
#   "system": "vedic",
#   "ayanamsha": "Lahiri"
# }

# Calculate chart
from services.astro_utils import calculate_chart
chart = calculate_chart(details)

# Update user
db.users.update_one(
    {"user_id": user_id},
    {
        "$set": {
            "pinned_facts": details,
            "astro_overview": chart.snapshot
        }
    }
)

# Send update to active conversation
enqueue_update(
    conversation_id,
    f"Chart calculated: {chart.summary}"
)
```

**Agent (next turn):**
```
Perfect! Your chart shows Sun in Taurus, Moon in Virgo, Ascendant in Gemini.
Mercury is retrograde in Taurus—watch communication clarity this month.
What's your main focus right now?
```

### Handling Incomplete Data

**User:** "I don't know my exact birth time"

**Agent:**
```
No worries! Without exact time, I can't determine your Ascendant or houses,
but your Sun and Moon positions are still powerful. Want to proceed with
approximate time (morning/afternoon/evening) or skip it?
```

### Validation

**Date format:**
- Accept: `1996-05-14`, `14-05-1996`, `May 14, 1996`
- Normalize to: `YYYY-MM-DD`

**Time format:**
- Accept: `07:20`, `7:20 AM`, `0720`
- Normalize to: `HH:mm` (24-hour)

**Timezone:**
- Accept: `Asia/Kolkata`, `IST`, `+05:30`
- Normalize to: IANA timezone string

---

## Session Cleanup Flow

**Status:** 🚧 Planned

### Purpose
Properly close conversations, persist context, and free resources.

### Flow

```
┌──────────────────┐
│  User ends       │
│  conversation    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Frontend sends  │
│  /conversation/  │
│  end             │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  FastAPI Server  │
└──────┬───────────┘
       │ 1. Mark session inactive
       │ 2. Close WebSocket
       │ 3. Persist final transcript
       │ 4. Update user context
       ▼
┌──────────────────┐
│  MongoDB         │
└──────┬───────────┘
       │ Sessions & transcripts updated
       ▼
┌──────────────────┐
│  Return 200 OK   │
└──────────────────┘
```

---

→ **See [docs/COMPONENTS.md](COMPONENTS.md) for technical component details**
→ **See [docs/PERSONA.md](PERSONA.md) for agent behavioral specs**
→ **See [docs/MEMORY_BUFFER.md](MEMORY_BUFFER.md) for context structure**
