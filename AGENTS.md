# AGENTS.md — Astra Coding Agent Directive

> **Note:** This file is the operational brief for AI coding agents. For in-depth technical docs, see the [`docs/`](docs) directory.

---

## Quick Reference

- **Project:** Astra — multi-user astrology companion ("Jadugar" persona)
- **Voice Interface:** ElevenLabs React SDK (`@elevenlabs/react`)
- **Authentication:** Better Auth + Google OAuth + MongoDB Atlas
- **Orchestration:** Julep (user memory, sessions, agent tasks)
- **UI Stack:** Next.js 15 (App Router), React 18, TypeScript, Biome
- **Runtime:** Single Next.js service — no background workers

### Current Layout

```
astra/
├── app/                    # Next.js application
│   ├── src/components/     # Voice UI (ElevenLabs SDK)
│   ├── src/app/api/        # REST APIs (auth, session, signed URLs)
│   ├── src/lib/            # Utilities (auth, mongo, julep, elevenlabs)
│   └── scripts/            # Agent sync utility
├── agents/                 # Julep agent definitions (YAML)
└── docs/                   # Architecture & persona docs
```

**Key Files**

- `app/src/components/voice-session.tsx` — Voice UI using ElevenLabs `useConversation` hook
- `app/src/app/api/responder/session/route.ts` — Session handshake (Julep + integration tokens)
- `app/src/app/api/elevenlabs/signed-url/route.ts` — Generates signed WebSocket URLs
- `app/src/lib/auth.ts` — Better Auth config (MongoDB adapter + Google scopes)
- `app/src/lib/julep-docs.ts` — Julep user/session/memory management
- `app/src/lib/elevenlabs.ts` — ElevenLabs client initialization
- `agents/responder/prompt.md` — Jadugar persona prompt
- `.sessions/template.md` — Session logging template (use via `session.sh`)
- `.pre-commit-config.yaml` — Syncs `AGENTS.md` to `Claude.md` before commits

---

## Voice Flow (Current Architecture)

1. **Auth** — Better Auth Google provider issues secure session cookie backed by MongoDB.
2. **Session Handshake** — `/api/responder/session` returns:
   - Julep session ID (for memory recall)
   - Integration tokens (memory-store, elevenlabs)
   - User context (name, email, birth data)
3. **Voice Connection** — ElevenLabs React SDK handles:
   - WebSocket connection via signed URL (`/api/elevenlabs/signed-url`)
   - Audio streaming and transcription
   - Agent responses via TTS
   - Dynamic variables injected at session start (user_name, workflow_id, julep_session_id, tokens)
4. **Memory** — Julep stores per-user docs (`type=profile|preferences|notes`):
   - Profiles seeded at signup (name, email, birth data from Google People API)
   - Conversation summaries written by agent via Memory Store MCP
   - Metadata filters control recall (`scope=frontline|background`)

---

## Julep Orchestration

- Always call `client.users.*` with `project="astra"`.
- Seed each new user with baseline docs: at minimum `type=profile` and `type=preferences` including `scope`, `updated_by`, and `timestamp_iso`.
- Use doc metadata filters (`scope=frontline|background`, `type=horoscope|notes|profile`) to control recall.
- Store runtime secrets (e.g., `JULEP_API_KEY`, external provider keys) in Julep Secrets — mirror what lives in `app/.env`.
- Realtime chats: open sessions with `recall=true` so agents can access user memory docs.
- Background agents: define durable Julep tasks for horoscope refresh, persona enrichment, etc. Each task writes to the same user docs and must respect metadata conventions.

Reference material inside Julep workspace:
- `documentation/concepts/agents.mdx`
- `documentation/concepts/docs.mdx`
- `documentation/concepts/sessions.mdx`
- `documentation/concepts/secrets.mdx`
- `documentation/integrations/extensibility/mcp.mdx`

---

## Build / Lint / Run

```bash
# Install dependencies (Bun)
cd app
bun install

# Development server (http://localhost:3000)
bun run dev

# Type-safe formatting + linting (Biome)
bun run lint

# Production build
bun run build
bun run start

# Sync Julep agents
bun run sync:agents
```

Environment variables (stored in `app/.env` — never commit secrets):

- `MONGODB_URI` or `MONGODB_USERNAME` / `MONGODB_PASSWORD` / `MONGODB_CLUSTER`
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`
- `JULEP_API_KEY`, `ASTRA_AGENT_ID`
- Optional: `GOOGLE_ENABLE_BIRTHDAY_SCOPE`, `GOOGLE_ENABLE_GMAIL_READ_SCOPE`

---

## Session Tracking (Important)

Always maintain `.sessions/SESSION.md` during active work.

```bash
./session.sh start   # create SESSION.md from template
./session.sh view    # show current notes
./session.sh backup  # archive with timestamp
./session.sh clear   # remove when done
```

- One active session file at a time (gitignored).
- Track goals, files touched, commands executed, decisions, blockers.
- No summary sidecar files; everything lives in `SESSION.md`.

See [`docs/SESSION_TRACKING.md`](docs/SESSION_TRACKING.md) for full workflow.

---

## Code Style Guidelines

### TypeScript / React

- Prefer server components except where interactivity demands client components.
- Use async/await for data fetching inside server actions; handle errors with meaningful responses.
- Keep React components small and focused; colocate related utilities under `app/src/lib/`.
- Validate external inputs (API routes) and return typed payloads.
- Employ Biome (`bun run lint`) before committing.

### Environment Handling

- Guard all required env vars via helper utilities (see `app/src/lib/env.ts`).
- Never ship real secrets. Use `.env.example` for placeholders only.
- MongoDB access stays inside the Next.js app; agents read/write through Julep APIs.

### Anchor Comments & Function Docs

- We embed `ANCHOR:` comments beside business-critical logic so every agent understands *why* a choice exists. Treat them as living breadcrumbs—update or remove them if the rationale changes.
- Current anchors to know:
  - `app/src/components/voice-session.tsx` — `mcp-memory-approval` explains auto-approval of Memory Store MCP tool calls when user tokens exist.
  - `app/src/lib/integration-tokens.ts` — `integration-token-lifecycle` documents per-user token resolution with fallback patterns.
- When you add or modify voice/memory-specific behavior, write a short function-level docstring explaining its role and include an `ANCHOR:` comment if the logic is business-specific.

### Testing Expectations

- Run `bun run lint` before handing work back; this is our fast guard against TypeScript or formatting regressions.
- For voice changes, perform a manual smoke test:
  1. Load the homepage, ensure authenticated users see the voice session UI.
  2. Check browser console for ElevenLabs connection status and agent responses.
  3. Verify Memory Store MCP auto-approval when integration token exists.
- For API changes, test session handshake returns correct Julep session ID and integration tokens.
- If you introduce new anchor comments or business rules, note which test validates them directly (manual, unit, or integration).

---

## Quick Links

- 📘 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — System architecture overview
- 👤 [`docs/PERSONA.md`](docs/PERSONA.md) — Jadugar persona details
- 🧠 [`docs/SHARED_MEMORY_ARCHITECTURE.md`](docs/SHARED_MEMORY_ARCHITECTURE.md) — Memory Store integration
- 📝 [`docs/SESSION_TRACKING.md`](docs/SESSION_TRACKING.md) — Session logging rules
- 🏃 [`docs/RUN.md`](docs/RUN.md) — Local development setup
- 🗂️ [`agents/responder/prompt.md`](agents/responder/prompt.md) — System prompt source

---

## Support

- Documentation lives under `docs/`.
- Report issues via GitHub Issues.
- For project-wide context or clarifications, consult the latest `SESSION.md` log.
