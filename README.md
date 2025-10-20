# Astra - AI Astrology Companion

> Multi-agent astrology platform combining real-time voice conversations with intelligent background processing

---

## 🌟 Overview

Astra is a mystical astrology companion that provides personalized guidance through voice conversations. The platform uses a sophisticated multi-agent architecture where:

- **ElevenLabs agents** handle real-time user conversations
- **Julep agents** process data in the background (transcripts, charts, insights)
- **MongoDB** serves as the single source of truth
- **Background processing** continuously enriches user profiles

**The Magic:** From the second conversation onward, users experience fully personalized interactions based on their complete history, preferences, and astrological profile.

---

## 🏗️ Architecture

### Three-Layer System

```
┌─────────────────────────────────────────────┐
│  Layer 1: Next.js (Presentation)            │
│  • Voice UI (ElevenLabs React SDK)          │
│  • Dashboard, API routes                    │
└─────────────────┬───────────────────────────┘
                  │
                  ↕
┌─────────────────┴───────────────────────────┐
│  Layer 2: MongoDB (Source of Truth)         │
│  • User profiles with birth data            │
│  • user_overview (all enriched data)        │
│  • Conversation history                     │
└─────────────────┬───────────────────────────┘
                  │
                  ↕
┌─────────────────┴───────────────────────────┐
│  Layer 3: AI Processing                     │
│  • ElevenLabs (frontline conversations)     │
│  • Julep (background tasks)                 │
└─────────────────────────────────────────────┘
```

### Key Principle

**ElevenLabs agents** talk to users with context from MongoDB  
**Julep agents** process data in background and write to MongoDB  
**MongoDB** stores everything and provides context to ElevenLabs

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** or **Bun 1.0+**
- **MongoDB Atlas** account
- **ElevenLabs** API key
- **Julep** API key
- **Google OAuth** credentials

### Installation

```bash
# Clone repository
git clone <repository-url>
cd astra

# Install dependencies
cd app
bun install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run development server
bun run dev

# Open http://localhost:3000
```

### Environment Variables

```bash
# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/astra
MONGODB_DB=astra

# Authentication
BETTER_AUTH_SECRET=your_secret_key_here
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google

# Julep (Background Processing)
JULEP_API_KEY=your_julep_api_key
BACKGROUND_WORKER_AGENT_ID=agent_xyz123

# ElevenLabs (Voice Interface)
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_AGENT_ID=agent_abc789
ELEVENLABS_WORKFLOW_ID=workflow_def456
```

---

## 📂 Project Structure

```
astra/
├── app/                          # Next.js application
│   ├── src/
│   │   ├── app/                  # App router pages & API routes
│   │   │   ├── api/
│   │   │   │   ├── auth/         # Better Auth endpoints
│   │   │   │   ├── responder/    # Session handshake
│   │   │   │   └── tasks/        # Background task triggers
│   │   │   ├── dashboard/        # Main dashboard page
│   │   │   └── page.tsx          # Landing page
│   │   ├── components/           # React components
│   │   │   └── voice-session/    # ElevenLabs voice UI
│   │   └── lib/                  # Utilities
│   │       ├── auth.ts           # Better Auth config
│   │       ├── mongo.ts          # MongoDB schema & helpers
│   │       ├── env.ts            # Environment validation
│   │       └── logger.ts         # Structured logging
│   ├── scripts/                  # Utilities
│   └── tests/                    # Test suites
├── agents/                       # Julep agent definitions
│   ├── definitions/
│   │   └── astra.yaml            # Background worker agent
│   └── tasks/                    # Task workflows (YAML)
│       ├── transcript-processor-simple.yaml
│       ├── chart-calculator.yaml
│       ├── gamification-tracker.yaml
│       └── weekly-report-generator.yaml
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md           # Complete system architecture
│   ├── FAQ.md                    # Common questions
│   ├── WALKTHROUGH.md            # Step-by-step guide
│   └── PRACTICAL_IMPLEMENTATION.md
└── README.md                     # This file
```

---

## 💡 How It Works

### First Conversation

1. User authenticates with Google OAuth
2. User starts voice conversation via ElevenLabs
3. Agent responds with basic context (name, birth date if available)
4. Conversation ends
5. **Background processing begins:**
   - Transcript fetched from ElevenLabs API
   - Julep task extracts insights (birth details, preferences, topics)
   - Results synced to MongoDB `user_overview`
   - Additional tasks triggered (chart calculation, gamification)

### Second Conversation (Personalized)

1. User returns
2. Dashboard shows: daily horoscope, streak, topics, chart
3. Voice session starts
4. ElevenLabs agent receives **full user_overview** from MongoDB
5. Agent greets with complete awareness:
   > "Welcome back, Sarah! Your 5-day streak is amazing! I remember we discussed career timing. Your Moon in Gemini today is perfect for interviews..."

---

## 🗄️ MongoDB Schema

### Key Collections

**users** - User profiles with enriched data
```typescript
{
  id: string,
  name: string,
  email: string,
  date_of_birth?: Date,
  birth_time?: string,
  birth_location?: string,
  julep_user_id?: string,
  
  // ⭐ All background processing results
  user_overview?: {
    profile_summary: string,
    birth_chart?: { ... },
    preferences?: { ... },
    recent_conversations: [ ... ],
    gamification?: { ... },
    latest_horoscope?: { ... },
    insights: [ ... ]
  }
}
```

**elevenlabs_conversations** - Conversation tracking
```typescript
{
  conversation_id: string,
  user_id: string,
  status: "active" | "completed",
  started_at: Date,
  ended_at?: Date
}
```

---

## 🤖 Agents

### ElevenLabs Agent (Frontline)

- Handles ALL real-time user conversations
- Receives context from MongoDB via dynamic variables
- Never accesses Julep directly
- Configured in ElevenLabs dashboard

### Julep Background Worker (Background)

- NEVER interacts with users
- Executes tasks asynchronously
- Processes transcripts, generates charts, tracks metrics
- Returns JSON that syncs to MongoDB
- Defined in `agents/definitions/astra.yaml`

---

## 📋 Background Tasks

All tasks defined as YAML workflows in `agents/tasks/`:

- **transcript-processor** - Extract insights from conversations
- **chart-calculator** - Generate Vedic/Western birth charts
- **gamification-tracker** - Track streaks, milestones, engagement
- **weekly-report-generator** - Create companion summaries
- **horoscope-refresher** - Generate daily horoscopes

---

## 🔧 Development

### Commands

```bash
# Development
bun run dev              # Start dev server
bun run build            # Production build
bun run start            # Start production server

# Code Quality
bun run lint             # Run Biome linter
bun test                 # Run test suite

# Pre-commit hooks (auto-installed)
# - YAML validation
# - TypeScript type checking
# - Tests
```

### Creating a Background Task

1. Write YAML in `agents/tasks/my-task.yaml`
2. Validate: Pre-commit hook checks syntax
3. Test: `bun run scripts/test-task.ts my-task`
4. Integrate: Add API endpoint in `app/src/app/api/tasks/`
5. Sync: Update MongoDB with task output

---

## 📚 Documentation

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Complete system design
- **[FAQ.md](docs/FAQ.md)** - Common questions answered
- **[WALKTHROUGH.md](docs/WALKTHROUGH.md)** - Step-by-step guide with examples
- **[PRACTICAL_IMPLEMENTATION.md](docs/PRACTICAL_IMPLEMENTATION.md)** - Code examples
- **[IMPLEMENTATION_CHECKLIST.md](docs/IMPLEMENTATION_CHECKLIST.md)** - Development progress

---

## 🧪 Testing

```bash
# Run all tests
bun test

# Test specific file
bun test tests/integration/auth-user-flow.test.ts

# Watch mode
bun test --watch
```

---

## 🚢 Deployment

### Vercel (Recommended)

```bash
# Deploy
vercel --prod

# Configure environment variables in Vercel dashboard
```

### Environment Setup

1. Create MongoDB Atlas cluster
2. Set up Better Auth with Google OAuth
3. Create Julep agent and get ID
4. Configure ElevenLabs agent
5. Add all environment variables to Vercel

---

## 🔒 Security

- API keys stored in environment variables
- MongoDB encryption at rest
- Better Auth handles session security
- Per-user data scoping
- HTTPS for all API calls

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Ensure pre-commit hooks pass
5. Submit pull request

---

## 📄 License

[Your License Here]

---

## 🙏 Acknowledgments

Built with:
- [Next.js](https://nextjs.org/)
- [ElevenLabs](https://elevenlabs.io/)
- [Julep](https://julep.ai/)
- [MongoDB](https://www.mongodb.com/)
- [Better Auth](https://better-auth.com/)

---

## 📞 Support

- **Documentation:** See `docs/` directory
- **Issues:** Open GitHub issue
- **Architecture Questions:** See `docs/ARCHITECTURE.md`
- **FAQs:** See `docs/FAQ.md`

---

**Built with ❤️ - Astra, your AI astrology companion**