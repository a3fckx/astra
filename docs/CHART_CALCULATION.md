# Chart Calculation

Complete documentation for astrology chart generation in Astra.

## Overview

Automatically generates comprehensive Vedic and Western birth charts when users provide complete birth data.

## Requirements

Users need these fields in MongoDB:
- `date_of_birth` (Date) - YYYY-MM-DD
- `birth_time` (string) - HH:MM 24-hour format
- `birth_location` (string) - "City, Country"
- `birth_timezone` (string, optional) - IANA format (e.g., "Asia/Kolkata")

## Task Definition

**File:** `agents/tasks/chart-calculator.yaml`

**Input Schema:**
```yaml
input_schema:
  type: object
  required: [birth_date, birth_time, birth_location]
  properties:
    birth_date: string (YYYY-MM-DD)
    birth_time: string (HH:MM)
    birth_location: string ("City, Country")
    birth_timezone: string (IANA)
    ayanamsha: string (default: "lahiri")
```

**Prompts:**
- Expert Vedic astrologer persona with deep Jyotish expertise
- Expert Western astrologer persona with psychological astrology knowledge
- Both generate comprehensive JSON output

**Output:**
```typescript
{
  success: true,
  vedic_chart: {
    sun_sign, moon_sign, ascendant,
    planets: [9 planets with nakshatras, padas, degrees],
    house_lords: [12 houses with placements],
    yogas: [{name, description, strength}],
    dasha: {current periods with dates},
    planetary_strengths: {exalted, debilitated, retrograde},
    chart_summary: "3-4 sentence analysis"
  },
  western_chart: {
    sun_sign, moon_sign, rising_sign,
    planets: [10 planets with degrees],
    house_cusps: [12 cusps with Placidus],
    aspects: [{planet1, planet2, aspect, orb}],
    elements: {fire, earth, air, water},
    modalities: {cardinal, fixed, mutable},
    chart_patterns: ["T-Square", "Grand Trine", etc.],
    chart_summary: "Psychological summary"
  },
  calculated_at: ISO timestamp
}
```

## Data Storage

**MongoDB Location:**
```
Collection: user
Field: user.user_overview.birth_chart
```

**Structure:**
```typescript
{
  system: "both",                    // Always both Vedic and Western
  vedic: { /* vedic chart object */ },
  western: { /* western chart object */ },
  calculated_at: Date
}
```

**Access:**
```typescript
const user = await users.findOne({ id: userId });
const chart = user.user_overview?.birth_chart;

console.log(chart.vedic.sun_sign);    // "Leo"
console.log(chart.western.sun_sign);  // "Gemini"
```

## Flow

### 1. User Provides Birth Details
```
User conversation: "Born Aug 15, 1990 at 2:30 PM in Mumbai"
  ↓
Transcript processor extracts and saves to MongoDB
  ↓
user.date_of_birth = Date("1990-08-15")
user.birth_time = "14:30"
user.birth_location = "Mumbai, India"
user.birth_timezone = "Asia/Kolkata"
```

### 2. Automatic Trigger
```
Transcript processing completes
  ↓
Check: Complete birth data? ✓
Check: Chart exists? ✗
  ↓
POST /api/tasks/chart (fire-and-forget)
```

### 3. Chart Calculation
```
Load chart-calculator.yaml
  ↓
Get agent ID: getBackgroundWorkerAgentId()
  ↓
Create task bound to agent
  ↓
Execute with birth data input
  ↓
Task runs (30-60 seconds):
  - Vedic calculation (9 planets, nakshatras, yogas, dashas)
  - Western calculation (10 planets, aspects, patterns)
  ↓
Return JSON with both charts
  ↓
Sync to MongoDB: user.user_overview.birth_chart
```

### 4. Next Conversation
```
Session handshake fetches chart from MongoDB
  ↓
Send to ElevenLabs as dynamic variables:
  - vedic_sun, vedic_moon, vedic_ascendant
  - western_sun, western_moon, western_rising
  - chart_summary, current_dasha, etc.
  ↓
Agent uses chart in conversation:
"With your Leo sun and Pisces moon in Vedic..."
```

## API Endpoints

### POST /api/tasks/chart

**Request:**
```json
{
  "user_id": "user_123",           // Optional, defaults to session user
  "force_recalculate": false       // Force regeneration
}
```

**Response:**
```json
{
  "success": true,
  "task_id": "task_abc",
  "execution_id": "exec_xyz",
  "message": "Both Vedic and Western charts calculated successfully",
  "chart": {
    "system": "both",
    "vedic": {...},
    "western": {...}
  }
}
```

**Errors:**
- 400: Incomplete birth data (lists missing fields)
- 401: Unauthorized
- 500: Task execution failed

### GET /api/tasks/chart

**Request:**
```
GET /api/tasks/chart?user_id=xxx
```

**Response:**
```json
{
  "success": true,
  "chart": {...},
  "has_chart": true
}
```

## Key Anchor Comments

**Chart API Route:** `app/src/app/api/tasks/chart/route.ts`
- `ANCHOR:chart-task-trigger` - Entry point
- `ANCHOR:birth-data-validation` - Check completeness
- `ANCHOR:chart-task-execution` - Execute Julep task
- `ANCHOR:chart-mongodb-sync` - Sync to MongoDB

**Transcript Route:** `app/src/app/api/tasks/transcript/route.ts`
- `ANCHOR:async-task-chaining` - Automatic chart trigger

## Testing

### Manual Test
```bash
# 1. Set birth data in MongoDB
db.user.updateOne(
  { email: "test@example.com" },
  { $set: {
      date_of_birth: ISODate("1990-08-15"),
      birth_time: "14:30",
      birth_location: "Mumbai, India",
      birth_timezone: "Asia/Kolkata"
  }}
)

# 2. Trigger chart calculation
curl -X POST http://localhost:3000/api/tasks/chart \
  -H "Content-Type: application/json" \
  -H "Cookie: session_token=xxx"

# 3. Check MongoDB
db.user.findOne(
  { email: "test@example.com" },
  { "user_overview.birth_chart": 1 }
)
```

### Automatic Test
```bash
# Start conversation, mention birth details, end conversation
# Wait 60 seconds for background processing
# Check MongoDB for chart
```

## Troubleshooting

**Chart not calculating:**
- Check birth data completeness in MongoDB
- Check API logs for "Starting chart calculation"
- Check Julep dashboard for task execution status

**Chart data incorrect:**
- Verify birth data format (date: YYYY-MM-DD, time: HH:MM)
- Check timezone is valid IANA format
- Review Julep task execution logs
- Use `force_recalculate: true` to regenerate

**Task timeout:**
- Chart calculation takes 30-60 seconds
- Default timeout: 2 minutes (60 polls × 2s)
- Check network connectivity to Julep API

## Related Files

- Task: `agents/tasks/chart-calculator.yaml`
- API: `app/src/app/api/tasks/chart/route.ts`
- Schema: `app/src/lib/mongo.ts` (UserOverviewBirthChart type)
- Loader: `app/src/lib/tasks/loader.ts`
- Trigger: `app/src/app/api/tasks/transcript/route.ts`
