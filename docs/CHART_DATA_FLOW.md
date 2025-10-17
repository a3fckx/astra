# Chart Data Storage and Flow

## Where Charts Are Saved

Charts are stored in **MongoDB** under the `user` collection:

```
MongoDB Collection: user
└── Document (one per user)
    ├── id: "user_123"
    ├── name: "Sarah"
    ├── email: "sarah@example.com"
    ├── date_of_birth: Date("1990-08-15")
    ├── birth_time: "14:30"
    ├── birth_location: "Mumbai, India"
    ├── birth_timezone: "Asia/Kolkata"
    └── user_overview: {
        ├── profile_summary: "..."
        ├── preferences: {...}
        ├── recent_conversations: [...]
        ├── gamification: {...}
        └── birth_chart: {              ← CHARTS STORED HERE
            ├── system: "both"
            ├── vedic: {
            │   ├── sun_sign: "Leo"
            │   ├── moon_sign: "Pisces"
            │   ├── ascendant: "Virgo"
            │   ├── planets: [
            │   │   {
            │   │     name: "Sun",
            │   │     sign: "Leo",
            │   │     house: 5,
            │   │     degree: "24°32'",
            │   │     nakshatra: "Magha",
            │   │     pada: 2,
            │   │     retrograde: false
            │   │   },
            │   │   {...}  // 8 more planets
            │   │ ],
            │   ├── house_lords: [
            │   │   {house: 1, lord: "Mercury", ...},
            │   │   {...}  // 11 more houses
            │   │ ],
            │   ├── yogas: [
            │   │   {name: "Gaja Kesari", strength: "strong"},
            │   │   {...}
            │   │ ],
            │   ├── dasha: {
            │   │   current_mahadasha: "Venus",
            │   │   current_antardasha: "Mercury",
            │   │   mahadasha_start: "2022-01-15",
            │   │   mahadasha_end: "2042-01-15"
            │   │ },
            │   ├── planetary_strengths: {...},
            │   └── chart_summary: "Detailed summary..."
            │ },
            ├── western: {
            │   ├── sun_sign: "Gemini"
            │   ├── moon_sign: "Scorpio"
            │   ├── rising_sign: "Virgo"
            │   ├── planets: [...]
            │   ├── house_cusps: [...]
            │   ├── aspects: [...]
            │   ├── elements: {fire: 1, earth: 3, ...}
            │   ├── modalities: {...}
            │   ├── chart_patterns: [...]
            │   └── chart_summary: "Psychological summary..."
            │ },
            └── calculated_at: Date("2025-10-17T12:00:00Z")
        }
    }
```

## Complete Data Flow

### 1. User Signs Up
```
User → Google OAuth → Better Auth → MongoDB
                                      ↓
                              user.date_of_birth (from Google)
                              user.birth_time (null initially)
                              user.birth_location (null initially)
```

### 2. First Conversation - Birth Details Mentioned
```
User: "I was born on August 15, 1990 at 2:30 PM in Mumbai"
  ↓
ElevenLabs Agent (voice conversation)
  ↓
Conversation ends
  ↓
POST /api/tasks/transcript
  ↓
Transcript Processor Task (Julep)
  ↓
Extract birth details from transcript
  ↓
MongoDB Update:
  user.date_of_birth = "1990-08-15"
  user.birth_time = "14:30"
  user.birth_location = "Mumbai, India"
  user.birth_timezone = "Asia/Kolkata"
  user.user_overview.birth_details = {...}
```

### 3. Automatic Chart Calculation Trigger
```
Transcript processing completes
  ↓
Check: Does user have complete birth data?
  ✓ date_of_birth exists
  ✓ birth_time exists
  ✓ birth_location exists
  ↓
Check: Does chart already exist?
  ✗ user.user_overview.birth_chart is null
  ↓
Trigger: POST /api/tasks/chart (fire-and-forget)
```

### 4. Chart Calculation (Background)
```
POST /api/tasks/chart
  ↓
Load chart-calculator.yaml
  ↓
Create Julep task with input:
  {
    birth_date: "1990-08-15",
    birth_time: "14:30",
    birth_location: "Mumbai, India",
    birth_timezone: "Asia/Kolkata",
    ayanamsha: "lahiri"
  }
  ↓
Execute task (30-60 seconds)
  ↓
Julep Agent: "You are a highly advanced Vedic astrologer..."
  ├─ Calculate Vedic chart (all 9 planets, nakshatras, yogas, dashas)
  └─ Calculate Western chart (all 10 planets, aspects, patterns)
  ↓
Return JSON:
  {
    vedic_chart: {...},
    western_chart: {...},
    calculated_at: "2025-10-17T12:00:00Z"
  }
  ↓
MongoDB Update:
  user.user_overview.birth_chart = {
    system: "both",
    vedic: {...},
    western: {...},
    calculated_at: Date(...)
  }
```

### 5. Next Conversation - Chart Available
```
User starts new conversation
  ↓
GET /api/responder/session (session handshake)
  ↓
Fetch from MongoDB:
  user.user_overview.birth_chart
  ↓
Send to ElevenLabs as dynamic variables:
  birth_chart_vedic: JSON.stringify(user.user_overview.birth_chart.vedic)
  birth_chart_western: JSON.stringify(user.user_overview.birth_chart.western)
  sun_sign_vedic: "Leo"
  moon_sign_vedic: "Pisces"
  sun_sign_western: "Gemini"
  moon_sign_western: "Scorpio"
  chart_summary: "Combined summary..."
  ↓
ElevenLabs Agent: "With your Leo sun and Pisces moon in Vedic, 
                   and Gemini sun in Western..."
```

## MongoDB Access Patterns

### Read Chart Data
```typescript
// Get user with chart
const user = await users.findOne({ id: userId });
const chart = user?.user_overview?.birth_chart;

// Check if chart exists
if (chart?.vedic && chart?.western) {
  // Both charts available
  console.log("Vedic Sun:", chart.vedic.sun_sign);
  console.log("Western Sun:", chart.western.sun_sign);
}
```

### Update Chart Data
```typescript
// Set chart (done by API endpoint)
await users.updateOne(
  { id: userId },
  {
    $set: {
      "user_overview.birth_chart": {
        system: "both",
        vedic: {...},
        western: {...},
        calculated_at: new Date()
      },
      "user_overview.last_updated": new Date(),
      "user_overview.updated_by": executionId
    }
  }
);
```

### Query Users with Charts
```typescript
// Find users who have complete birth data but no chart
const usersNeedingCharts = await users.find({
  date_of_birth: { $exists: true, $ne: null },
  birth_time: { $exists: true, $ne: null },
  birth_location: { $exists: true, $ne: null },
  "user_overview.birth_chart": { $exists: false }
}).toArray();
```

## Key Field Paths

| Data | MongoDB Field Path | Description |
|------|-------------------|-------------|
| **Birth Date** | `user.date_of_birth` | Date object |
| **Birth Time** | `user.birth_time` | String "HH:MM" |
| **Birth Location** | `user.birth_location` | String "City, Country" |
| **Birth Timezone** | `user.birth_timezone` | String IANA format |
| **Vedic Chart** | `user.user_overview.birth_chart.vedic` | Complete Vedic chart object |
| **Western Chart** | `user.user_overview.birth_chart.western` | Complete Western chart object |
| **Chart Calculated At** | `user.user_overview.birth_chart.calculated_at` | Date object |
| **Vedic Sun Sign** | `user.user_overview.birth_chart.vedic.sun_sign` | String |
| **Vedic Moon Sign** | `user.user_overview.birth_chart.vedic.moon_sign` | String |
| **Western Sun Sign** | `user.user_overview.birth_chart.western.sun_sign` | String |
| **All Planets (Vedic)** | `user.user_overview.birth_chart.vedic.planets` | Array of planet objects |
| **Yogas** | `user.user_overview.birth_chart.vedic.yogas` | Array of yoga objects |
| **Current Dasha** | `user.user_overview.birth_chart.vedic.dasha` | Dasha object with dates |
| **Aspects (Western)** | `user.user_overview.birth_chart.western.aspects` | Array of aspect objects |
| **Chart Patterns** | `user.user_overview.birth_chart.western.chart_patterns` | Array of pattern objects |

## When Chart Is Calculated

**Automatic Triggers:**
1. ✅ After transcript processing, if:
   - `user.date_of_birth` exists
   - `user.birth_time` exists
   - `user.birth_location` exists
   - `user.user_overview.birth_chart` does NOT exist

**Manual Trigger:**
```bash
# Force recalculation
POST /api/tasks/chart
{
  "user_id": "user_123",
  "force_recalculate": true
}
```

## Chart Availability Check

```typescript
function hasCompleteChart(user: AstraUser): boolean {
  const chart = user.user_overview?.birth_chart;
  return !!(
    chart &&
    chart.system === "both" &&
    chart.vedic &&
    chart.western &&
    chart.vedic.planets &&
    chart.western.planets
  );
}
```

## Accessing Chart in ElevenLabs Context

The chart is sent to ElevenLabs agent in the session handshake:

```typescript
// In session handshake route
const user = await users.findOne({ id: userId });
const chart = user.user_overview?.birth_chart;

// Dynamic variables sent to ElevenLabs
{
  user_name: user.name,
  birth_chart: JSON.stringify(chart), // Full chart
  vedic_sun: chart?.vedic?.sun_sign,
  vedic_moon: chart?.vedic?.moon_sign,
  vedic_ascendant: chart?.vedic?.ascendant,
  western_sun: chart?.western?.sun_sign,
  western_moon: chart?.western?.moon_sign,
  western_rising: chart?.western?.rising_sign,
  chart_summary_vedic: chart?.vedic?.chart_summary,
  chart_summary_western: chart?.western?.chart_summary,
  current_dasha: chart?.vedic?.dasha?.current_mahadasha,
  // ... more fields as needed
}
```

## Summary

**Storage Location:**
```
MongoDB → user collection → user_overview.birth_chart
```

**When Created:**
- Automatically after first conversation with birth details
- Can be manually triggered via API

**What's Stored:**
- Complete Vedic chart (9 planets, nakshatras, yogas, dashas)
- Complete Western chart (10 planets, aspects, patterns)
- Calculation timestamp

**How It's Used:**
- ElevenLabs agent receives chart in every conversation
- Agent can reference specific placements
- Powers personalized astrology guidance
