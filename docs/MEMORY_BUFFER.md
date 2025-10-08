# Memory Surface — Julep Docs

The filesystem-based `memory_buffer.json` has been removed. Long-term context is now stored inside Julep user docs.

---

## Doc Taxonomy

| Type | Scope | Purpose | Notes |
| --- | --- | --- | --- |
| `profile` | `frontline` | Canonical identity info (name, birth data, timezone) | Seed immediately after signup |
| `preferences` | `frontline` | Tone, language, consent flags | Update as user toggles settings |
| `notes` | `background` | Longer reflections, astrology insights | Summaries appended post-session |
| `horoscope` | `background` | Structured astro data (transits, houses) | Optional; keep under 10 KB |

Use metadata fields:
- `scope`: `frontline` (load during live chats) or `background` (used by background agents).
- `updated_by`: identifier of the agent/task writing the doc.
- `timestamp_iso`: ISO8601 string of last update.
- `tags`: optional array for custom filters (e.g., `["transits", "daily"]`).

---

## Access Patterns

### During Live Sessions
1. Retrieve frontline docs (`scope=frontline`) via Julep recall API when starting a chat.
2. Provide the data to the responder model as structured JSON or embedded context.
3. Avoid large payloads — keep combined size < 10 KB for fast prompts.

### Background Enrichment
1. Monitor conversation summaries or external signals.
2. Write new insights into `notes` or `horoscope` docs (`scope=background`).
3. Emit responder events when insights should surface to the user immediately.

---

## Sync with Next.js

- Store the Julep user ID alongside the Better Auth user record.
- When needed, the Next.js app can call Julep APIs (server-side) to fetch frontline docs before invoking models.
- Do **not** persist memory files on disk. All context lives in Julep.

---

## Size & Hygiene Guidelines

- Keep each doc under 10 KB to maintain fast recalls.
- Use structured JSON objects where possible; stringify only for complex Markdown fields.
- Prune stale events regularly via maintenance tasks.
- Never store secrets or tokens in frontline docs; use Julep Secrets instead.
