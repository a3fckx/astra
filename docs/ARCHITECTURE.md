# Architecture Overview

Astra now runs as a single Next.js service with Julep-backed agents. The legacy FastAPI monolith and filesystem buffers have been removed.

---

## High-Level View

```
Browser UI
  │
  ▼
Next.js App Router
  • Better Auth (Google OAuth, Mongo adapter)
  • REST ingress `/api/responder/messages`
  • WebSocket stream `/api/responder/socket`
  │
  ▼
MongoDB Atlas
  • Better Auth collections (`users`, `sessions`)
  • Responder queue collections (pending prompts, emitted events)
  │
  ▼
Julep Project `astra`
  • User docs (profile, preferences, notes)
  • Tasks for responder / enrichment workflows
  • Secrets (API keys, model credentials)
```

### Component Roles

| Component | Responsibility | Key Files |
| --- | --- | --- |
| Next.js gateway | Auth, dashboard UI, REST + WebSocket routes | `app/src/app/**`, `app/src/lib/**` |
| MongoDB Atlas | Persistent store for auth + responder queues | No repo files; configure via connection env vars |
| Julep agents | Execute conversations, manage long-term memory | Managed via Julep console/API |
| Persona assets | Define Jadugar behaviour | `agents/responder/prompt.md` |

---

## Data Flow

1. **Google Sign-In**  
   Better Auth handles the OAuth handshake, stores the user record in MongoDB, and issues a session cookie.

2. **User Prompt**  
   Authenticated requests hit `POST /api/responder/messages`, which writes the prompt payload into a queue collection (e.g., `responder_outbox`) and tags it with the Julep user ID.

3. **Agent Processing**  
   Julep tasks consume pending prompts, call external models/TTS providers, and append assistant events back into `responder_events`. Summaries or persistent memories are stored in the user's Julep docs.

4. **Streaming to UI**  
   `/api/responder/socket` subscribes to change streams on `responder_events` and streams deltas to the browser, which renders them in the dashboard console.

5. **Memory Updates**  
   After each turn, Julep workers write short conversation summaries (or insights) into the user doc with metadata (`scope`, `updated_by`, `timestamp_iso`).

---

## Directory Layout

```
app/
  src/app/             # App Router routes (login, dashboard, API)
  src/lib/             # Auth + Mongo helpers, environment loader
  src/components/      # UI widgets (auth buttons, responder console)
agents/
  responder/prompt.md  # Jadugar system prompt
  README.md            # Agent asset guidelines
docs/
  *.md                 # Architecture, workflows, persona, session tracking
```

---

## Integration Touchpoints

- **Env management:** `app/src/lib/env.ts` validates required variables. Keep `.env.example` updated.
- **Julep IDs:** Store the created Julep user ID alongside the Better Auth user record (`app/src/lib/mongo.ts` operations).
- **Secrets:** Mirror runtime credentials in Julep Secrets so background tasks can access them securely.
- **Persona changes:** Update both `agents/responder/prompt.md` and the relevant docs to keep instructions aligned.

---

## Next Steps

- Implement Julep task handlers that drain `responder_outbox`.
- Pipe assistant deltas (text/audio) to ElevenLabs or preferred TTS service.
- Capture concise summaries per conversation turn and store them in user docs.
