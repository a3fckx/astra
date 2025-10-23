# Complete Background Task System

> **Status:** Production Ready ✅  
> **Date:** October 19, 2025  
> **All YAML Files Validated:** ✅ (except deprecated gamification-tracker)

---

## Overview

Astra's background task system is now complete with all core features implemented. This document provides a comprehensive reference for the task system architecture, YAML syntax, and API endpoints.

## Task Flow Summary

```
User Conversation → Transcript Processing → Extract Birth Data
                                           ↓
                    ┌──────────────────────┴────────────────────┐
                    ↓                      ↓                     ↓
            Chart Calculation      Gamification         Persona Enrichment
            (if data complete)     (every convo)        (every 5 convos)
                    ↓                      ↓                     ↓
            MongoDB user_overview  MongoDB user_overview  MongoDB user_overview
                    ↓                      ↓                     ↓
            ElevenLabs Agent ← Full Context from MongoDB ← All Results
```

---

## Implemented Tasks

### 1. Transcript Processor ✅
**YAML:** `agents/tasks/transcript-processor.yaml`  
**API:** Triggered automatically by `useVoiceConnection.onDisconnect()`  
**Endpoint:** `POST /api/tasks/transcript`

**Purpose:** Extract insights, preferences, and birth details from conversation transcripts.

**Input:**
- `julep_user_id`: Julep user ID
- `conversation_id`: ElevenLabs conversation ID
- `transcript_text`: Full transcript
- `existing_overview`: Current MongoDB user_overview
- `memory_store_token`: Optional Memory Store token

**Output:**
```typescript
{
  overview_updates: {
    profile_summary: string;
    preferences: {
      communication_style: "casual" | "balanced" | "formal";
      topics_of_interest: string[];
      hinglish_level: number; // 0-100
      flirt_opt_in: boolean;
      astrology_system: "vedic" | "western" | "both";
    };
    insights: Array<{type: string, content: string, generated_at: string}>;
  };
  conversation_summary: {
    summary: string;
    topics: string[];
    key_insights: string[];
    questions_asked: string[];
    emotional_tone: string;
  };
  birth_details: {
    city: string;
    country: string;
    place_text: string;
  };
  incident_map: Array<{title: string, description: string, tags: string[]}>;
  first_message: string; // For next conversation greeting
}
```

**Triggers:**
- ✅ Automatic: After every conversation ends
- ✅ Chains to: Gamification update
- ✅ Chains to: Chart calculation (if birth data complete)

---

### 2. Chart Calculator ✅
**YAML:** `agents/tasks/chart-calculator.yaml`  
**API:** `POST /api/tasks/chart`  
**Endpoint:** `/api/tasks/chart`

**Purpose:** Generate comprehensive Vedic and Western birth charts with famous people born on same date.

**Input:**
- `birth_date`: YYYY-MM-DD format
- `birth_time`: HH:MM 24-hour format
- `birth_location`: "City, Country"
- `birth_timezone`: IANA timezone (optional)
- `ayanamsha`: "lahiri" (default for Vedic)

**Output:**
```typescript
{
  birth_chart: {
    vedic: {
      system: "vedic";
      sun_sign: string;
      moon_sign: string;
      ascendant: string;
      planets: Array<{
        name: string;
        sign: string;
        house: number;
        degree: string;
        nakshatra: string;
        retrograde: boolean;
      }>;
      dasha: {
        current_mahadasha: string;
        current_antardasha: string;
        start_date: string;
      };
      chart_summary: string;
    };
    western: {
      system: "western";
      sun_sign: string;
      moon_sign: string;
      rising_sign: string;
      planets: Array<{...}>;
      aspects: Array<{type: string, planets: string[], orb: string}>;
      chart_summary: string;
    };
    famous_people: Array<{
      name: string;
      category: string;
      known_for: string;
      birth_year: number;
    }>;
    calculated_at: string;
  }
}
```

**Triggers:**
- ✅ Automatic: When transcript processor detects complete birth data
- ✅ Manual: `POST /api/tasks/chart`
- ✅ Condition: `date_of_birth` AND `birth_time` AND `birth_location` present

---

### 3. Famous People Finder ✅
**YAML:** `agents/tasks/famous-people-finder.yaml`  
**API:** Integrated into chart calculation  
**Standalone:** Can be used separately if needed

**Purpose:** Find 7-10 notable people born on same month/day to predict personality "animal spirit".

**Input:**
- `birth_date`: YYYY-MM-DD format

**Output:**
```typescript
{
  famous_people: Array<{
    name: string;
    category: "Technologist" | "Artist" | "Poet" | "Leader" | etc;
    known_for: string;
    birth_year: number;
    personality_trait: string;
  }>;
  personality_analysis: {
    dominant_categories: string[];
    common_traits: string[];
    animal_spirit: string; // e.g., "The Innovator"
    life_path_prediction: string;
    energy_description: string;
  };
}
```

---

### 4. Gamification Tracker ✅
**Implementation:** Direct MongoDB calculation in API  
**YAML:** `agents/tasks/gamification-tracker.yaml` (DEPRECATED)  
**API:** `POST /api/tasks/gamification`

**Purpose:** Track conversation streaks, milestones, and engagement metrics.

**Metrics Tracked:**
- Current streak (consecutive days with conversations)
- Best streak ever achieved
- Total conversation count
- Milestones unlocked (9 types)
- Topics explored
- Chart completion percentage

**Milestones:**
- 🎯 First Conversation
- 🔥 3-Day Streak
- 🔥 7-Day Streak
- ⭐ 10 Conversations
- 🌟 25 Conversations
- 🚀 50 Conversations
- 🏆 100 Conversations
- 📊 Full Chart Completion
- 🗺️ Topic Explorer (5+ topics)

**Output:**
```typescript
{
  gamification: {
    streak_days: number;
    best_streak: number;
    total_conversations: number;
    milestones_unlocked: string[];
    topics_explored: string[];
    chart_completion_percent: number;
    last_conversation_date: Date;
    last_updated: Date;
  };
  new_milestones: string[]; // e.g., ["🔥 3-Day Streak"]
}
```

**Triggers:**
- ✅ Automatic: After every transcript processing
- ✅ Manual: `POST /api/tasks/gamification`

---

### 5. Horoscope Generator ✅
**YAML:** `agents/tasks/horoscope-refresher.yaml`  
**API:** `POST /api/tasks/horoscope`

**Purpose:** Generate personalized daily horoscope based on birth chart.

**Input:**
- `sun_sign`: User's sun sign
- `moon_sign`: User's moon sign
- `rising_sign`: User's rising sign (optional)
- `user_name`: First name for personalization
- `recent_topics`: Recent conversation topics
- `astrology_system`: "vedic" | "western"

**Output:**
```typescript
{
  horoscope: {
    date: string; // YYYY-MM-DD
    content: string; // 2-3 paragraphs
    sun_sign: string;
    moon_sign: string;
    generated_at: string;
  }
}
```

**Features:**
- Personalized with user's name and recent topics
- Includes planetary transits
- Practical guidance for relationships, work, personal growth
- Lucky elements (color, number, time)
- Skips regeneration if today's horoscope exists

**Triggers:**
- ✅ Manual: `POST /api/tasks/horoscope`
- ⏳ Future: Daily cron job at 6 AM user's timezone

---

### 6. Weekly Report Generator ✅
**YAML:** `agents/tasks/weekly-report-generator.yaml`  
**API:** `POST /api/tasks/weekly-report`

**Purpose:** Create warm, personalized weekly check-in with conversation summaries.

**Input:**
- `user_name`: First name
- `recent_conversations`: Last 7 days of conversations
- `gamification`: Current gamification stats
- `preferences`: User preferences (Hinglish level, style)
- `birth_chart_summary`: Brief chart summary

**Output:**
```typescript
{
  weekly_report: {
    week_start: string; // YYYY-MM-DD
    week_end: string;
    content: string; // 4 paragraphs
    stats: {
      conversations: number;
      topics: string[];
      streak: number;
      milestones: string[];
    };
    generated_at: string;
  }
}
```

**Report Structure:**
1. Warm greeting addressing user
2. Journey recap highlighting themes and growth
3. Progress celebration (streaks, milestones, topics)
4. Looking ahead with reflection prompt

**Triggers:**
- ✅ Manual: `POST /api/tasks/weekly-report`
- ⏳ Future: Weekly cron job (Sunday 6 PM)

---

### 7. Persona Enrichment ✅
**YAML:** `agents/tasks/persona-enrichment.yaml`  
**API:** `POST /api/tasks/persona`

**Purpose:** Analyze conversation patterns to refine user preferences.

**Input:**
- `recent_conversations`: Last 10-20 conversation summaries
- `existing_preferences`: Current preferences to update

**Output:**
```typescript
{
  preferences_update: {
    communication_style: "casual" | "balanced" | "formal";
    topics_of_interest: string[];
    hinglish_level: number; // 0-100
    emotional_patterns: string[];
    response_preference: "concise" | "moderate" | "detailed";
    engagement_triggers: string[];
    time_patterns: string | null;
    insights: string[]; // Observations about user communication
  };
  conversations_analyzed: number;
}
```

**Triggers:**
- ✅ Manual: `POST /api/tasks/persona`
- ⏳ Recommended: Every 5 conversations

---

## YAML Syntax Best Practices

### Critical LLM Instructions

All prompts that generate JSON **MUST** include these instructions:

```yaml
- prompt: |-
    Your task description here.
    
    CRITICAL: Return ONLY valid JSON (no markdown, no explanations, no code blocks).
    Start with {{ and end with }}. Do NOT wrap in ```json or ```.
    
    Required format:
    {{
      "field1": "value1",
      "field2": ["array", "values"]
    }}
    
    input_var = {_.input_var}
  unwrap: true
```

### Input References

Always use `_` for input fields instead of `steps[0].input`:

```yaml
# ✅ Correct
- evaluate:
    birth_date: $ _.birth_date
    
# ❌ Wrong
- evaluate:
    birth_date: $ steps[0].input.birth_date
```

### JSON Parsing Pattern

Always clean markdown wrappers before parsing:

```yaml
- prompt: |-
    Generate JSON...
  unwrap: true

- evaluate:
    cleaned: $ steps[N].output.strip().removeprefix('```json').removeprefix('```').removesuffix('```').strip()

- evaluate:
    parsed: $ json.loads(steps[N+1].output.cleaned)
```

### Project Field

All tasks **MUST** include project field:

```yaml
name: Task Name
description: Task description
project: astra

input_schema:
  type: object
  ...
```

### Return Statement

Keep return structure flat and match MongoDB schema:

```yaml
- return:
    success: true
    field_name: $ _.calculated_value
    nested_object:
      key: value
    timestamp: $ datetime.now().isoformat()
```

---

## API Endpoint Pattern

All task endpoints follow this structure:

```typescript
// POST handler - Trigger task execution
export async function POST(request: Request) {
  // 1. Check authentication
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Get and validate user
  const users = getUsers();
  const user = await users.findOne({ id: userId });
  if (!user.julep_user_id) return error;

  // 3. Validate prerequisites (birth data, conversation count, etc.)
  // Return 400 error if not met

  // 4. Execute Julep task
  const taskDef = loadTaskDefinition("TASK_NAME");
  const result = await julepClient.createAndExecuteTask(agentId, taskDef, input, pollOptions);

  // 5. Parse output
  const taskOutput = result.output as ExpectedType;

  // 6. Sync to MongoDB
  await users.updateOne({ id: userId }, { $set: { "user_overview.field": data } });

  // 7. Return success response
  return NextResponse.json({ success: true, ...data });
}

// GET handler - Retrieve existing data
export async function GET(request: Request) {
  // Return data from MongoDB user_overview
}
```

---

## MongoDB Schema

All task results sync to `user.user_overview`:

```typescript
user_overview: {
  profile_summary: string;
  
  birth_details: {
    city: string;
    country: string;
    place_text: string;
    timezone: string;
  };
  
  birth_chart: {
    system: "both";
    vedic: VedicChart;
    western: WesternChart;
    famous_people: FamousPerson[];
    calculated_at: Date;
  };
  
  preferences: {
    communication_style: string;
    topics_of_interest: string[];
    hinglish_level: number;
    flirt_opt_in: boolean;
    astrology_system: string;
    favorite_astro_topics: string[];
    notification_preferences: object;
  };
  
  recent_conversations: Array<{
    conversation_id: string;
    date: Date;
    topics: string[];
    summary: string;
    key_insights: string[];
    questions_asked: string[];
    emotional_tone: string;
    follow_up_actions: string[];
  }>;
  
  gamification: {
    streak_days: number;
    best_streak: number;
    total_conversations: number;
    milestones_unlocked: string[];
    topics_explored: string[];
    chart_completion_percent: number;
    last_conversation_date: Date;
    last_updated: Date;
  };
  
  latest_horoscope: {
    date: string;
    content: string;
    sun_sign: string;
    moon_sign: string;
    generated_at: string;
  };
  
  latest_weekly_report: WeeklyReport;
  weekly_reports: WeeklyReport[]; // Last 4
  
  incident_map: Array<{
    title: string | null;
    description: string;
    tags: string[];
  }>;
  
  insights: Array<{
    type: string;
    content: string;
    generated_at: Date;
    confidence: number;
  }>;
  
  first_message: string | null; // For next conversation
  last_updated: Date;
  updated_by: string;
}
```

---

## Testing Checklist

### YAML Validation
```bash
# Validate single file
bunx js-yaml agents/tasks/chart-calculator.yaml

# Validate all files
for file in agents/tasks/*.yaml; do 
  echo "Checking $file..." && bunx js-yaml "$file" > /dev/null 2>&1 && echo "✅ Valid" || echo "❌ Invalid"
done
```

### Current Status
- ✅ chart-calculator.yaml
- ✅ famous-people-finder.yaml
- ✅ horoscope-refresher.yaml
- ✅ persona-enrichment.yaml
- ✅ transcript-processor.yaml
- ✅ weekly-report-generator.yaml
- ❌ gamification-tracker.yaml (DEPRECATED, not used)

### Manual Testing

1. **Complete a Conversation**
   ```bash
   # Start voice session, talk with Samay, end conversation
   # Check logs for:
   # - "Triggering background transcript processing"
   # - "Transcript fetched"
   # - "MongoDB user_overview merged"
   # - "Triggering gamification update"
   ```

2. **Provide Birth Data During Conversation**
   ```
   User: "I was born at 2:30 PM in Mumbai"
   # Check logs for:
   # - Birth time extracted: "14:30"
   # - Birth location extracted: "Mumbai, India"
   # - "Triggering chart calculation" (if date also present)
   ```

3. **Generate Horoscope**
   ```bash
   curl -X POST http://localhost:3000/api/tasks/horoscope \
     -H "Cookie: better-auth.session_token=..." \
     -H "Content-Type: application/json" \
     -d '{}' | jq .
   ```

4. **Check Gamification**
   ```bash
   curl http://localhost:3000/api/tasks/gamification \
     -H "Cookie: better-auth.session_token=..." | jq .
   ```

---

## Implementation Status

### Completed ✅
- ✅ Phase 1: Foundation
- ✅ Phase 2: MongoDB Schema
- ✅ Phase 3: Julep Setup + User Sync
- ✅ Phase 4: Transcript Processing
- ✅ Phase 5: Birth Chart Generation (API + YAML)
- ✅ Phase 6: Daily Horoscope
- ✅ Phase 7: Gamification System
- ✅ Phase 8: Weekly Reports
- ✅ Phase 9: Persona Enrichment

### Remaining ⏳
- ⏳ Phase 10: Context Enrichment (pass all fields to ElevenLabs)
- ⏳ Phase 11: Polish & Optimization (monitoring, caching, cron jobs)

---

## Key Commits

1. **b68cdc2** - Gamification tracker and user sync migration
2. **e7d451f** - Horoscope and weekly report generators
3. **4e56c19** - Background tasks implementation documentation
4. **cc11b27** - YAML syntax fixes and LLM prompt improvements
5. **237b8f0** - Persona enrichment endpoint and task input fixes

---

## Next Steps

### Immediate
1. **Test chart calculation** with real birth data (date + time + location)
2. **Verify all tasks** execute successfully in production
3. **Monitor logs** for task completion rates

### Phase 10: Context Enrichment
- Update `/api/responder/session` to return ALL user_overview fields
- Pass birth chart, horoscope, gamification to ElevenLabs agent
- Test agent references context accurately in conversations

### Phase 11: Polish
- Set up daily horoscope cron job (6 AM user timezone)
- Set up weekly report cron job (Sunday 6 PM)
- Add automated persona enrichment trigger (every 5 conversations)
- Implement monitoring and alerting
- Add rate limiting on task endpoints
- Create admin dashboard for task metrics

---

**Last Updated:** October 19, 2025  
**Maintainer:** Development Team  
**Status:** Production Ready
