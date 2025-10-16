# Shared Memory Architecture

## Why This Exists
- Keep the voice-first experience grounded in persistent user context.
- Let background agents enrich what Astra knows without blocking the real-time flow.
- Feed ElevenLabs dynamic variables with the freshest snapshot of user insights.

## End-to-End Flow (Current Iteration)
1. **Auth + Session Handshake**  
   `/api/responder/session` resolves the Better Auth session, retrieves Mongo-backed user metadata, and opens/returns a Julep session (`ANCHOR:dynamic-session-variables`).
2. **Conversation Session**  
   `VoiceSession` starts an ElevenLabs workflow, injects dynamic variables, and logs each conversation start to Mongo (`ANCHOR:conversation-ledger`).
3. **Telemetry Fan-out**  
   Conversation IDs accumulate on the user document (`elevenlabs_conversations[]`) for downstream processing (`ANCHOR:conversation-history-array`).
4. **Background Summarizer (Julep Agent)**  
   A durable Julep task consumes new conversation IDs, fetches transcripts, produces user-level insights, and writes them back to Mongo + Julep docs.
5. **Next Live Turn**  
   On the next login, the refreshed summaries are surfaced to ElevenLabs via dynamic variables so Jadugar can reference them immediately.

```
 ┌──────────────┐      ┌────────────┐      ┌──────────────────┐
 │  ElevenLabs  │─────▶│  Next.js   │─────▶│  MongoDB (user)  │
 │  Voice SDK   │      │  Session   │      │  + Collections   │
 └──────┬───────┘      └────┬───────┘      └────────┬─────────┘
        │ conversation_id        │                       │
        │ telemetry              │                       │
        ▼                       ▼                       ▼
 ┌──────────────┐      ┌────────────┐      ┌──────────────────┐
 │ ElevenLabs   │─────▶│ Julep Task │─────▶│ Julep User Docs  │
 │ Transcript   │      │  Summarizer│      │ (profile/notes)  │
 └──────────────┘      └────────────┘      └──────────────────┘
```

## Mongo Footprint

| Collection | Key Fields | Purpose |
|------------|------------|---------|
| `user` | `astro_overview`, `conversation_digest`, `elevenlabs_conversations[]`, birth data fields | Fast access during session handshake and dynamic variable injection. |
| `elevenlabs_conversations` | `conversation_id`, `workflow_id`, `status`, `ended_at`, `duration_ms`, `metadata`, timestamps | Source of truth for raw ElevenLabs conversations and trigger for summarizer. |
| `astra_sessions` | `julep_session_id`, `agent_id` | Cached mapping between users and Julep sessions. |
| `integration_tokens` | `token`, `metadata` | Enables MCP Memory Store auto-approval in the voice UI. |

Conversation records flow through three lifecycle states:
- `active` — persisted as soon as ElevenLabs hands back a `conversation_id`.
- `completed` — recorded when the session ends cleanly (user stop or remote disconnect) and stamped with `ended_at` + `duration_ms`.
- `abandoned` — set when the client exits unexpectedly or the SDK surfaces an error so background jobs can skip partial transcripts.

**`astro_overview`**  
Single string containing the canonical “what Astra knows about the user” narrative. Includes birth data, personality cues, and high-signal preferences.

**`conversation_digest`**  
JSON object with at least:
- `latest_summary` — recency weighted digest of the last full conversation.
- `last_updated_iso` — ISO timestamp from the summarizer run.
- `topics` — ordered array of `{ topic, sentiment, confidence }`.

These fields feed dynamic variables directly.

## Julep Summarizer Agent Blueprint

```yaml
# agents/conversation-summarizer.yaml (sketch)
trigger:
  type: cron|manual|webhook
  filter:
    new_conversation: true

steps:
  - name: load_conversation
    description: Fetch ElevenLabs transcript via curl helper.
    tool: elevenlabs_transcript_fetch
    arguments:
      conversation_id: ${{ input.conversation_id }}

  - name: analyze
    description: Generate overview + sentiments + to-dos.
    prompt: agents/responder/summarizer.md
    input:
      user_profile: ${{ tools.search_user_profile(...) }}
      transcript: ${{ steps.load_conversation.output }}

  - name: persist_mongo
    tool: mongo.update_user_profile
    arguments:
      user_id: ${{ input.user_id }}
      astro_overview: ${{ steps.analyze.output.astro_overview }}
      conversation_digest: ${{ steps.analyze.output.conversation_digest }}

  - name: persist_julep_doc
    tool: julep.create_user_doc
    arguments:
      user_id: ${{ input.user_id }}
      title: "Conversation Summary - ${{ now_iso }}"
      content: ${{ steps.analyze.output.full_summary }}
      metadata:
        type: "notes"
        scope: "frontline"
        updated_by: "conversation-summarizer"
        source: ${{ input.conversation_id }}
```

**Transcript Fetching**  
Use ElevenLabs Conversations API (`curl https://api.elevenlabs.io/v1/conv/...`) with the user-scoped agent token. The React SDK doc snippet works unchanged— wrap it in a Julep MCP tool so the agent can call it securely.

**Idempotency**  
Store `conversation_id` + `run_id` in Mongo (`conversation_digest.processed_conversations[]`) to avoid double processing if the cron overlaps.

## Dynamic Variable Contract

| Variable | Source | Notes |
|----------|--------|-------|
| `user_name` | `handshake.session.user.name` | Fallback to email username. |
| `workflow_id` | Query param or default `astra-responder` | Keeps ElevenLabs workflow routing consistent. |
| `julep_session_id` | Cached in `astra_sessions` | Enables recall in real-time chat. |
| `memory_store_token` | `integration_tokens` lookup | Controls auto-approval in `ANCHOR:mcp-memory-approval`. |
| `elevenlabs_user_token` | `integration_tokens` lookup | Required for transcript retrieval and SDK reconnects. |
| `date_of_birth`, `birth_time`, `birth_place` | Mongo `user` document | Optional, sent when available. |
| `astro_overview` | Mongo `user.astro_overview` | Summarizer output; empty string when not yet computed. |
| `latest_conversation_summary` | `user.conversation_digest.latest_summary` | High-level refresher injected before each turn. |

`VoiceSession` already sanitizes falsy values; new fields must adhere to the same pattern (no `undefined`, trimmed strings).

## Julep Document Strategy
- **Profile (`type=profile`)**: remains the source of truth for static birth data and baseline traits. Initial seeding handled by `seedUserDocs`.
- **Preferences (`type=preferences`)**: persona enrichment agent updates communication style, likes/dislikes.
- **Notes (`type=notes`)**: conversation summarizer writes narrative summaries per session with metadata `{ scope: frontline, source: <conversation_id> }`.
- **Analysis (`type=analysis`)**: dedicated astrology computations (charts, transits) performed by background workers.

These documents are always created with `shared=true` so both real-time and background agents can recall them.

## Operational Considerations
- **Triggering**: for now poll Mongo for new `elevenlabs_conversations` entries. Eventually replace with change stream webhook once stable.
- **Error Handling**: failed summaries should log to `conversation_digest.failures[]` with `error_message` and `timestamp_iso` so we can re-queue.
- **Secrets**: ElevenLabs + Julep API keys live in Julep Secrets, mirrored in `app/.env`. Never embed raw keys in agent YAML.
- **Manual Overrides**: `bun run set:memory-token` remains the path to seed Memory Store MCP tokens when auto-provisioning is unavailable.

## Next Steps Checklist
- [ ] Build MCP wrapper for ElevenLabs transcript endpoint.
- [ ] Define `astro_overview` / `conversation_digest` fields on Mongo user schema and backfill existing records.
- [ ] Author `agents/responder/summarizer.md` prompt with clear guidance for tone, sentiment extraction, and horoscope-focused insights.
- [ ] Wire a Julep durable task that processes unhandled conversation IDs on a schedule.
- [ ] Extend `VoiceSession` dynamic variables once Mongo fields exist.
- [ ] Add smoke tests: verify dynamic variables include new keys when data is present, and ensure background agent writes to both Mongo + Julep docs.
