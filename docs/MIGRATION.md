# Migration Guide - Monolith Restructure

This document explains the transition from the previous structure to the new monolith architecture.

## What Changed

### Directory Structure

**Before:**
```
astra/
├── scripts/                    # Python scripts
│   ├── elevenlabs_agent_runner.py
│   └── elevenlabs_sdk_runner.py
├── services/                   # Service wrappers
│   └── google_auth_service.py
├── buffer/                     # Memory buffer
│   └── memory_buffer.json
├── responder.md                # Prompt template
├── config.json                 # Configuration
└── .env                        # Environment variables
```

**After:**
```
astra/
├── backend/                    # Python monolith
│   ├── app/
│   │   ├── api/               # API routes (new)
│   │   ├── core/              # Business logic (new)
│   │   ├── services/          # External services
│   │   │   └── google_auth.py (moved from services/)
│   │   ├── models/            # Pydantic models (new)
│   │   ├── utils/             # Utilities (new)
│   │   ├── workers/           # Background workers (new)
│   │   ├── buffer/            # Memory buffer (moved from buffer/)
│   │   ├── config.py          # Configuration (new)
│   │   └── main.py            # FastAPI app (new)
│   ├── scripts/               # Standalone scripts
│   │   └── agent_runner.py    (moved from scripts/)
│   ├── .env                   # Environment (moved)
│   └── requirements.txt       # Dependencies (new)
│
├── app/                        # Next.js app service (auth + dashboard)
│   └── src/
│
├── shared/                     # Shared resources (new)
│   ├── prompts/
│   │   └── responder.md       (moved from root)
│   └── config/
│       └── defaults.json      (moved from config.json)
│
└── docs/                       # Documentation (enhanced)
```

---

## File Moves

### Moved Files

| Old Location | New Location | Notes |
|-------------|--------------|-------|
| `services/google_auth_service.py` | `backend/app/services/google_auth.py` | Renamed, imports updated |
| `scripts/elevenlabs_agent_runner.py` | `backend/scripts/agent_runner.py` | Imports updated |
| `buffer/` | `backend/app/buffer/` | Entire directory moved |
| `responder.md` | `shared/prompts/responder.md` | Shared resource |
| `config.json` | `shared/config/defaults.json` | Template/defaults |
| `.env`, `.env.example` | `backend/.env`, `backend/.env.example` | Backend-specific |
| `app/.env.example` | `app/.env.example` | App service environment template |

### New Files

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI application entry point |
| `backend/app/config.py` | Configuration management (env vars + JSON) |
| `backend/requirements.txt` | Python dependencies |
| `backend/requirements-dev.txt` | Development dependencies |
| `backend/README.md` | Backend-specific documentation |
| `README.md` | Project-wide README |
| `docs/MIGRATION.md` | This file |

---

## Import Changes

### Google Auth Service

**Before:**
```python
from services.google_auth_service import GoogleAuthService
```

**After:**
```python
from app.services.google_auth import GoogleAuthService
```

### Configuration

**Before:**
```python
with open("config.json") as f:
    config = json.load(f)

api_key = os.getenv("ELEVENLABS_API_KEY") or config.get("elevenlabs_api_key")
```

**After:**
```python
from app.config import settings, config

api_key = settings.elevenlabs_api_key  # Env vars have priority
agent_id = settings.elevenlabs_agent_id
```

### Agent Runner

**Before:**
```python
# Direct execution
python scripts/elevenlabs_agent_runner.py
```

**After:**
```python
# From backend directory
python -m scripts.agent_runner

# Or directly
python scripts/agent_runner.py
```

---

## Migration Steps

### For Existing Development Environments

**Step 1: Pull latest code**
```bash
git pull origin main
```

**Step 2: Navigate to backend**
```bash
cd backend
```

**Step 3: Create new virtual environment**
```bash
uv venv
source .venv/bin/activate
```

**Step 4: Install dependencies**
```bash
uv pip install -r requirements.txt
```

**Step 5: Copy environment configuration**
```bash
# If .env exists in project root, copy it
cp ../.env .env

# Otherwise, use example
cp .env.example .env
# Edit .env with your credentials
```

**Step 6: Test the setup**
```bash
# Run FastAPI server
python -m app.main

# Visit http://localhost:8000/api/health
```

---

## Configuration Migration

### Environment Variables

**No changes to variable names.** All existing environment variables work as-is:
- `MONGODB_USERNAME`, `MONGODB_PASSWORD`, `MONGODB_CLUSTER`
- `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

**New required variable:**
- `SECRET_KEY` - For JWT signing (generate with `openssl rand -hex 32`)

### config.json → shared/config/defaults.json

The old `config.json` has been copied to `shared/config/defaults.json` and serves as a template.

**New behavior:**
- Environment variables have **highest priority**
- `shared/config/defaults.json` provides fallback values
- Use `app.config.settings` to access merged configuration

---

## Code Migration Examples

### Example 1: Using Google Auth

**Before:**
```python
from services.google_auth_service import GoogleAuthService

auth = GoogleAuthService()
auth_url = auth.authorization_url(state="token")
```

**After:**
```python
from app.services.google_auth import GoogleAuthService

auth = GoogleAuthService()
auth_url = auth.authorization_url(state="token")
# Usage is the same!
```

### Example 2: Loading Configuration

**Before:**
```python
import json
import os

with open("config.json") as f:
    config = json.load(f)

api_key = os.getenv("ELEVENLABS_API_KEY") or config.get("elevenlabs_api_key")
agent_id = config.get("agent_id")
```

**After:**
```python
from app.config import settings

# Settings automatically merges env vars + config.json
api_key = settings.elevenlabs_api_key
agent_id = settings.elevenlabs_agent_id
```

### Example 3: Reading Prompt Template

**Before:**
```python
with open("responder.md") as f:
    prompt = f.read()
```

**After:**
```python
from pathlib import Path
from app.config import settings

prompt_path = settings.project_root / settings.prompt_template_path
with open(prompt_path) as f:
    prompt = f.read()

# Or use utility (when created)
from app.utils.templates import load_prompt
prompt = load_prompt("responder")
```

---

## Backward Compatibility

### Old Scripts Still Work (Temporarily)

The following old-location files still exist and work:
- `scripts/elevenlabs_agent_runner.py`
- `services/google_auth_service.py`
- `buffer/memory_buffer.json`

**These will be removed in a future release.** Update your imports to the new locations.

### New Structure is Preferred

All new development should use:
- `backend/app/*` for application code
- `backend/scripts/*` for standalone scripts
- `shared/*` for shared resources
- `app/*` for Next.js service (auth + UI)

---

## Breaking Changes

### None (Currently)

The restructure maintains backward compatibility. All existing functionality works in new locations.

### Future Breaking Changes (Planned)

**v0.2.0 (Next Release):**
- Remove old-location files (`scripts/`, `services/`, `buffer/`, `responder.md`)
- Require running from `backend/` directory
- Mandate new import paths

---

## Testing Migration

### Verify Setup

```bash
cd backend

# 1. Test imports
python -c "from app.config import settings; print(settings.app_name)"

# 2. Test Google Auth
python -c "from app.services.google_auth import GoogleAuthService; print('OK')"

# 3. Run FastAPI
python -m app.main
# Visit http://localhost:8000/api/health
```

### Run Existing Scripts

```bash
# Old way (still works)
python scripts/elevenlabs_agent_runner.py --dry

# New way
cd backend
python scripts/agent_runner.py --dry
```

---

## Troubleshooting

### Import Errors

**Error:** `ModuleNotFoundError: No module named 'app'`

**Solution:** Run from `backend/` directory or install backend as package:
```bash
cd backend
uv pip install -e .
```

### Configuration Not Loading

**Error:** Settings not found or empty

**Solution:** Ensure `.env` exists in `backend/` directory:
```bash
cd backend
ls -la .env  # Should exist
cat .env | head -n 5  # Check contents
```

### MongoDB Connection Issues

**Error:** Authentication failed

**Solution:** Verify environment variables:
```bash
python -c "from app.config import settings; print(settings.mongodb_uri)"
```

---

## Next Steps

1. ✅ **Phase 1 Complete:** Backend structure created
2. 🚧 **Phase 2:** Implement API endpoints (auth, users, conversations)
3. 🚧 **Phase 3:** Migrate core logic to `backend/app/core/`
4. 🚧 **Phase 4:** Build Next.js app in `app/`
5. 🚧 **Phase 5:** Integrate backend + app service, deploy

---

## Questions?

- Check [Architecture Docs](ARCHITECTURE.md)
- See [Backend README](../backend/README.md)
- Review [AGENTS.md](../AGENTS.md) for agent directives
