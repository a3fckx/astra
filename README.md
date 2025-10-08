# Astra — Astrology Companion

Astra delivers a multi-user astrology assistant (“Jadugar”) with Google sign-in, Mongo-backed persistence, and Julep-managed agent workflows. The stack is now 100% Next.js — legacy Python services have been retired.

---

## Architecture Snapshot

```
Browser
  │
  ▼
Next.js (App Router, Better Auth, REST + WebSocket routes)
  │ MongoDB Atlas (users, sessions, responder queues)
  ▼
Julep Agents (tasks, docs, secrets, background workflows)
```

- **Authentication:** Better Auth Google provider + Mongo adapter.
- **Responder Surface:** `/api/responder/messages` REST endpoint and `/api/responder/socket` WebSocket stream.
- **Agents & Memory:** Julep project `astra` holds users, docs (`type=profile|preferences|notes`), and task automation.
- **Persona Assets:** Stored under `agents/` (e.g., `agents/responder/prompt.md`).

---

## Project Layout

```
astra/
├── app/                # Next.js application
│   ├── src/app/        # Routes (App Router) + dashboard
│   ├── src/lib/        # Auth, env, Mongo helpers
│   ├── src/components/ # UI widgets (auth buttons, console)
│   └── package.json    # Scripts + Biome config
├── agents/             # Agent prompts and documentation
└── docs/               # Contributor and agent documentation
```

---

## Getting Started

```bash
# 1. Install dependencies
cd app
npm install

# 2. Configure environment
cp .env.example .env
# Fill in MongoDB + Google OAuth + Better Auth secret

# 3. Run the app
npm run dev        # http://localhost:3000
```

Available scripts:

```bash
npm run lint       # Biome check/format (fixes in-place)
npm run build      # Production build
npm run start      # Start built app
```

Environment variables (stored in `app/.env`, never committed):

- `MONGODB_URI` **or** `MONGODB_USERNAME` / `MONGODB_PASSWORD` / `MONGODB_CLUSTER`
- `MONGODB_DB` (default: `astra`)
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `GOOGLE_ENABLE_BIRTHDAY_SCOPE` (default `true`)
- `GOOGLE_ENABLE_GMAIL_READ_SCOPE` (default `false`)
- `NEXT_PUBLIC_APP_URL` (optional, e.g., deployment base URL)

---

## Working with Julep

Use the pre-provisioned Julep project `astra`:

- Create users: `client.users.create(project="astra")`
- Seed docs: create at least `type=profile` and `type=preferences` with metadata (`scope`, `updated_by`, `timestamp_iso`)
- Store secrets (e.g., `JULEP_API_KEY`, external model/API keys) in Julep Secrets
- Background automation should run as durable Julep tasks that write back to the same docs
- Conversation summaries and memory updates belong in user docs, not the Next.js filesystem

---

## Session Tracking

Keep active notes in `.sessions/SESSION.md`:

```bash
./session.sh start   # create from template
./session.sh view    # display current notes
./session.sh backup  # archive with timestamp
./session.sh clear   # remove when finished
```

See [`docs/SESSION_TRACKING.md`](docs/SESSION_TRACKING.md) for expectations.

---

## Conventions

- **Code quality:** Run `npm run lint` (Biome) before committing.
- **TypeScript:** Treat `app/src/lib/env.ts` as the canonical env loader — validate and document new variables there.
- **Secrets:** Never commit real API keys. Keep `.env.example` in sync with required variables.
- **Persona updates:** Edit `agents/responder/prompt.md` and reflect changes in `docs/PERSONA.md`.
- **Git workflow:** Main holds the historical snapshot; new work occurs on feature branches (e.g., `dev`).

---

## Reference Docs

- 📘 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — System overview
- 🔄 [`docs/WORKFLOWS.md`](docs/WORKFLOWS.md) — Auth + responder flows
- 🧩 [`docs/COMPONENTS.md`](docs/COMPONENTS.md) — Module breakdown
- 👤 [`docs/PERSONA.md`](docs/PERSONA.md) — Jadugar voice & tone
- 📝 [`docs/SESSION_TRACKING.md`](docs/SESSION_TRACKING.md) — Session workflow

---

## License

Proprietary — All rights reserved.

For questions or support, create a GitHub issue or consult the latest session notes.
