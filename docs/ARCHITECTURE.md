# Astra Architecture — System Overview

> **For detailed component documentation, see [COMPONENTS.md](COMPONENTS.md)**

## Vision
Multi-user serverless astrology conversational AI (Jadugar) combining Google OAuth authentication, MongoDB Atlas context storage, and ElevenLabs voice agent platform.

**Key Features:**
- **Google OAuth auth** → Extract DOB → Calculate star sign/birth chart
- **Per-user MongoDB docs** → Persistent context (pinned_facts, astro_snapshot, events, preferences)
- **ElevenLabs voice agent** → Real-time conversations with dynamic variable injection
- **Background analysis** (planned) → LLM analyzes transcripts → Updates insights → Pushes to active sessions
- **Astro-centric personalization** → Events compared to transits for tailored guidance

**Status Legend:**
- ✅ Implemented
- 🚧 Planned
- 📋 Future

---

## Components

**1. Next.js Auth Gateway** ✅ Implemented
- Files: `app/src/lib/auth.ts`, `app/src/app/api/auth/[...all]/route.ts`
- Uses Better Auth + Mongo adapter to power Google OAuth, session cookies, and API routes
- Exposes REST endpoints (`/api/responder/messages`) and a WebSocket bridge (`/api/responder/socket`) for the responder agent
- → See [COMPONENTS.md#app-gateway-nextjs--better-auth](COMPONENTS.md#app-gateway-nextjs--better-auth)
- → See [WORKFLOWS.md#authentication-flow](WORKFLOWS.md#authentication-flow)

**2. Responder Control Center (Next.js)** ✅ Implemented
- File: `app/src/app/dashboard/page.tsx`
- Client components (`auth-buttons`, `responder-console`) provide Google sign-in and real-time stream UI
- Consumes session-aware Better Auth client and WebSocket updates from `responder_events`

**3. FastAPI Agent Mesh** ✅ Implemented (private)
- File: `backend/app/main.py` (+ services, scripts)
- Hosts internal APIs for voice agents, coordinates ElevenLabs runner, processes background tasks
- Reads/writes Mongo collections shared with the Next.js gateway (`responder_outbox`, `responder_events`, user context docs)

**4. ElevenLabs Agent Runner** ✅ Implemented
- File: `scripts/elevenlabs_agent_runner.py`
- WebSocket connection to ElevenLabs Conversational AI
- Dynamic variable injection (responder.md + memory buffer)
- File watcher and update queue for mid-session updates
- → See [COMPONENTS.md#elevenlabs-agent-runner](COMPONENTS.md#elevenlabs-agent-runner)

**5. Memory Buffer System** ✅ Implemented
- File: `backend/app/buffer/memory_buffer.json`
- Structured per-user context (pinned_facts, astro_snapshot, preferences)
- Injected into ElevenLabs sessions + used for background processing
- → See [MEMORY_BUFFER.md](MEMORY_BUFFER.md)

**6. MongoDB Atlas Data Layer** ✅ Implemented
- Collections: `users`, `responder_outbox`, `responder_events`, future astro analytics
- Shared by Next.js gateway (auth + responder ingress) and Python agents (processing + event publishing)
- Better Auth manages `users`, `sessions`, and social account tables inside the same database

**7. Background Analyzer** 🚧 Planned
- Async workers ingest transcripts + events, enrich astro snapshots, and emit updates into `responder_events`
- → See [WORKFLOWS.md#background-analysis-flow](WORKFLOWS.md#background-analysis-flow)

**8. Astrology Utils** 🚧 Planned
- File: `services/astro_utils.py` (to be created)
- Birth chart calculation (flatlib/swisseph)
- Transit predictions
- Star sign/house calculations

## Context Buffer Goals (MongoDB)
- Personalization: Better Auth seeds DOB / profile baseline; Python agents expand `astro_snapshot`, preferences, and event history.
- Updates: Background LLMs compare new events vs. snapshot → write enriched insights → emit responder events for live sessions.
- Tooling tokens: Store scoped bearer/API tokens if external services are required (cap small set per user).
- Analytics: Enable aggregate queries over events/transits for experimentation without impacting hot path collections.

## Context Buffer Contents (Mongo Doc)
- user_id (str, PK): From Google auth.
- dob (str): YYYY-MM-DD from profile.
- star_sign (str): Initial from DOB.
- pinned_facts (dict): {name, time/place/tz, system (western/vedic), ayanamsha}.
- astro_overview (str: Markdown): "# Sun in Leo\n| Planet | Sign | House |\n|--------|------|-------|\n| Sun    | Leo  | 5     |\nInsights: Creative energy peaks; Jupiter transit favorable for growth.
- events (list): [{date, desc: "Promotion", astro_tie: "Mars energy"}].
- overview (str): "Creative leader; recent stress from Saturn—advise rest".
- preferences (dict): {tone: "warm", flirt_opt_in: bool, lang: "Hinglish"}.
- memory_tokens (list): ["bearer_tok1", "tok2"] (max 3).
- sessions (list): [{conversation_id, signed_url, active: bool}].

## Flow (Multi-User)
1. **Auth handshake (Next.js + Better Auth)**
   - User selects “Continue with Google” on the Next.js UI.
   - Better Auth handles OAuth, applies env-driven scopes, stores user/session records in MongoDB, and issues a signed session cookie.
2. **Dashboard load**
   - Server components call `auth.api.getSession` to fetch the active session.
   - UI renders responder console + exposes REST/WebSocket endpoints pre-authenticated via cookies.
3. **User prompt → `responder_outbox`**
   - `/api/responder/messages` validates the session, writes `{ userId, content, status: "pending" }` into `responder_outbox`.
4. **Python responder processing**
   - FastAPI/worker polls `responder_outbox`, locks message, enriches context from the user doc + memory buffer, and calls ElevenLabs.
   - Agent replies are persisted into `responder_events` with `role="assistant"` + metadata.
5. **Live stream back to UI**
   - Next.js WebSocket server watches `responder_events` change stream for the user and broadcasts `messages:init` + `messages:append` payloads.
   - React client consumes the stream and renders transcript updates in real-time.
6. **Background enrichments (planned)**
   - Offline workers monitor transcripts/events, update astro insights, and push fresh responder events when new guidance is available.

## Responder Prompt (responder.md)
[Keep as-is, but update placeholders: {{pinned_facts}}, {{astro_overview}}, {{overview}}, {{preferences}}, {{events}} (no recent_messages; external recap). Add: "Use {{astro_overview}} (Markdown) for detailed astro insights. Use memory_tokens if tools needed (limited 2-3)."]

## Tech Stack
- **Gateway:** Next.js 14 (App Router) + Better Auth + TypeScript
- **Agents:** Python FastAPI, asyncio workers, ElevenLabs SDK
- **Database:** MongoDB Atlas (shared across auth + agents)
- **Real-time:** WebSockets (Next.js API route) + MongoDB change streams
- **Background:** Async workers + future task queue (TBD)
- **Astrology:** flatlib/swisseph (planned)

---

## Quick Links

**Related Documentation:**
- 📘 [Component Technical Reference](COMPONENTS.md)
- 👤 [Jadugar Persona Specifications](PERSONA.md)
- 💾 [Memory Buffer Field Reference](MEMORY_BUFFER.md)
- 🔄 [Process Workflows](WORKFLOWS.md)
- 🤖 [Agent Directives](../AGENTS.md)

**Key Files:**
- `scripts/elevenlabs_agent_runner.py` - WebSocket runner implementation
- `services/google_auth_service.py` - OAuth service implementation
- `buffer/memory_buffer.json` - User context storage
- `responder.md` - Jadugar persona prompt
- `config.json` - Configuration (env vars override)
