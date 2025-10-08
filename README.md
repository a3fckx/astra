# Astra - Astrology Conversational AI

Multi-user astrology conversational AI agent (Jadugar) combining voice conversations, personalized birth chart analysis, and real-time astrological guidance.

## Architecture

**Current layout:**
- **Gateway:** Next.js 14 + Better Auth (Google OAuth, session cookies, responder console)
- **Agents:** Python FastAPI monolith (ElevenLabs orchestration, background workers)

```
┌─────────────────────────────────────────────────────┐
│               Next.js Auth Gateway                  │
│  (Better Auth, REST ingress, WebSocket streaming)   │
└─────────────┬───────────────────────────────────────┘
              │ writes/streams via MongoDB
              ▼
┌─────────────────────────────────────────────────────┐
│                 MongoDB Atlas Cluster                │
│  users, sessions, responder_outbox, responder_events │
└─────────────┬───────────────────────────────────────┘
              │ polls + publishes
              ▼
┌─────────────────────────────────────────────────────┐
│             Python FastAPI Agent Mesh               │
│  ElevenLabs runner, memory buffer, background jobs  │
└─────────────────────────────────────────────────────┘

Browser ⇄ Next.js (cookies + WebSocket) ⇄ MongoDB ⇄ FastAPI ⇄ ElevenLabs
```

## Quick Start

### Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment with uv
uv venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
uv pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run development server
python -m app.main
```

Backend will be available at:
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/health

### App Service Setup

```bash
# Navigate to app service
cd app

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with MongoDB username/password (or full URI), Better Auth secret, Google credentials

# Run development server (http://localhost:3000)
npm run dev
```

## Session Tracking

Track your current work in `.sessions/SESSION.md` (gitignored, not committed):

```bash
# Start new session
./session.sh start

# Edit session notes
./session.sh edit

# View current session
./session.sh view

# Backup session with timestamp (when done)
./session.sh backup

# Clear session (start fresh)
./session.sh clear
```

**Files:**
- `.sessions/SESSION.md` - Active session tracking (gitignored)
- `.sessions/template.md` - Template for new sessions

**Use for:**
- Tracking changes made during development
- Noting todos, decisions, and blockers
- Quick command reference
- Session notes and progress

**Important:** Don't create summary files. Use `.sessions/SESSION.md` for all tracking.

## Project Structure

```
astra/
├── backend/                  # Python FastAPI monolith (agents + internal APIs)
│   ├── app/
│   │   ├── api/             # REST + WebSocket routes
│   │   ├── core/            # Business logic
│   │   ├── services/        # External services (Google, ElevenLabs, MongoDB)
│   │   ├── models/          # Pydantic models
│   │   ├── utils/           # Utilities
│   │   ├── workers/         # Background workers
│   │   ├── config.py        # Configuration
│   │   └── main.py          # FastAPI app
│   ├── scripts/             # Standalone scripts
│   ├── tests/               # Tests
│   └── requirements.txt     # Dependencies
│
├── app/                      # Next.js gateway (Better Auth + dashboard)
│   ├── src/
│   │   ├── app/             # App Router routes (pages + API handlers)
│   │   ├── components/      # Client/server React components
│   │   └── lib/             # Better Auth config, Mongo helpers, clients
│   ├── package.json
│   └── next.config.mjs
│
├── shared/                   # Shared resources
│   ├── prompts/             # Agent prompts (Jadugar persona)
│   └── config/              # Config templates
│
├── docs/                     # Documentation
│   ├── ARCHITECTURE.md      # System architecture
│   ├── COMPONENTS.md        # Component reference
│   ├── PERSONA.md           # Jadugar specifications
│   ├── MEMORY_BUFFER.md     # Context buffer reference
│   └── WORKFLOWS.md         # Process flows
│
└── AGENTS.md                 # Agent directives (for AI)
```

## Technology Stack

### Gateway
- **Framework:** Next.js 14 (App Router) + React 18
- **Auth:** Better Auth (Google social provider, Mongo adapter)
- **Language:** TypeScript
- **Realtime:** `ws` WebSocket server bridged through Next.js API routes

### Agents / Backend
- **Framework:** FastAPI 0.104+
- **Runtime:** Python 3.9+, asyncio workers
- **External APIs:** ElevenLabs Conversational AI (voice streaming)
- **Database:** MongoDB Atlas (shared with gateway)
- **Astrology:** flatlib/swisseph (planned)

## Features

### ✅ Implemented
- Next.js control center with Google sign-in (Better Auth)
- Session-aware responder dashboard + WebSocket streaming
- MongoDB-backed responder queues (`responder_outbox`, `responder_events`)
- FastAPI monolith with ElevenLabs runner + memory buffer
- Google People API DOB extraction (Python service)
- Session tracking workflow for contributors

### 🚧 In Progress / Planned
- Background analyzer to enrich astro insights automatically
- Astrology utilities (chart calculation, transit mapping)
- Additional scopes (e.g., Gmail read) wiring inside agents
- Production hardening (queue abstraction, observability, deployment scripts)

## Development

### Backend Development

```bash
cd backend

# Run with auto-reload
python -m app.main

# Or with uvicorn
uvicorn app.main:app --reload

# Run tests
pytest

# Format code
black app/
isort app/

# Lint
flake8 app/
```

### Environment Variables

Required in `.env`:
- `MONGODB_USERNAME`, `MONGODB_PASSWORD`, `MONGODB_CLUSTER`
- `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `SECRET_KEY` (generate with: `openssl rand -hex 32`)

See `.env.example` for full list.

## Documentation

### For Developers
- [Architecture Overview](docs/ARCHITECTURE.md) - System design
- [Component Reference](docs/COMPONENTS.md) - Technical deep-dive
- [Workflows](docs/WORKFLOWS.md) - Process flows
- [Backend README](backend/README.md) - Backend setup

### For AI Agents
- [AGENTS.md](AGENTS.md) - Directives for coding agents

### For Persona Design
- [Jadugar Persona](docs/PERSONA.md) - Agent specifications
- [Memory Buffer](docs/MEMORY_BUFFER.md) - Context structure

## Configuration

Configuration is loaded with priority:
1. Environment variables (.env) - **Highest priority**
2. shared/config/defaults.json - Fallback defaults

## Deployment

### Backend (Production)

```bash
cd backend

# Install dependencies
uv pip install -r requirements.txt

# Run with gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

### App Service (Production)

```bash
cd app

# Build production output
npm run build

# Serve with `npm run start` or deploy via Vercel/Node hosting
```

## External Services Setup

### Google Cloud (OAuth)
- Project ID: astra-474015
- Enable APIs: People API, Gmail API (optional)
- Create OAuth 2.0 credentials
- Add redirect URI: `http://localhost:8000/api/auth/google/callback` (dev)

### MongoDB Atlas
- Create serverless cluster
- Get connection string
- Set in `MONGODB_URI` environment variable

### ElevenLabs
- Create account
- Get API key
- Create conversational AI agent
- Set `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID`

## Contributing

1. Follow semantic commit messages (`feat:`, `fix:`, `docs:`, etc.)
2. Run tests and linting before committing
3. Update documentation for new features
4. Keep backend logic in backend/, app service components in app/

## License

Proprietary - All rights reserved

## Support

- Documentation: See `docs/` folder
- Issues: Create GitHub issue
- Contact: [Your contact info]
