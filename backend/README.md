# Astra Backend

Python FastAPI monolith for Astra - Multi-user astrology conversational AI.

## Setup

### 1. Create Virtual Environment

```bash
cd backend

# Using uv (recommended)
uv venv

# Activate
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

### 2. Install Dependencies

```bash
# Production dependencies
uv pip install -r requirements.txt

# Development dependencies
uv pip install -r requirements-dev.txt

# Or install all at once
uv pip install -r requirements-dev.txt  # includes production deps
```

### 3. Configure Environment

```bash
# Copy example env file
cp ../.env.example .env

# Edit .env with your credentials:
# - MONGODB_USERNAME, MONGODB_PASSWORD, MONGODB_CLUSTER
# - ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID
# - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
# - SECRET_KEY (generate with: openssl rand -hex 32)
```

### 4. Run Development Server

```bash
# From backend/ directory
python -m app.main

# Or with uvicorn directly
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Server will be available at:
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/health

## Project Structure

```
backend/
├── app/
│   ├── api/              # API route handlers
│   ├── core/             # Business logic
│   ├── services/         # External service wrappers
│   ├── models/           # Pydantic models
│   ├── utils/            # Utilities
│   ├── workers/          # Background workers
│   ├── buffer/           # Memory buffer storage
│   ├── config.py         # Configuration management
│   └── main.py           # FastAPI application
├── scripts/              # Standalone scripts
├── tests/                # Tests
├── requirements.txt      # Production dependencies
└── requirements-dev.txt  # Development dependencies
```

## Development

### Run Tests

```bash
pytest
```

### Format Code

```bash
black app/
isort app/
```

### Lint

```bash
flake8 app/
mypy app/
```

## API Documentation

Once running, visit http://localhost:8000/docs for interactive API documentation (Swagger UI).

## Configuration

Configuration is loaded from:
1. Environment variables (.env file) - **highest priority**
2. shared/config/defaults.json - fallback defaults

See `app/config.py` for all available settings.

## Database

MongoDB Atlas (serverless) connection:
- Cluster: astra.ethgite.mongodb.net
- Database: astra
- Collections: users, sessions, transcripts

## External Services

### ElevenLabs Conversational AI
- Agent-based voice conversations
- WebSocket connection for real-time audio

### Google OAuth 2.0
- User authentication
- Date of birth extraction (People API)

## Deployment

### Production Server

```bash
# Using gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

### Environment Variables

Set in production:
- `DEBUG=false`
- `SECRET_KEY=<secure-random-key>`
- `FRONTEND_URL=https://yourdomain.com`
- All MongoDB, ElevenLabs, Google OAuth credentials

## Related Documentation

- [Architecture](../docs/ARCHITECTURE.md)
- [Components](../docs/COMPONENTS.md)
- [Workflows](../docs/WORKFLOWS.md)
- [Agent Directives](../AGENTS.md)
