# AGENTS.md - Agent Directives for Astra

> **Note:** This is a directive document for AI coding agents. For detailed technical documentation, see **[docs/](docs/)** folder.

---

## Quick Reference

**Project:** Astra - Multi-user astrology conversational AI agent (Jadugar)

**Architecture:** Next.js + Better Auth SPA with Julep-managed agents (legacy FastAPI monolith kept for reference only)

**Full-Stack Technology:**
- **Backend:** Python 3.8+, FastAPI, MongoDB Atlas, ElevenLabs Conversational AI, Google OAuth
- **Frontend:** Next.js 14, React 18, TypeScript, Better Auth
- **Code Quality:** Ruff + Pyre (Python), Biome (TypeScript) - 10-100x faster than traditional tools

**Monolith Structure (legacy – decommission as Julep rolls out):**
```
astra/
├── backend/                  # Python FastAPI monolith (95% of logic)
│   ├── app/                 # Application code
│   ├── scripts/             # Standalone scripts
│   └── tests/               # Tests
├── app/                      # Next.js app (Better Auth + control center UI)
├── shared/                   # Shared resources (prompts, config)
└── docs/                     # Documentation
```

**Key Files:**
- `backend/app/main.py` - FastAPI application entry point (legacy)
- `backend/app/config.py` - Configuration management (env vars + JSON, legacy)
- `backend/app/services/google_auth.py` - OAuth service (legacy)
- `backend/scripts/agent_runner.py` - WebSocket agent runner (legacy)
- `backend/app/buffer/memory_buffer.json` - User context storage (legacy)
- `app/src/lib/auth.ts` - Better Auth configuration (Mongo-backed)
- `app/src/app/api/responder/messages/route.ts` - REST ingress for responder prompts
- `app/src/pages/api/responder/socket.ts` - WebSocket bridge streaming responder events
- `app/src/app/dashboard/page.tsx` - Authenticated responder console

**Responder data flow:**
- `responder_outbox` (Mongo collection) stores pending user prompts emitted by the Next.js API; Python workers consume and mark them delivered.
- `responder_events` captures assistant/system messages; the WebSocket route streams change events from this collection back to the dashboard.
- `shared/prompts/responder.md` - Jadugar persona prompt
- `shared/config/defaults.json` - Configuration defaults

**Documentation:**
- 📘 [docs/COMPONENTS.md](docs/COMPONENTS.md) - Component technical reference
- 👤 [docs/PERSONA.md](docs/PERSONA.md) - Jadugar persona specifications
- 💾 [docs/MEMORY_BUFFER.md](docs/MEMORY_BUFFER.md) - Memory buffer field reference
- 🔄 [docs/WORKFLOWS.md](docs/WORKFLOWS.md) - Process flows and sequences
- 🏗️ [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture overview
- 🔄 [docs/MIGRATION.md](docs/MIGRATION.md) - Migration guide (old → new structure)
- 📝 [docs/SESSION_TRACKING.md](docs/SESSION_TRACKING.md) - Session tracking system

---

## Julep Orchestration (In Flight)

- **Project scope:** Use the pre-created Julep project named `astra` for all agents, users, tasks, and docs. Always pass `project="astra"` (or the project ID) when creating resources so they stay isolated.
- **Credentials:** Keep `JULEP_API_KEY` in `app/.env`; never commit it. Mirror runtime secrets (e.g., `elevenlabs_api_key`, `elevenlabs_voice_id`, external astrology APIs) inside Julep Secrets so workflows can reference them securely.
- **User provisioning:** After Better Auth signup, call `client.users.create(project="astra")`, then immediately create baseline user docs via `client.users.docs.create`. Seed at least `type=profile` and `type=preferences` entries with metadata keys like `scope`, `updated_by`, `timestamp_iso`, and optional tags.
- **Memory model:** Treat user docs as the per-user memory surface. Use metadata filters (`scope=frontline|background`, `type=horoscope|notes|profile`) to control recall. Reserve agent docs for global context that multiple agents share.
- **Realtime chat:** The Next.js responder route should open Julep sessions with `recall=true` and the user’s Julep ID. Stream assistant deltas over WebSocket to ElevenLabs (API key + voice ID only) for TTS playback, then write short conversation summaries back into the user doc.
- **Background agents:** Define durable workflows (Julep Tasks) for horoscope refresh, persona enrichment, etc. Each task writes to the same user docs and can call MCP integrations or system tools to mutate memory safely.
- **External models:** You can run agents on non-OpenAI providers by configuring LiteLLM or integration tools in Julep and supplying their API keys as secrets. Reference those providers in `model` or tool definitions to keep responses sourced from your chosen vendor.
- **Documentation refs:** Core reads live in `documentation/concepts/agents.mdx`, `documentation/concepts/docs.mdx`, `documentation/concepts/sessions.mdx`, `documentation/concepts/secrets.mdx`, and `documentation/integrations/extensibility/mcp.mdx`.

---

## Session Tracking (IMPORTANT for AI Agents)

**Always use `.sessions/SESSION.md` to track your work during development.**

### When to Use

**Start a session when:**
- Beginning new development work
- Implementing features or fixes
- Making structural changes
- Working on a specific task/issue

**Track in SESSION.md:**
- ✅ Goals for this session
- 🚧 Changes made (files created/modified)
- 📝 Decisions and notes
- 🔜 Next steps
- 🚫 Issues/blockers
- 💡 Quick commands for reference

### Commands

```bash
# Start new session (creates .sessions/SESSION.md from template)
./session.sh start

# Edit session notes
./session.sh edit
# Or directly: vim .sessions/SESSION.md

# View current session
./session.sh view

# Backup when done (keeps timestamped copy)
./session.sh backup

# Clear session (delete, start fresh)
./session.sh clear
```

### Session Workflow

1. **Start:** `./session.sh start` - Creates `.sessions/SESSION.md`
2. **Update:** Edit `.sessions/SESSION.md` as you work
3. **Mark progress:** ✅ completed, 🚧 in progress, 📋 planned
4. **End:** Either `./session.sh backup` or `./session.sh clear`

### What NOT to Do

❌ Don't create summary files (RESTRUCTURE_SUMMARY.md, MIGRATION_SUMMARY.md, etc.)
❌ Don't commit SESSION.md (it's gitignored)
❌ Don't leave multiple session files around
✅ Use ONE active `.sessions/SESSION.md` at a time

### Why This Matters

- **Consistent tracking:** All work logged in one place
- **No clutter:** Summary files don't pile up
- **Not committed:** Personal notes stay local
- **Fresh starts:** Clear when done, start clean next time
- **Backup available:** Can save important sessions

→ **See [docs/SESSION_TRACKING.md](docs/SESSION_TRACKING.md) for full details**

---

## Build/Lint/Test Commands

### Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment with uv
uv venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
uv pip install -r requirements.txt

# Development dependencies (includes production deps)
uv pip install -r requirements-dev.txt
```

### Environment Setup
```bash
cd backend

# Copy template
cp .env.example .env

# Edit .env with:
# - MONGODB_USERNAME, MONGODB_PASSWORD, MONGODB_CLUSTER (astra.ethgite)
# - ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID
# - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
# - SECRET_KEY (generate: openssl rand -hex 32)
# - Scope toggles: GOOGLE_ENABLE_BIRTHDAY_SCOPE, GOOGLE_ENABLE_GMAIL_READ_SCOPE
```

### Run Commands
```bash
cd backend

# Run FastAPI server (development)
python -m app.main
# Or: uvicorn app.main:app --reload

# Test MongoDB connection
python -c "from app.config import settings; print(settings.mongodb_uri)"

# Run agent runner (WebSocket)
python scripts/agent_runner.py

# Dry run (test without connecting)
python scripts/agent_runner.py --dry

# Enqueue mid-session update
python scripts/agent_runner.py --enqueue-update "Update text"
```

### App Service (Next.js + Better Auth)
```bash
cd app

# Install dependencies
npm install

# Run development server (http://localhost:3000)
npm run dev

# Lint / type-check
npm run lint
# Or individual tools:
npx biome check --fix     # Fast linting + formatting + TypeScript (replaces tsc)

# Production build & start
npm run build
npm run start
```

**App service environment variables (`app/.env`):**
- `MONGODB_USERNAME`, `MONGODB_PASSWORD`, `MONGODB_CLUSTER`, `MONGODB_DB`
- *(optional)* `MONGODB_URI` (overrides username/password if set)
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_ENABLE_BIRTHDAY_SCOPE`, `GOOGLE_ENABLE_GMAIL_READ_SCOPE`
- `NEXT_PUBLIC_APP_URL`

### Code Quality & Type Checking

**Modern Python development with Ruff + Pyre (replaces Black/Flake8/MyPy):**

```bash
# Install dependencies (includes Ruff + Pyre)
uv pip install -r requirements-dev.txt

# Run all code quality checks
pre-commit run --all-files

# Individual tools:
ruff check --fix .              # Fast linting & formatting (replaces Black/Flake8/isort)
uv run pyrefly check          # Lightning-fast type checking (replaces MyPy)

# Pre-commit hooks automatically run:
# - Ruff: formatting, linting, import sorting
# - Pyre: type checking (10-100x faster than MyPy)
# - Auto-fixes issues before commits
```

**Key Benefits:**
- 🚀 **Ruff**: 10-100x faster than Black + Flake8
- ⚡ **Pyre**: 10-100x faster than MyPy, catches real bugs
- 🤖 **Pre-commit**: Auto-fixes issues before commits
- 🎯 **Type Safety**: Catches bugs like `None` access, wrong dict types
```

### Lint & Format
```bash
cd backend

# Check formatting
black app/ --check

# Format code
black app/
isort app/

# Lint
ruff check app/

# Type check
mypy app/
```

→ **See [docs/COMPONENTS.md](docs/COMPONENTS.md) for detailed component usage**
→ **See [docs/WORKFLOWS.md](docs/WORKFLOWS.md) for complete auth flow**

### Pre-commit Hooks
This project uses pre-commit hooks for automatic code quality checks:
```bash
# Install pre-commit with uv
uv pip install pre-commit

# Install hooks
pre-commit install

# Run on all files (one-time setup)
pre-commit run --all-files
```

**Features:**
- Auto-formats Python code with Black
- Lints with Ruff (fast alternative to flake8)
- Syncs `AGENTS.md` → `Claude.md` on commit
- Fixes common issues automatically

→ **Claude.md is automatically kept in sync with AGENTS.md via pre-commit**

### Testing
```bash
cd backend

# Run tests
pytest

# With coverage
pytest --cov=app --cov-report=html
```

→ **See [backend/README.md](backend/README.md) for detailed backend setup**
→ **See [docs/COMPONENTS.md](docs/COMPONENTS.md) for component usage**

---

→ **See [docs/COMPONENTS.md](docs/COMPONENTS.md) for detailed component usage**

## Google Auth Service

**File:** `services/google_auth_service.py`

**Purpose:** Complete Google OAuth 2.0 flow with DOB extraction for astrology features.

**Configuration priority:** Environment variables (.env) > config.json

**Key environment variables:**
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (required)
- `GOOGLE_ENABLE_BIRTHDAY_SCOPE=true` (default: true, required for astrology)
- `GOOGLE_ENABLE_GMAIL_READ_SCOPE=false` (default: false, optional for future features)

**Scopes requested:**
- Base: `openid`, `userinfo.email`, `userinfo.profile`
- Birthday: `user.birthday.read` (People API) - **Required for astrology**
- Gmail: `gmail.readonly` (optional)

**Quick usage:**
```python
from services.google_auth_service import GoogleAuthService

auth = GoogleAuthService()
auth_url = auth.authorization_url(state="csrf_token")
# Redirect user, then on callback:
tokens = auth.exchange_code(code)
profile = auth.fetch_user_profile(tokens["access_token"])
# profile["birthday"] → "1996-05-14"
```

→ **See [docs/COMPONENTS.md#google-auth-service](docs/COMPONENTS.md#google-auth-service) for detailed usage**
→ **See [docs/WORKFLOWS.md#authentication-flow](docs/WORKFLOWS.md#authentication-flow) for complete auth flow**

## Google Cloud OAuth Setup

**Project:** astra-474015

**Configured:**
- OAuth Consent Screen: "Astra Agent" (External)
- APIs: People API (DOB), Gmail API (optional)
- Scopes: openid, email, profile, user.birthday.read, gmail.readonly
- Redirect URI (dev): `http://localhost:8000/auth/google/callback`
- **Production:** Add production redirect URI before deploying

**Credentials:** Store in `.env` (see `.env.example`)

**Cost:** $0 (OAuth/APIs are free)

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
- Runtime environment variables (e.g., `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_VOICE_ID`) take precedence over `config.json`.
- For SDK audio sessions, keep `sdk_audio_playback` and `sdk_microphone_capture` true to use ElevenLabs’ streamed audio.
### Configuration Rules
**Priority:** Environment variables > config.json > defaults

**Core principles:**
- Never commit secrets (use `.env` and `.env.example`)
- `config.json` is single source of truth for non-secret config
- Environment variables override config.json for production flexibility
- Validate required fields at startup
- Private agents: Fetch signed URL dynamically (don't store long-term)

**Key environment overrides:**
- `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_SIGNED_URL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `MONGODB_USERNAME`, `MONGODB_PASSWORD`, `MONGODB_CLUSTER`

→ **See [docs/COMPONENTS.md](docs/COMPONENTS.md) for all config fields**

### Memory Buffer Guidelines
- Dynamic variables injected only at session start
- Use contextual updates mid-session (not prompt rewrites)
- Keep buffer compact (< 10KB)
- File watcher or update queue for mid-session changes
- Stringify complex types (dict/list → JSON string)

→ **See [docs/MEMORY_BUFFER.md](docs/MEMORY_BUFFER.md) for complete field reference**

---

## Quick Links

**Detailed Technical Documentation:**
- 📘 [Component Reference](docs/COMPONENTS.md) - ElevenLabs runner, memory system, auth, MongoDB
- 👤 [Persona Specs](docs/PERSONA.md) - Jadugar tone, behavior, Hinglish guidelines
- 💾 [Memory Buffer](docs/MEMORY_BUFFER.md) - Field reference, update patterns
- 🔄 [Workflows](docs/WORKFLOWS.md) - Auth, conversation, update flows
- 🏗️ [Architecture](docs/ARCHITECTURE.md) - System design and component relationships

**Key Implementation Files:**
- `scripts/elevenlabs_agent_runner.py` - Main WebSocket runner
- `services/google_auth_service.py` - OAuth implementation
- `buffer/memory_buffer.json` - User context storage
- `responder.md` - Jadugar persona prompt template
- `config.json` - Configuration (overridable by env vars)
