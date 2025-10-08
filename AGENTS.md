# AGENTS.md — Astra Coding Agent Directive

> **Note:** This file is the operational brief for AI coding agents. For in-depth technical docs, see the [`docs/`](docs) directory.

---

## Quick Reference

- **Project:** Astra — multi-user astrology companion (“Jadugar” persona)
- **Execution Surface:** Next.js 15 (App Router) + Better Auth + MongoDB Atlas
- **Orchestration:** Julep project `astra` (users, docs, tasks, secrets)
- **UI Stack:** React 18, TypeScript, Biome for lint/format
- **Runtime Footprint:** Frontend/UI service only — Python monolith removed

### Current Layout

```
astra/
├── app/            # Next.js application (auth, API routes, dashboard)
├── agents/         # Agent prompts & metadata (e.g., responder persona)
└── docs/           # Documentation for contributors & agents
```

**Key Files**

- `app/package.json` — Scripts (`dev`, `build`, `lint`) and Biome setup
- `app/src/lib/auth.ts` — Better Auth server config (Mongo adapter + Google scopes)
- `app/src/app/api/responder/messages/route.ts` — Authenticated REST ingress
- `app/src/pages/api/responder/socket.ts` — WebSocket streaming bridge
- `app/src/app/dashboard/page.tsx` — Signed-in responder console
- `agents/responder/prompt.md` — Jadugar system prompt
- `.sessions/template.md` — Session logging template (use via `session.sh`)

---

## Responder Flow (Target State)

1. **Auth** — Better Auth Google provider issues secure session cookie backed by MongoDB.
2. **Ingress** — `/api/responder/messages` writes authenticated prompts into a queue (Mongo collection or Julep task trigger).
3. **Processing** — Julep agents consume the queue, call external LLM/TTS providers, and persist deltas to `responder_events`.
4. **Streaming** — `/api/responder/socket` tail-follows `responder_events` and streams JSON patches to the dashboard UI.
5. **Memory** — Per-user docs in Julep (`type=profile|preferences|notes`) act as the memory surface; summaries written after each conversation turn.

*Python-based workers, `config.json`, and memory-buffer files have been removed. All stateful agent logic now lives in Julep tasks or future TypeScript utilities.*

---

## Julep Orchestration

- Always call `client.users.*` with `project="astra"`.
- Seed each new user with baseline docs: at minimum `type=profile` and `type=preferences` including `scope`, `updated_by`, and `timestamp_iso`.
- Use doc metadata filters (`scope=frontline|background`, `type=horoscope|notes|profile`) to control recall.
- Store runtime secrets (e.g., `JULEP_API_KEY`, external provider keys) in Julep Secrets — mirror what lives in `app/.env`.
- Realtime chats: open sessions with `recall=true` and stream assistant deltas back to the dashboard + TTS provider; persist concise turn summaries into the user doc.
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
# Install dependencies
cd app
npm install

# Development server (http://localhost:3000)
npm run dev

# Type-safe formatting + linting (Biome)
npm run lint

# Production build
npm run build
npm run start
```

Environment variables (stored in `app/.env` — never commit secrets):

- `MONGODB_URI` or `MONGODB_USERNAME` / `MONGODB_PASSWORD` / `MONGODB_CLUSTER`
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- Optional toggles: `GOOGLE_ENABLE_BIRTHDAY_SCOPE`, `GOOGLE_ENABLE_GMAIL_READ_SCOPE`

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
- Employ Biome (`npm run lint`) before committing.

### Environment Handling

- Guard all required env vars via helper utilities (see `app/src/lib/env.ts`).
- Never ship real secrets. Use `.env.example` for placeholders only.
- MongoDB access stays inside the Next.js app; agents read/write through Julep APIs.

---

## Quick Links

- 📘 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Next.js + Julep overview
- 🔄 [`docs/WORKFLOWS.md`](docs/WORKFLOWS.md) — Auth & responder flows
- 🧩 [`docs/COMPONENTS.md`](docs/COMPONENTS.md) — Module-level reference
- 👤 [`docs/PERSONA.md`](docs/PERSONA.md) — Jadugar persona details
- 📝 [`docs/SESSION_TRACKING.md`](docs/SESSION_TRACKING.md) — Session logging rules
- 🗂️ [`agents/responder/prompt.md`](agents/responder/prompt.md) — System prompt source

---

## Support

- Documentation lives under `docs/`.
- Report issues via GitHub Issues.
- For project-wide context or clarifications, consult the latest `SESSION.md` log.
