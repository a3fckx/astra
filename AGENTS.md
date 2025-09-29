# AGENTS.md - Agent Guidelines for Astra Project

## Build/Lint/Test Commands
- **Install dependencies**: inside `.venv`, run `uv pip install websockets requests`
- **Run agent (WebSocket)**: `python scripts/elevenlabs_agent_runner.py`
- **Dry run**: `python scripts/elevenlabs_agent_runner.py --dry`
- **SDK fallback**: `python scripts/minimal_sdk_runner.py` (requires `uv pip install elevenlabs`)
- **Run single test**: No test framework configured; use `python -m pytest` if tests are added
- **Lint**: `python -m flake8 scripts/` or `python -m black scripts/ --check`
- **Format**: `python -m black scripts/`

## Code Style Guidelines

### Python Standards
- Use Python 3.8+ with type hints throughout
- Follow PEP 8 naming: `snake_case` for functions/variables, `PascalCase` for classes
- Use descriptive variable names; avoid single-letter variables except in comprehensions

### Imports
- Standard library first, then third-party, then local imports
- Group imports with blank lines between groups
- Use absolute imports: `from typing import Dict, Any`

### Error Handling
- Use specific exception types, not bare `except:`
- Log errors appropriately; avoid silent failures
- Validate inputs early with clear error messages

### JSON/Data Handling
- Use `json.dumps()` with `ensure_ascii=False` for Unicode support
- Validate JSON structure before processing
- Handle missing keys gracefully with `.get()` or `dict.get(key, default)`
- Dynamic variables are injected only at session start; use contextual updates mid-session instead of rewriting the prompt.

### Configuration
- Keep `config.json` as the single source of truth (API keys, agent ID, voice).
- Set `elevenlabs_api_key` locally; do not commit secrets — add a `.example` if sharing.
- For SDK audio sessions, keep `sdk_audio_playback` and `sdk_microphone_capture` true to use ElevenLabs’ streamed audio.
- Store config in `config.json`; never hardcode sensitive values
- Prefer environment variables for API keys (`ELEVENLABS_API_KEY`).
- Validate required config fields at startup.
- For private agents, fetch the signed URL dynamically on launch; do not store it long-term.

### Async/WebSocket Code
- Use `asyncio` for async operations.
- Handle WebSocket errors gracefully with try/except.
- Keep message processing modular and readable.
- Push contextual updates only after the server sends `conversation_initiation_metadata` (so conversation_id is known).
- Prefer the queue helper (`--enqueue-update`) for multi-agent coordination.

### Documentation
- Use semantic commit messages (e.g., `feat:`, `fix:`, `docs:`) for all repo commits.
- Add docstrings to public functions with parameter/return descriptions
- Comment complex logic; keep comments concise and current
- Use type hints instead of comments for parameter types
