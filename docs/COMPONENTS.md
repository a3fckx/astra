# Components Reference

This document breaks down the major pieces of the revamped Astra codebase (Next.js + Julep).

---

## Next.js Gateway

### Auth & Sessions
- **Files:** `app/src/lib/auth.ts`, `app/src/lib/mongo.ts`, `app/src/lib/env.ts`
- **Purpose:** Configure Better Auth with the Mongo adapter, load env vars safely, and expose helper utilities to server components.
- **Key behaviours:**
  - Validates required env vars (`BETTER_AUTH_SECRET`, Google credentials, Mongo URI).
  - Scopes Google OAuth access (birthday scope enabled by default, Gmail optional).
  - Surfaces session helpers (`auth.api.getSession`) for server routes/components.

### API Routes
- `app/src/app/api/responder/messages/route.ts`  
  Authenticated `POST` endpoint that writes user prompts into the responder queue and ensures they are tagged with the Julep user ID.

- `app/src/pages/api/responder/socket.ts`  
  WebSocket handler that streams change events from `responder_events` back to the dashboard. Uses cookies for auth.

### Dashboard UI
- `app/src/app/dashboard/page.tsx` — Server component that gates the responder console behind Google auth.
- `app/src/components/auth-buttons.tsx` — Google login/logout controls.
- `app/src/components/responder-console.tsx` — Client component handling websocket events and rendering conversation history.

---

## Agents Assets

- `agents/responder/prompt.md` — Jadugar system prompt. Keep persona updates synchronized with `docs/PERSONA.md`.
- `agents/README.md` — Guidelines for structuring agent assets.

When adding new agents, create subfolders under `agents/` (e.g., `agents/background-summarizer/`).

---

## MongoDB Collections (Recommended Schema)

| Collection | Purpose | Managed By |
| --- | --- | --- |
| `users`, `sessions` | Better Auth identity + session storage | Next.js |
| `responder_outbox` | Pending user prompts awaiting processing | Next.js writes, Julep tasks consume |
| `responder_events` | Assistant/system events emitted back to UI | Julep tasks write, Next.js streams |

Collections are not provisioned by code; create them via MongoDB Atlas or automation tooling.

---

## Julep Resources

- **Project:** `astra`
- **Required operations:**
  - `client.users.create(project="astra")`
  - `client.users.docs.create(project="astra", user_id=..., type="profile" | "preferences", metadata={...})`
  - Durable tasks for background automation (horoscope refresh, summary writers, etc.)
- **Metadata conventions:**  
  - `scope`: `frontline` (used in live chats) or `background` (auxiliary data)  
  - `type`: `profile`, `preferences`, `notes`, `horoscope`, etc.  
  - `updated_by`: agent identifier  
  - `timestamp_iso`: ISO8601 string

Store secrets (API keys, voice IDs) inside Julep Secrets and reference them from tasks instead of `.env`.

---

## Tooling

- **Package scripts** (see `app/package.json`):
  - `npm run dev` — Next.js dev server
  - `npm run lint` — `biome check --fix src`
  - `npm run build` / `npm run start`
- **Biome configuration:** `app/biome.json`
- **TypeScript configuration:** `app/tsconfig.json`
- **Environment template:** `app/.env.example`

Run `npm run lint` before committing changes.

---

## Extending the System

1. **Add new APIs:** Place handlers under `app/src/app/api/`. Use server components for authenticated logic.
2. **Create new agents:** Add prompt/config files under `agents/`, document them in `docs/`, and set up matching Julep tasks.
3. **Background jobs:** Implement as Julep tasks; update documentation to describe triggers and expected outputs.
4. **Realtime updates:** When introducing new event types, update the WebSocket payload contract in `responder-console.tsx`.
