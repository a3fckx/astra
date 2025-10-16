# Astra Architecture

> **Last Updated:** 2025-01-XX  
> **Status:** Production Architecture  
> **Purpose:** Complete system architecture for Astra multi-agent astrology platform

---

## Executive Summary

Astra is a multi-agent astrology companion that combines real-time voice conversations with intelligent background processing. The system uses:

- **ElevenLabs** for user-facing voice conversations
- **Julep** for background AI task execution (transcript processing, chart calculations, etc.)
- **MongoDB** as the single source of truth for all data

**Key Principle:** Background agents enrich user data in MongoDB, which ElevenLabs agents access for personalized conversations.

---

## System Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│           LAYER 1: PRESENTATION (Next.js)                    │
│  • Voice UI (ElevenLabs React SDK)                          │
│  • Dashboard (horoscope, chart, gamification)               │
│  • API routes (session, tasks, webhooks)                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↕ HTTP/REST
                           │
┌──────────────────────────┴──────────────────────────────────┐
│           LAYER 2: DATA (MongoDB Atlas)                      │
│  • User profiles with birth data                            │
│  • user_overview (all background processing results)        │
│  • Conversation history                                     │
│  • Integration tokens                                       │
│                                                              │
│  PRIMARY SOURCE OF TRUTH                                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↕ SDK calls
                           │
┌──────────────────────────┴──────────────────────────────────┐
│           LAYER 3: AI PROCESSING                             │
│                                                              │
│  ┌────────────────────┐    ┌────────────────────┐          │
│  │  ElevenLabs Agent  │    │  Julep Background  │          │
│  │   (Frontline)      │    │     Worker         │          │
│  │                    │    │   (Background)     │          │
│  │ • Voice convo      │    │ • Transcript proc  │          │
│  │ • Real-time        │    │ • Chart calc       │          │
│  │ • User-facing      │    │ • Gamification     │          │
│  │ • Gets MongoDB     │    │ • Writes MongoDB   │          │
│  │   context          │    │                    │          │
│  └────────────────────┘    └────────────────────┘          │
│                                                              │
│  ElevenLabs = TALKS TO USERS                                │
│  Julep = NEVER TALKS TO USERS                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### First Conversation

```
1. User authenticates (Better Auth + Google OAuth)
   └─> MongoDB user created with basic profile
   └─> Julep user created for background processing

2. User starts voice conversation
   └─> ElevenLabs agent receives context from MongoDB
   └─> Agent sees: name, birth date (if available from Google)
   └─> Conversation happens in real-time

3. Conversation ends
   └─> Conversation ID stored in MongoDB
   └─> Webhook/trigger: POST /api/tasks/transcript
   
4. Background Processing (async, invisible to user)
   └─> Fetch transcript from ElevenLabs API
   └─> Execute Julep task: transcript-processor.yaml
   └─> Task analyzes transcript with Claude
   └─> Extracts: birth details, preferences, topics, insights
   └─> Returns JSON output

5. Sync to MongoDB
   └─> API receives task output
   └─> Updates user.user_overview with extracted data
   └─> Triggers additional tasks:
       • Chart calculation (if birth data complete)
       • Gamification update (streak, conversations)

6. Background tasks complete
   └─> All results written to MongoDB user_overview
```

### Second Conversation (Personalized Experience)

```
1. User returns
   └─> Dashboard loads from MongoDB user_overview:
       • Daily horoscope
       • Streak: "5 days! 🔥"
       • Topics explored
       • Birth chart visualization

2. Voice session starts
   └─> GET /api/responder/session
   └─> Returns FULL user_overview from MongoDB
   └─> ElevenLabs agent receives complete context

3. Agent responds with full awareness
   "Welcome back, Sarah! Your 5-day streak is amazing! 
    I remember we discussed career timing last time. 
    Your Moon in Gemini today is perfect for interviews..."

4. Mid-conversation updates (optional)
   └─> If chart calculation finishes while talking
   └─> Send contextual update to ElevenLabs
   └─> Agent: "Great news! Your birth chart is ready..."
```

---

## MongoDB Schema

### User Collection

```typescript
type AstraUser = {
  _id: ObjectId;
  id: string;                          // Better Auth user ID
  name: string;
  email: string;
  image?: string;
  emailVerified: boolean;
  
  // Birth data (from Google People API or user input)
  date_of_birth?: Date;                // UTC date
  birth_day?: number;                  // 1-31
  birth_month?: number;                // 1-12
  birth_time?: string;                 // "HH:mm" 24-hour format
  birth_location?: string;             // "City, Country"
  birth_timezone?: string;             // IANA timezone
  
  // Julep linkage (for background tasks)
  julep_user_id?: string;              // Links to Julep user
  julep_project: "astra";
  
  // ElevenLabs
  elevenlabs_conversations?: string[]; // Array of conversation IDs
  
  // ⭐ USER OVERVIEW - All Background Processing Results
  user_overview?: {
    // Profile summary for quick reference
    profile_summary: string;           // "Sarah, Leo sun, Pisces moon, born Aug 15 1990"
    
    // Birth chart (calculated by background task)
    birth_chart?: {
      system: "vedic" | "western" | "both";
      sun_sign: string;
      moon_sign: string;
      rising_sign: string;
      planets: Array<{
        name: string;
        sign: string;
        house: number;
        degree: string;
      }>;
      chart_text: string;              // Human-readable summary
      calculated_at: Date;
    };
    
    // User preferences (extracted from conversations)
    preferences?: {
      communication_style: "casual" | "formal" | "mixed";
      hinglish_level: "low" | "medium" | "high";
      topics_of_interest: string[];    // ["career", "relationships", "health"]
      astrology_system: "vedic" | "western" | "both";
      emotional_tone: string;          // "curious", "anxious", "excited"
      preferred_response_length: "concise" | "moderate" | "detailed";
    };
    
    // Recent conversations (last 10)
    recent_conversations: Array<{
      conversation_id: string;
      date: Date;
      topics: string[];
      summary: string;                 // Brief summary
      key_insights: string[];
      questions_asked: string[];
    }>;
    
    // Gamification metrics
    gamification?: {
      streak_days: number;
      best_streak: number;
      total_conversations: number;
      milestones_unlocked: string[];   // ["first_conversation", "streak_3", ...]
      topics_explored: string[];
      chart_completion_percent: number;
      last_conversation_date: Date;
    };
    
    // Latest horoscope (for quick dashboard access)
    latest_horoscope?: {
      date: Date;
      content: string;
      generated_by: string;
    };
    
    // AI-generated insights
    insights: Array<{
      type: string;                    // "career_advice", "pattern", etc.
      content: string;
      generated_at: Date;
      confidence: number;              // 0-1
    }>;
    
    // Metadata
    last_updated: Date;
    updated_by: string;                // Task ID or agent that updated
  };
  
  createdAt: Date;
  updatedAt: Date;
};
```

### ElevenLabs Conversations Collection

```typescript
type ElevenLabsConversation = {
  _id: ObjectId;
  user_id: string;                     // MongoDB user ID
  conversation_id: string;             // ElevenLabs conversation ID
  agent_id?: string;
  workflow_id?: string;
  status: "active" | "completed" | "abandoned";
  started_at: Date;
  ended_at?: Date;
  duration_ms?: number;
  metadata?: {
    transcript_processed?: boolean;
    task_id?: string;
    execution_id?: string;
  };
  updated_at: Date;
};
```

### Integration Tokens Collection

```typescript
type IntegrationToken = {
  _id: ObjectId;
  userId: string;                      // MongoDB user ID
  integration: "elevenlabs" | "memory-store";
  token: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};
```

---

## Agents

### ElevenLabs Agent (Frontline)

**Purpose:** Handle ALL real-time user conversations

**Configuration:**
- Lives in ElevenLabs dashboard
- Configured with voice model and TTS settings
- Receives dynamic variables from session handshake

**Context Sources:**
- MongoDB `user_overview` (sent as dynamic variables)
- User birth data
- Recent conversations
- Gamification stats
- Latest horoscope

**Key Points:**
- NEVER accesses Julep directly
- Gets all context from MongoDB via API
- Responds in real-time with full user awareness

**Environment Variables:**
```bash
ELEVENLABS_API_KEY=your_key
ELEVENLABS_AGENT_ID=agent_abc123
ELEVENLABS_WORKFLOW_ID=workflow_xyz789
```

### Julep Background Worker Agent

**Purpose:** Execute background AI tasks asynchronously

**Configuration:**
- Lives in Julep workspace
- File: `agents/definitions/astra.yaml`
- Model: Claude 3.5 Sonnet (via OpenRouter)
- Project: `astra`

**Responsibilities:**
1. Process conversation transcripts
2. Extract birth details and preferences
3. Generate astrology charts
4. Track gamification metrics
5. Create daily horoscopes
6. Generate weekly reports

**Key Points:**
- NEVER interacts with users directly
- Executes tasks from YAML definitions
- Returns JSON that syncs to MongoDB
- Can use Julep User Docs as working memory

**Environment Variables:**
```bash
JULEP_API_KEY=your_key
BACKGROUND_WORKER_AGENT_ID=agent_def456
```

---

## Background Tasks

### Task Workflow Pattern

All tasks follow this pattern:

```yaml
name: Task Name
project: astra

input_schema:
  type: object
  required: [julep_user_id, ...]
  properties:
    julep_user_id: { type: string }
    # ... other inputs

tools:
  - name: search_user_docs
    type: system
    system:
      resource: user
      subresource: doc
      operation: search
  # ... other tools

main:
  # Task steps (prompts, tool calls, evaluations)
  
  # CRITICAL: Return JSON for MongoDB sync
  - return:
      field_name: value
      nested_object:
        key: value
```

### Transcript Processor

**File:** `agents/tasks/transcript-processor.yaml`

**Purpose:** Extract insights from conversation transcripts

**Input:**
- `julep_user_id`: Julep user ID
- `conversation_id`: ElevenLabs conversation ID
- `transcript_text`: Full transcript from ElevenLabs API

**Output (returned to API for MongoDB sync):**
```yaml
return:
  birth_details:
    date: "1990-08-15"
    time: "14:30"
    location: "Mumbai, India"
    timezone: "Asia/Kolkata"
  
  preferences:
    communication_style: "casual"
    hinglish_level: "medium"
    topics_of_interest: ["career", "relationships"]
    astrology_system: "vedic"
    emotional_tone: "curious"
  
  summary: "User asked about career timing and job change..."
  insights: ["Considering new job", "Anxious about timing"]
  questions: ["When is good time for job change?"]
  topics: ["career"]
```

### Chart Calculator

**File:** `agents/tasks/chart-calculator.yaml`

**Purpose:** Generate Vedic/Western birth charts

**Input:**
- `julep_user_id`: Julep user ID
- Birth data from MongoDB (via input or query)

**Output:**
```yaml
return:
  birth_chart:
    system: "vedic"
    sun_sign: "Leo"
    moon_sign: "Pisces"
    rising_sign: "Gemini"
    planets:
      - name: "Sun"
        sign: "Leo"
        house: 5
        degree: "23°45'"
      - name: "Moon"
        sign: "Pisces"
        house: 12
        degree: "15°30'"
      # ... all planets
    chart_text: "Human-readable summary of chart..."
    calculated_at: "2025-01-15T10:30:00Z"
```

### Gamification Tracker

**File:** `agents/tasks/gamification-tracker.yaml`

**Purpose:** Track engagement metrics and milestones

**Input:**
- `julep_user_id`: Julep user ID
- `conversation_id`: Latest conversation ID
- `event_type`: Type of trigger event

**Output:**
```yaml
return:
  gamification:
    streak_days: 5
    best_streak: 7
    total_conversations: 23
    milestones_unlocked:
      - "first_conversation"
      - "streak_3"
      - "conversations_10"
    topics_explored: ["career", "relationships", "health"]
    chart_completion_percent: 80
    last_conversation_date: "2025-01-15T10:30:00Z"
```

**Milestones:**
- `first_conversation`: First chat
- `streak_3`: 3-day streak
- `conversations_10`: 10 conversations
- `conversations_25`: 25 conversations
- `conversations_50`: 50 conversations
- `conversations_100`: 100 conversations
- `full_chart`: 100% birth data complete
- `topic_explorer`: 5+ unique topics discussed

### Horoscope Generator

**File:** `agents/tasks/horoscope-refresher.yaml`

**Purpose:** Generate daily personalized horoscopes

**Input:**
- `julep_user_id`: Julep user ID

**Output:**
```yaml
return:
  horoscope:
    date: "2025-01-16"
    content: "Full horoscope text (2-3 paragraphs)..."
    signs:
      sun: "Leo"
      moon: "Pisces"
      rising: "Gemini"
    transits: ["Mercury in Capricorn", "Venus in Aquarius"]
    generated_at: "2025-01-16T00:00:00Z"
```

### Weekly Report Generator

**File:** `agents/tasks/weekly-report-generator.yaml`

**Purpose:** Create companion-style weekly summaries

**Input:**
- `julep_user_id`: Julep user ID
- `week_start_date`: Optional start date

**Output:**
```yaml
return:
  weekly_report:
    week_start: "2025-01-09"
    week_end: "2025-01-15"
    content: "Full report text with warm greeting, summary, reflections..."
    stats:
      conversations_this_week: 5
      topics_discussed: ["career", "relationships"]
      milestones_unlocked: ["streak_3"]
      current_streak: 7
    generated_at: "2025-01-15T18:00:00Z"
```

---

## API Endpoints

### GET /api/responder/session

**Purpose:** Session handshake - provides complete context to ElevenLabs agent

**Authentication:** Required (Better Auth session)

**Response:**
```json
{
  "session": {
    "user": {
      "id": "user_123",
      "name": "Sarah Johnson",
      "email": "sarah@example.com",
      "dateOfBirth": "1990-08-15",
      "birthTime": "14:30",
      "birthLocation": "Mumbai, India"
    },
    "user_overview": {
      "profile_summary": "Sarah, Leo sun, Pisces moon, born Aug 15 1990",
      "birth_chart": { ... },
      "preferences": { ... },
      "recent_conversations": [ ... ],
      "gamification": { ... },
      "latest_horoscope": { ... },
      "insights": [ ... ]
    },
    "workflowId": "workflow_abc123"
  },
  "integrations": {
    "elevenlabs": {
      "token": "el_token_xyz"
    }
  }
}
```

**Usage in ElevenLabs:**
```javascript
const conversation = useConversation({
  onConnect: async (conversationId) => {
    const handshake = await fetch("/api/responder/session").then(r => r.json());
    
    // Send as dynamic variables
    await conversation.setVariables({
      user_name: handshake.session.user.name,
      user_overview: JSON.stringify(handshake.session.user_overview),
      profile_summary: handshake.session.user_overview.profile_summary,
      streak_days: handshake.session.user_overview.gamification?.streak_days,
      // ... more fields
    });
  }
});
```

### POST /api/tasks/transcript

**Purpose:** Trigger transcript processing and MongoDB sync

**Authentication:** Required

**Request:**
```json
{
  "conversation_id": "conv_abc123",
  "user_id": "user_xyz789"
}
```

**Process:**
1. Fetch transcript from ElevenLabs API
2. Get user's Julep ID from MongoDB
3. Load and execute `transcript-processor.yaml` task
4. Poll for task completion
5. Extract task output (JSON)
6. Sync output to MongoDB `user_overview`:
   - Update birth data if extracted
   - Update preferences
   - Add conversation summary to recent_conversations
7. Trigger additional tasks (chart, gamification)

**Response:**
```json
{
  "success": true,
  "task_id": "task_abc",
  "execution_id": "exec_xyz",
  "conversation_id": "conv_abc123",
  "message": "Transcript processing completed"
}
```

### POST /api/tasks/chart

**Purpose:** Trigger chart calculation

**Request:**
```json
{
  "user_id": "user_xyz789",
  "force_recalculate": false
}
```

**Process:**
1. Check if chart already exists
2. Get birth data from MongoDB
3. Execute `chart-calculator.yaml` task
4. Sync result to MongoDB `user_overview.birth_chart`

### POST /api/tasks/gamification

**Purpose:** Update gamification metrics

**Request:**
```json
{
  "user_id": "user_xyz789",
  "conversation_id": "conv_abc123",
  "event_type": "conversation_completed"
}
```

**Process:**
1. Execute `gamification-tracker.yaml` task
2. Count conversations, calculate streak
3. Check for milestone unlocks
4. Sync result to MongoDB `user_overview.gamification`

### POST /api/tasks/horoscope

**Purpose:** Generate daily horoscope

**Request:**
```json
{
  "user_id": "user_xyz789"
}
```

**Process:**
1. Execute `horoscope-refresher.yaml` task
2. Generate personalized horoscope
3. Sync to MongoDB `user_overview.latest_horoscope`

### POST /api/contextual-update

**Purpose:** Send real-time updates to active ElevenLabs conversation

**Request:**
```json
{
  "user_id": "user_xyz789",
  "update_type": "chart_completed",
  "data": { ... }
}
```

**Process:**
1. Find active conversation for user
2. Send update via ElevenLabs API (if supported)
3. Or store in MongoDB for next message

---

## Voice Session Flow

### Component: `voice-session.tsx`

**Key Responsibilities:**
1. Initialize ElevenLabs conversation
2. Fetch session handshake (user context)
3. Send dynamic variables to agent
4. Handle conversation lifecycle
5. Trigger background processing on end

**Implementation:**
```typescript
const conversation = useConversation({
  agentId: ELEVENLABS_AGENT_ID,
  
  // On connection, send full context
  onConnect: async (conversationId) => {
    // 1. Store conversation in MongoDB
    await fetch("/api/responder/conversations", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: conversationId,
        user_id: session.user.id,
      }),
    });
    
    // 2. Get session handshake with user_overview
    const handshake = await fetch("/api/responder/session").then(r => r.json());
    
    // 3. Send as dynamic variables to ElevenLabs agent
    await conversation.setVariables({
      user_name: handshake.session.user.name,
      date_of_birth: handshake.session.user.dateOfBirth,
      birth_time: handshake.session.user.birthTime,
      
      // Full user overview
      user_overview: JSON.stringify(handshake.session.user_overview),
      
      // Quick access fields
      profile_summary: handshake.session.user_overview?.profile_summary,
      chart_summary: handshake.session.user_overview?.birth_chart?.chart_text,
      streak_days: handshake.session.user_overview?.gamification?.streak_days,
      latest_horoscope: handshake.session.user_overview?.latest_horoscope?.content,
      recent_topics: handshake.session.user_overview?.preferences?.topics_of_interest?.join(", "),
    });
  },
  
  // On disconnect, trigger background processing
  onDisconnect: async (details) => {
    await fetch("/api/tasks/transcript", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: details.conversationId,
        user_id: session.user.id,
      }),
    });
  },
  
  // Handle messages, status changes, etc.
  onMessage: (message) => { ... },
  onStatusChange: (status) => { ... },
});
```

---

## Authentication Flow

### User Signup

```javascript
1. User clicks "Sign in with Google"
2. Better Auth handles OAuth flow
3. Google returns user info + birthday (if granted)
4. Better Auth callback:
   a. Create user in MongoDB
   b. Create Julep user (for background tasks)
   c. Link via julep_user_id field
   d. Seed initial user_overview (null)
5. Redirect to dashboard
```

### Implementation: `app/src/lib/auth.ts`

```typescript
export const auth = betterAuth({
  database: mongodbAdapter(mongoClient, { database: env.mongodbDb }),
  
  socialProviders: {
    google: {
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
      scopes: googleScopes(), // Includes birthday if enabled
    },
  },
  
  // After user created
  hooks: {
    after: [
      {
        matcher: (context) => context.path === "/sign-up/social",
        handler: async (context) => {
          const user = context.context.user;
          
          // Create Julep user for background processing
          const julepUser = await julepClient.users.create({
            name: user.name,
            about: `User email: ${user.email}`,
            project: "astra",
            metadata: {
              email: user.email,
              mongodb_id: user.id,
            },
          });
          
          // Link in MongoDB
          await mongoUsers.updateOne(
            { id: user.id },
            {
              $set: {
                julep_user_id: julepUser.id,
                julep_project: "astra",
                user_overview: null, // Will be populated by background tasks
              },
            }
          );
          
          // Enrich with Google birthday if available
          if (context.context.account?.access_token) {
            const profileDetails = await fetchGoogleProfileDetails(
              context.context.account.access_token
            );
            
            if (profileDetails?.birthday) {
              const birthDate = new Date(
                Date.UTC(
                  profileDetails.birthday.year || 1900,
                  profileDetails.birthday.month - 1,
                  profileDetails.birthday.day
                )
              );
              
              await mongoUsers.updateOne(
                { id: user.id },
                {
                  $set: {
                    birth_day: profileDetails.birthday.day,
                    birth_month: profileDetails.birthday.month,
                    date_of_birth: profileDetails.birthday.year ? birthDate : undefined,
                  },
                }
              );
            }
          }
        },
      },
    ],
  },
});
```

---

## Technology Stack

### Frontend
- **Next.js 15** (App Router)
- **React 18** with TypeScript
- **ElevenLabs React SDK** (`@elevenlabs/react`)
- **Tailwind CSS** + **shadcn/ui**
- **Biome** for linting/formatting

### Backend
- **Next.js API Routes** (serverless)
- **Better Auth** (authentication)
- **MongoDB Atlas** (database)
- **Julep Node.js SDK** (task orchestration)

### AI/ML
- **ElevenLabs** (voice synthesis + transcription)
- **Julep** (agent orchestration)
- **Claude 3.5 Sonnet** (via OpenRouter)

### Infrastructure
- **Vercel** (hosting)
- **MongoDB Atlas** (managed database)
- **GitHub Actions** (CI/CD)

---

## Environment Variables

```bash
# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/astra
MONGODB_DB=astra

# Authentication
BETTER_AUTH_SECRET=your_secret_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google
GOOGLE_ENABLE_BIRTHDAY_SCOPE=true

# Julep
JULEP_API_KEY=your_julep_api_key
BACKGROUND_WORKER_AGENT_ID=agent_xyz123

# ElevenLabs
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_AGENT_ID=agent_abc789
ELEVENLABS_WORKFLOW_ID=workflow_def456

# Optional
MEMORY_STORE_DEFAULT_TOKEN=your_memory_store_token
```

---

## Development Workflow

### Setup

```bash
# Clone and install
cd app
bun install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run development server
bun run dev

# Open http://localhost:3000
```

### Creating Background Tasks

1. **Write YAML definition** in `agents/tasks/`
2. **Validate syntax:** Pre-commit hook auto-validates
3. **Test task:**
   ```bash
   bun run scripts/test-task.ts task-name
   ```
4. **Integrate in API:** Add endpoint in `app/src/app/api/tasks/`
5. **Sync to MongoDB:** Update `user_overview` with task output

### Pre-commit Hooks

```bash
# Install pre-commit
pip install pre-commit
pre-commit install

# Hooks run automatically on commit:
# - YAML validation (js-yaml)
# - TypeScript type checking (Biome)
# - Tests (Bun test)
# - Sync AGENTS.md to Claude.md
```

---

## Security Considerations

### API Keys
- Stored in environment variables, never committed
- ElevenLabs API key server-side only
- Julep API key server-side only
- Per-user tokens in MongoDB with encryption at rest

### User Data
- MongoDB Atlas with encryption at rest
- HTTPS for all API calls
- Better Auth handles session security
- User data scoped by authentication

### Background Tasks
- Tasks cannot access other users' data
- Julep project "astra" isolates resources
- Task outputs validated before MongoDB sync

---

## Monitoring & Observability

### Logging
- Structured logging with `pino`
- Separate loggers for each module
- Task execution logs in Julep dashboard

### Metrics to Track
- Conversation completion rate
- Transcript processing time
- Chart calculation success rate
- Gamification milestone unlocks
- User engagement (streaks, conversations)

### Alerts
- Task execution failures
- API endpoint errors
- MongoDB connection issues
- ElevenLabs API rate limits

---

## Deployment

### Production Checklist

- [ ] Environment variables configured in Vercel
- [ ] MongoDB Atlas production cluster ready
- [ ] Julep agents created and IDs saved
- [ ] ElevenLabs agents configured
- [ ] Pre-commit hooks installed
- [ ] Tests passing
- [ ] Documentation updated

### Vercel Deployment

```bash
# Deploy to Vercel
vercel --prod

# Environment variables set in Vercel dashboard
# MongoDB connection string
# All API keys
# Agent IDs
```

---

## Troubleshooting

### Agent doesn't have context
**Solution:** Check MongoDB `user_overview` field is populated
```javascript
const user = await mongoUsers.findOne({ id: userId });
console.log("user_overview:", user.user_overview);
```

### Background task fails
**Solution:** Check task execution logs in Julep
```javascript
const execution = await julepClient.executions.get(executionId);
console.log("Status:", execution.status);
console.log("Error:", execution.error);
```

### Transcript not fetched
**Solution:** Verify ElevenLabs API access
```bash
curl -H "Authorization: Bearer $ELEVENLABS_API_KEY" \
  https://api.elevenlabs.io/v1/convai/conversations/conv_abc123
```

---

## Future Enhancements

### Phase 1 (Current)
- ✅ Voice conversations with ElevenLabs
- ✅ Background transcript processing
- ✅ Basic gamification tracking
- 🚧 Chart calculations
- 🚧 Weekly reports

### Phase 2
- [ ] Memory Store MCP integration
- [ ] Advanced chart interpretations
- [ ] Predictive insights using ML
- [ ] Voice-triggered background tasks
- [ ] Multi-language support (beyond Hinglish)

### Phase 3
- [ ] Multi-agent specialist conversations
- [ ] External integrations (calendar, tasks)
- [ ] Community features (anonymized insights)
- [ ] Mobile app (React Native)

---

## Related Documentation

- [FAQ.md](./FAQ.md) - Common questions answered
- [WALKTHROUGH.md](./WALKTHROUGH.md) - Step-by-step examples
- [PRACTICAL_IMPLEMENTATION.md](./PRACTICAL_IMPLEMENTATION.md) - Code examples
- [RUN.md](./RUN.md) - Local development setup
- [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md) - Progress tracker
- [julep.md](./julep.md) - Julep SDK reference
- [react-sdk.mdx](./react-sdk.mdx) - ElevenL