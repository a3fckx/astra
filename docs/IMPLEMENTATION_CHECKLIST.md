# Implementation Checklist: Astra Multi-Agent System

> **Purpose:** Track progress of implementing the corrected multi-agent architecture  
> **Architecture:** MongoDB (source of truth) + ElevenLabs (frontline) + Julep (background only)  
> **Last Updated:** 2025-10-17

---

## Phase 1: Foundation ✅

### Core Infrastructure
- [x] Better Auth + Google OAuth integration
- [x] MongoDB Atlas connection with user schema
- [x] ElevenLabs React SDK voice integration
- [x] Next.js 15 App Router setup
- [x] TypeScript + Biome configuration

### Authentication & User Management
- [x] Google OAuth with birthday scope
- [x] MongoDB user collection with birth data fields
- [x] Session management with Better Auth
- [x] User profile creation flow

### Voice Interface (ElevenLabs)
- [x] `voice-session.tsx` component with `useConversation` hook
- [x] Session handshake endpoint (`/api/responder/session`)
- [x] User context injection (name, birth data, overview)
- [x] Conversation tracking in MongoDB

---

## Phase 2: MongoDB Schema & Data Architecture ✅

### User Overview Field
- [x] Add `user_overview` field to MongoDB user collection
- [x] Define schema structure:
  - [x] `profile_summary` (string)
  - [x] `birth_chart` (object: system, sun_sign, moon_sign, planets)
  - [x] `preferences` (object: communication_style, topics, hinglish_level, flirt_opt_in)
  - [x] `recent_conversations` (array: conversation_id, summary, topics, sentiment)
  - [x] `gamification` (object: streak_days, total_conversations, milestones)
  - [x] `latest_horoscope` (object: date, content, transit_highlights)
  - [x] `insights` (array: type, content, generated_at)
  - [x] `last_updated` (Date)

### Conversation Tracking
- [x] `elevenlabs_conversations` collection
- [x] Store conversation metadata (ID, status, timestamps)
- [x] Link conversations to users
- [x] Track processing status

### Integration Tokens
- [x] `integration_tokens` collection
- [x] Store per-user ElevenLabs tokens
- [x] Token refresh mechanism
- [x] Fallback to system token

---

## Phase 3: Julep Background Worker Setup ✅

### Agent Configuration
- [x] Create Background Worker Agent in Julep
- [x] Store `BACKGROUND_WORKER_AGENT_ID` in environment
- [x] Configure agent with project="astra"
- [x] Test agent creation and retrieval

### Julep User Management
- [ ] Create Julep users for each MongoDB user
- [ ] Store Julep user ID in MongoDB
- [ ] Implement user sync utility
- [ ] Handle user creation errors gracefully

### Environment Configuration
- [x] Add `JULEP_API_KEY` to environment
- [x] Add `BACKGROUND_WORKER_AGENT_ID` to environment
- [x] Verify Julep client initialization
- [x] Test connection to Julep API

---

## Phase 4: Transcript Processing Pipeline ✅

### ElevenLabs API Integration
- [x] Create `app/src/lib/elevenlabs-api.ts` client
- [x] Implement `fetchConversationTranscript()` function
- [x] Test transcript fetching with real conversation ID
- [x] Handle API errors and rate limits
- [ ] Add transcript caching (optional)

### Transcript Processor Task
- [x] Create `agents/tasks/transcript-processor.yaml`
- [x] Define input schema (julep_user_id, conversation_id, transcript_text)
- [x] Implement insight extraction logic:
  - [x] Extract preferences (communication style, topics, hinglish level)
  - [x] Identify sentiment and mood patterns
  - [x] Detect important dates or life events
  - [x] Extract consent signals (flirt opt-in)
- [x] Return structured JSON output
- [ ] Test with sample transcripts

### API Endpoint
- [x] Create `/api/tasks/transcript` POST endpoint
- [x] Fetch transcript from ElevenLabs API
- [x] Create Julep task from YAML definition
- [x] Execute task with input parameters
- [x] Poll for task completion
- [x] Parse task output (JSON)
- [x] Sync results to MongoDB `user_overview`
- [x] Update `last_updated` timestamp
- [x] Handle errors and retries

### Conversation End Trigger
- [ ] Detect conversation end in voice-session component
- [ ] Call transcript processing API automatically
- [ ] Display processing status to user (optional)
- [ ] Handle background processing failures gracefully

### Testing
- [ ] Unit test: ElevenLabs API client
- [ ] Unit test: Task output parsing
- [ ] Integration test: End-to-end transcript processing
- [x] Manual test: Complete conversation → verify MongoDB update
- [x] Test error scenarios (missing transcript, API failure, etc.)

---

## Phase 5: Birth Chart Generation 📅

### Astrology API Selection
- [ ] Research astrology APIs (AstroAPI, Prokerala, Astro-Seek)
- [ ] Select primary API provider
- [ ] Obtain API credentials
- [ ] Store API key in environment
- [ ] Test API endpoints with sample birth data

### Chart Calculator Task
- [ ] Create `agents/tasks/chart-calculator.yaml`
- [ ] Define input schema (date_of_birth, birth_time, birth_place)
- [ ] Implement Vedic chart calculation
- [ ] Implement Western chart calculation
- [ ] Extract key placements (Sun, Moon, Ascendant, etc.)
- [ ] Return structured chart JSON
- [ ] Test with various birth data inputs

### API Endpoint
- [ ] Create `/api/tasks/chart` POST endpoint
- [ ] Execute chart calculator task
- [ ] Parse chart output
- [ ] Sync to MongoDB `user_overview.birth_chart`
- [ ] Handle incomplete birth data gracefully

### Trigger Integration
- [ ] Trigger chart calculation after first conversation with birth data
- [ ] Allow manual chart recalculation
- [ ] Cache chart results to avoid redundant API calls

### Dashboard Display
- [ ] Create chart visualization component
- [ ] Display Sun, Moon, and Ascendant prominently
- [ ] Show planet positions
- [ ] Add chart export functionality (optional)

### Testing
- [ ] Unit test: Astrology API client
- [ ] Integration test: Birth data → chart calculation → MongoDB
- [ ] Manual test: Verify chart accuracy with known birth data
- [ ] Test edge cases (missing time, unknown location, etc.)

---

## Phase 6: Daily Horoscope Generation 📅

### Horoscope Refresher Task
- [ ] Create `agents/tasks/horoscope-refresher.yaml`
- [ ] Implement daily horoscope generation for user's sun sign
- [ ] Personalize based on birth chart (moon sign, ascendant)
- [ ] Include transit highlights
- [ ] Return horoscope text + metadata
- [ ] Test with various zodiac signs

### Scheduling
- [ ] Set up daily cron job (e.g., 6:00 AM user local time)
  - Option A: GitHub Actions workflow
  - Option B: Next.js API route + external cron service (Vercel Cron)
  - Option C: Julep native scheduling (if available)
- [ ] Handle multiple timezones
- [ ] Test schedule trigger manually

### API Endpoint
- [ ] Create `/api/tasks/horoscope` POST endpoint
- [ ] Execute horoscope task for user
- [ ] Sync to MongoDB `user_overview.latest_horoscope`
- [ ] Update `last_updated` timestamp

### Dashboard Display
- [ ] Create horoscope card component
- [ ] Display today's horoscope prominently
- [ ] Show transit highlights
- [ ] Add "refresh" button for manual updates

### ElevenLabs Integration
- [ ] Pass `latest_horoscope` in dynamic variables
- [ ] Agent references horoscope naturally in greetings
- [ ] Test horoscope-aware conversations

### Testing
- [ ] Unit test: Horoscope generation logic
- [ ] Integration test: Horoscope task → MongoDB sync
- [ ] Manual test: Verify horoscope quality and personalization
- [ ] Test daily refresh workflow

---

## Phase 7: Gamification System 📅

### Gamification Tracker Task
- [ ] Create `agents/tasks/gamification-tracker.yaml`
- [ ] Implement conversation count tracking
- [ ] Calculate streak logic (consecutive days with conversations)
- [ ] Define milestones:
  - [ ] First conversation
  - [ ] 3-day streak
  - [ ] 7-day streak
  - [ ] 10 total conversations
  - [ ] 25 total conversations
  - [ ] Chart completion (all birth data provided)
- [ ] Return gamification JSON (streak_days, total_conversations, milestones)
- [ ] Test with simulated conversation sequences

### API Endpoint
- [ ] Create `/api/tasks/gamification` POST endpoint
- [ ] Execute gamification tracker task
- [ ] Parse output
- [ ] Sync to MongoDB `user_overview.gamification`
- [ ] Detect newly unlocked milestones

### Trigger Integration
- [ ] Call gamification update after transcript processing
- [ ] Update on every conversation (not just transcript-processed ones)
- [ ] Handle concurrent updates (race conditions)

### Dashboard Display
- [ ] Create gamification widget
- [ ] Display current streak prominently (with fire emoji 🔥)
- [ ] Show total conversation count
- [ ] Display unlocked milestones (badges/icons)
- [ ] Add progress bars for next milestone
- [ ] Animate milestone unlocks (confetti effect)

### ElevenLabs Integration
- [ ] Pass `streak_days` in dynamic variables
- [ ] Agent celebrates streaks and milestones
- [ ] Encourage continued engagement

### Testing
- [ ] Unit test: Streak calculation logic
- [ ] Integration test: Multiple conversations → streak tracking
- [ ] Test edge cases (streak breaks, multiple conversations same day)
- [ ] Manual test: Verify milestone detection and display

---

## Phase 8: Weekly Companion Report 📅

### Report Generator Task
- [ ] Create `agents/tasks/weekly-report-generator.yaml`
- [ ] Define report structure:
  - [ ] Week summary (conversations, topics discussed)
  - [ ] Astrological highlights (transits, notable patterns)
  - [ ] Personal insights (mood trends, growth areas)
  - [ ] Celebration (milestones, streaks)
  - [ ] Forward look (upcoming transits, suggestions)
- [ ] Personalize tone based on preferences (Hinglish level, flirt opt-in)
- [ ] Return report as markdown text
- [ ] Test with various user data scenarios

### Scheduling
- [ ] Set up weekly cron job (e.g., Sunday 6:00 PM)
- [ ] Handle timezones appropriately
- [ ] Test schedule trigger manually

### API Endpoint
- [ ] Create `/api/tasks/weekly-report` POST endpoint
- [ ] Execute report generator task
- [ ] Store report in MongoDB (new collection: `weekly_reports`)
- [ ] Update `user_overview` with latest report reference

### Report Viewing UI
- [ ] Create weekly reports list page
- [ ] Display reports chronologically
- [ ] Create individual report view (full screen)
- [ ] Add "mark as read" functionality
- [ ] Implement report sharing (optional)

### Delivery Options (Optional)
- [ ] Email delivery integration
- [ ] Push notification when new report available
- [ ] In-app notification badge

### Testing
- [ ] Unit test: Report content generation
- [ ] Integration test: Week of activity → report generation
- [ ] Test personalization with different preferences
- [ ] Manual test: Read full report, verify quality and tone

---

## Phase 9: Persona Enrichment 📅

### Persona Enrichment Task
- [ ] Create `agents/tasks/persona-enrichment.yaml`
- [ ] Analyze conversation patterns across multiple sessions
- [ ] Identify effective response styles per user
- [ ] Detect topic preferences and engagement triggers
- [ ] Return persona insights JSON
- [ ] Test with user conversation history

### API Endpoint
- [ ] Create `/api/tasks/persona` POST endpoint
- [ ] Execute persona enrichment task
- [ ] Sync to MongoDB `user_overview.insights`

### Trigger Integration
- [ ] Run persona enrichment every 5 conversations
- [ ] Allow manual trigger from admin panel (optional)

### ElevenLabs Integration
- [ ] Pass persona insights in `user_overview`
- [ ] Agent adapts style based on insights

### Testing
- [ ] Integration test: Multiple conversations → persona insights
- [ ] Manual test: Verify agent adapts effectively

---

## Phase 10: Context Enrichment & Dynamic Variables 📅

### Session Handshake Enhancement
- [ ] Update `/api/responder/session` to return all `user_overview` fields
- [ ] Structure dynamic variables for ElevenLabs:
  - [ ] `user_name`
  - [ ] `date_of_birth`
  - [ ] `sun_sign`, `moon_sign`, `ascendant`
  - [ ] `streak_days`
  - [ ] `total_conversations`
  - [ ] `hinglish_level`
  - [ ] `flirt_opt_in`
  - [ ] `latest_horoscope`
  - [ ] `recent_topics` (array)
  - [ ] `conversation_summary` (last 3 conversations)
- [ ] Test variable injection in ElevenLabs agent

### ElevenLabs Agent Configuration
- [ ] Update agent prompt to use dynamic variables
- [ ] Configure variable placeholders (e.g., `{{user_name}}`)
- [ ] Test variable substitution
- [ ] Verify agent responses reference context accurately

### Testing
- [ ] Integration test: MongoDB → Session API → ElevenLabs variables
- [ ] Manual test: Verify agent uses context in conversation
- [ ] Test with empty/missing fields (graceful degradation)

---

## Phase 11: Polish & Optimization 📅

### Performance
- [ ] Optimize MongoDB queries (indexing)
- [ ] Implement caching for frequently accessed data
- [ ] Add rate limiting on task trigger endpoints
- [ ] Monitor ElevenLabs API latency
- [ ] Optimize astrology API calls (caching, batching)

### Monitoring & Observability
- [ ] Set up structured logging for all tasks
- [ ] Create admin dashboard for task execution metrics
- [ ] Add alerting for task failures (email, Slack, etc.)
- [ ] Monitor MongoDB storage growth
- [ ] Track user engagement metrics

### Error Handling & Resilience
- [ ] Implement retry logic for transient failures
- [ ] Add dead letter queue for failed tasks
- [ ] Graceful degradation when services unavailable
- [ ] User-facing error messages (avoid technical jargon)
- [ ] Handle rate limits from external APIs

### Security Audit
- [ ] Review API key storage and access patterns
- [ ] Validate webhook authentication (if applicable)
- [ ] Check for API key exposure risks
- [ ] Audit user data access controls
- [ ] Review rate limiting and abuse prevention
- [ ] Ensure GDPR compliance (data export, deletion)

### Documentation
- [ ] Update README with final architecture
- [ ] Document all API endpoints (OpenAPI/Swagger)
- [ ] Create troubleshooting guide
- [ ] Add deployment guide (Vercel/Railway/etc.)
- [ ] Create video walkthrough (optional)

### Testing
- [ ] End-to-end user acceptance testing
- [ ] Load testing with multiple concurrent users
- [ ] Stress test task execution queue
- [ ] Security penetration testing
- [ ] Test all error scenarios

---

## Future Enhancements (Backlog) 💡

### Advanced Features
- [ ] Multi-language support (beyond Hinglish)
- [ ] Voice-triggered background tasks
- [ ] Relationship compatibility charts
- [ ] Predictive transit alerts
- [ ] Custom reminder system (important dates)

### External Integrations
- [ ] Google Calendar sync for auspicious dates
- [ ] Google Tasks integration
- [ ] Spotify mood playlists
- [ ] Notion/Obsidian journaling prompts

### AI Enhancements
- [ ] ML model for response effectiveness
- [ ] Personalized content recommendations
- [ ] Anomaly detection (unusual patterns)
- [ ] Predictive insights

---

## Quick Commands

```bash
# Install dependencies
cd app && bun install

# Development server
bun run dev

# Lint and format
bun run lint

# Test transcript processing
curl -X POST http://localhost:3000/api/tasks/transcript \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_123", "conversation_id": "conv_abc"}'

# Test chart calculation
curl -X POST http://localhost:3000/api/tasks/chart \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_123"}'

# Test gamification update
curl -X POST http://localhost:3000/api/tasks/gamification \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_123", "conversation_id": "conv_abc"}'

# Sync Julep agents (future)
bun run sync:agents
```

---

## Success Metrics

### User Engagement
- [ ] 70%+ users return for 2nd conversation within 7 days
- [ ] 50%+ users achieve 3-day streak
- [ ] 80%+ users complete full birth chart profile
- [ ] Average 5+ conversations per active user per month

### System Reliability
- [ ] 99%+ task execution success rate
- [ ] <5% failed transcript processing rate
- [ ] <1s p95 API response time for session handshake
- [ ] Zero security incidents

### User Satisfaction
- [ ] 4.5+ star rating in user feedback
- [ ] 80%+ positive sentiment in conversation summaries
- [ ] <5% churn rate for active users
- [ ] 60%+ users enable weekly reports

---

**Current Focus:** Phase 4 Testing + Phase 3 Julep User Management  
**Last Reviewed:** 2025-01-16  
**Next Review:** After completing user management and testing

**What's Ready:**
- ✅ All core utilities (ElevenLabs API, Julep client, task loader)
- ✅ Transcript processing API endpoint
- ✅ Julep background worker agent created and configured
- ⏳ Need to implement Julep user creation for each MongoDB user
- ⏳ Need to test with real conversation data
- ⏳ Need to implement conversation end trigger
