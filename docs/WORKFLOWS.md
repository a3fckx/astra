# Workflows

This guide outlines the primary flows in the trimmed-down Astra stack.

---

## 1. User Authentication

1. User clicks “Continue with Google”.
2. Better Auth initiates OAuth with scopes from `GOOGLE_ENABLE_*` toggles.
3. On success, Better Auth stores the user + session records in MongoDB.
4. `auth.api.getSession()` retrieves the session inside server components/API routes.

**Implementation Files**
- `app/src/lib/auth.ts`
- `app/src/lib/env.ts`
- `app/src/app/dashboard/page.tsx`

---

## 2. Prompt Submission

1. Browser sends a `POST` to `/api/responder/messages` with the prompt text.
2. The API route validates the session and resolves the caller’s Julep user ID (future enhancement: create if absent).
3. Payload is inserted into `responder_outbox` with metadata:
   ```json
   {
     "userId": "<better-auth-id>",
     "julepUserId": "<uuid>",
     "content": "...",
     "status": "pending",
     "createdAt": ISODate()
   }
   ```
4. Response returns `202 Accepted`.

**Implementation File:** `app/src/app/api/responder/messages/route.ts`

---

## 3. Agent Processing (Julep Task)

> **Note:** Python workers were removed. Implement this pipeline as a Julep task or external worker.

1. Poll `responder_outbox` for `status: "pending"`.
2. Fetch relevant Julep docs using metadata filters (profile, preferences, notes).
3. Call LLM / TTS provider; stream deltas to the dashboard if possible.
4. Append assistant events into `responder_events`.
5. Update the original outbox document to `status: "delivered"` or `status: "error"`.
6. Write short conversation summary into the user doc with updated metadata.

---

## 4. WebSocket Streaming

1. Dashboard opens a WebSocket connection to `/api/responder/socket`.
2. Server verifies the session, subscribes to MongoDB change stream on `responder_events`.
3. On new event, server emits JSON payloads:
   ```json
   {
     "type": "messages:append",
     "data": {
       "id": "<event-id>",
       "role": "assistant",
       "content": "..."
     }
   }
   ```
4. Client updates the UI in real time.

**Implementation File:** `app/src/pages/api/responder/socket.ts`

---

## 5. Memory Updates

Post-turn, write summaries to Julep docs:
- `scope`: `frontline` for conversation-ready snippets, `background` for long-form analysis.
- `type`: `notes`, `horoscope`, `preferences`, etc.
- `updated_by`: identifier of the process (e.g., `responder-task`)
- `timestamp_iso`: ISO timestamp

This replaces the old filesystem `buffer/memory_buffer.json`.

---

## Operational Checklist

- Keep MongoDB connection details in `app/.env` and mirror secrets in Julep.
- Ensure new API routes verify sessions before accessing user data.
- Document new tasks/flows in `docs/` so future agents understand expectations.
