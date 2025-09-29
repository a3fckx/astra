# ElevenLabs Agent Runner — Quick Guide

- Start a session
- Edit `config.json`:
  - `agent_id` (always)
  - `elevenlabs_api_key` or set the `ELEVENLABS_API_KEY` env var (needed to fetch signed URLs)
  - `auth_mode`: `auto` (default) fetches a signed URL on launch; `signed_url_fetch` enforces that fetch; `public` is only for public agents and skips auth.
  - Voice/language overrides are optional.
  - You no longer need to store a `signed_url`; one is generated on the fly each run.
- Dependencies: inside `.venv`, run `uv pip install websockets requests`.
- Keep your system prompt in `responder.md` (Jadugar) with `{{placeholders}}`.
- Keep your memory in `buffer/memory_buffer.json` (pinned_facts overview, astro_snapshot, context, user_preferences, recent_messages, latest_user_message, etc.).
- Run (dry): `python3 scripts/elevenlabs_agent_runner.py --dry`
- Run (live): `python3 scripts/elevenlabs_agent_runner.py`

## Why WebSocket runner?
- Fine-grained control over contextual updates (`contextual_update` events via file watcher or queue).
- Custom client tools (e.g., `getMemoryBuffer`, `getConversationHistory`) so the agent can request refreshed facts mid-turn.
- Signed URL generated fresh each run; no long-lived secrets in `config.json`.
- Rich logging and soon-to-be orchestrator hooks.

## SDK variant (minimal)
- Use when you just need a quick session without custom orchestration.
- Install dependency inside the virtualenv first: `uv pip install elevenlabs`
- Launch: `python3 scripts/minimal_sdk_runner.py`

Mid‑session updates (no reconnect)
- File watcher: when `buffer/memory_buffer.json` changes, a short `contextual_update` is sent automatically if `watch_memory_updates` is true.
- Queue push: append updates without touching the socket code.
  - `python3 scripts/elevenlabs_agent_runner.py --enqueue-update "Context update: astro_snapshot"`
  - Target a conversation: `--conversation-id <id>` (matched against the active session id when available)
  - Config keys: `enable_updates_queue`, `updates_queue_path`

Transcripts
- The runner prints `[user]` and `[agent]` lines.
- Optional file log: set `log_transcripts_to_file` in `config.json` (e.g., `buffer/transcripts/session.log`).

Tools (agent → client)
- `getMemoryBuffer`: returns the latest variables map (stringified `memory_buffer.json`).
- `getConversationHistory`: returns the last `recent_max` messages from the in‑session transcript.

Talk‑to URL seeding (Method 1)
- Base64 JSON in URL is a simple way to preload dynamic variables:
  - `https://elevenlabs.io/app/talk-to?agent_id=AGENT&vars=BASE64URL(JSON)`
  - Use URL‑safe, Unicode‑safe base64.

Best practices
- Prefer dynamic variables at session start; use `contextual_update` mid‑session.
- Keep dynamic variables compact (a few KB). Put longer text in `context` and summarize in updates.
- For major prompt changes, restart the session to re‑inject the prompt + variables.
- Auth flow: by default the runner fetches a signed URL with your API key. Make sure the environment has network access; otherwise the script will terminate with the fetch error instead of attempting an unauthenticated connection.

Optional overrides
- By default, we only override the system prompt and inject dynamic variables.
- To also override language, first message, or voice, set these flags in `config.json`:
  - `override_language: true` (uses `language`)
  - `override_first_message: true` (uses `first_message`)
  - `override_tts: true` (uses `voice_id`)
