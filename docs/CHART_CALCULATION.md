# Chart Calculation Feature

## Overview

Astrology chart calculation is now integrated into Astra's background processing system. Charts are automatically generated when users provide complete birth data.

## Requirements for Chart Calculation

To generate an astrology chart, users need:

1. **Date of Birth** (`date_of_birth`) - YYYY-MM-DD format
2. **Birth Time** (`birth_time`) - HH:MM 24-hour format
3. **Birth Location** (`birth_location`) - "City, Country" format
4. **Timezone** (`birth_timezone`) - Optional but recommended (IANA format)

## How It Works

### Automatic Triggering

After a conversation ends and transcript is processed:

1. System checks if user has complete birth data
2. If birth data is complete AND chart doesn't exist:
   - Automatically triggers chart calculation task
   - Runs asynchronously in background (fire-and-forget)
3. Chart is calculated and synced to MongoDB `user_overview.birth_chart`
4. Next conversation: ElevenLabs agent receives chart in context

### Manual Triggering

You can also manually trigger chart calculation:

```bash
# Calculate chart for authenticated user
POST /api/tasks/chart
{
  "chart_system": "vedic"  // or "western" or "both"
}

# Force recalculation
POST /api/tasks/chart
{
  "force_recalculate": true,
  "chart_system": "both"
}

# Get existing chart
GET /api/tasks/chart?user_id=xxx
```

## Task Flow

### File: `agents/tasks/chart-calculator.yaml`

**Input:**
- `birth_date`: "1990-08-15"
- `birth_time`: "14:30"
- `birth_location`: "Mumbai, India"
- `birth_timezone`: "Asia/Kolkata" (optional)
- `chart_system`: "vedic" | "western" | "both"

**Process:**
1. Validate birth data completeness
2. Generate Vedic chart (if requested):
   - Ascendant, Sun, Moon signs
   - Planetary positions with houses, degrees, nakshatras
   - House lords, yogas, dasha system
   - Strengths and challenges
3. Generate Western chart (if requested):
   - Sun, Moon, Rising signs
   - Planetary positions with aspects
   - Element and modality distribution
   - Chart patterns (Grand Trine, T-Square, etc.)
4. Return structured JSON

**Output (synced to MongoDB):**
```json
{
  "success": true,
  "chart_system": "vedic",
  "vedic_chart": {
    "sun_sign": "Leo",
    "moon_sign": "Pisces",
    "ascendant": "Gemini",
    "planets": [...],
    "house_lords": [...],
    "yogas": ["Raj Yoga"],
    "dasha": {
      "mahadasha": "Jupiter",
      "antardasha": "Saturn"
    },
    "chart_summary": "Strong 9th house with exalted Jupiter..."
  },
  "calculated_at": "2025-01-15T10:30:00Z"
}
```

## API Implementation

### File: `app/src/app/api/tasks/chart/route.ts`

**Key Anchor Comments:**
- `ANCHOR:chart-task-trigger` - Entry point
- `ANCHOR:birth-data-validation` - Check for complete birth data
- `ANCHOR:chart-task-execution` - Execute Julep task
- `ANCHOR:chart-mongodb-sync` - Sync results to MongoDB

**Error Handling:**
- Returns 400 if birth data incomplete (lists missing fields)
- Returns existing chart if already calculated (unless force_recalculate)
- Logs detailed execution progress

## MongoDB Schema

### Type: `UserOverviewBirthChart`

```typescript
{
  system: "vedic" | "western" | "both";
  vedic?: {
    sun_sign: string;
    moon_sign: string;
    ascendant: string;
    planets: Array<{
      name: string;
      sign: string;
      house: number;
      degree: string;
      nakshatra?: string;
    }>;
    house_lords: Array<{ house: number; lord: string }>;
    yogas: string[];
    dasha: { mahadasha: string; antardasha: string };
    strengths: string[];
    challenges: string[];
    chart_summary: string;
  };
  western?: {
    sun_sign: string;
    moon_sign: string;
    rising_sign: string;
    planets: Array<{...}>;
    aspects: Array<{...}>;
    elements: { fire: number; earth: number; air: number; water: number };
    modalities: { cardinal: number; fixed: number; mutable: number };
    patterns: string[];
    chart_summary: string;
  };
  calculated_at: Date;
}
```

Stored at: `user.user_overview.birth_chart`

## Integration with Voice Agent

The chart is automatically included in ElevenLabs agent context:

```typescript
// In session handshake (app/src/app/api/responder/session/route.ts)
const user = await getUser(userId);

// Send to ElevenLabs as dynamic variables
await conversation.setVariables({
  birth_chart: JSON.stringify(user.user_overview?.birth_chart),
  chart_summary: user.user_overview?.birth_chart?.vedic?.chart_summary || 
                 user.user_overview?.birth_chart?.western?.chart_summary,
  sun_sign: user.user_overview?.birth_chart?.vedic?.sun_sign ||
            user.user_overview?.birth_chart?.western?.sun_sign,
  moon_sign: user.user_overview?.birth_chart?.vedic?.moon_sign ||
             user.user_overview?.birth_chart?.western?.moon_sign,
});
```

Agent can now reference chart in responses:
> "With your Leo sun and Pisces moon, this Saturn transit affects your 7th house..."

## Testing

### Manual Test Flow

1. Create user with birth data:
```bash
# Sign up via Google (with birthday scope)
# Or manually update MongoDB:
db.user.updateOne(
  { email: "test@example.com" },
  { 
    $set: {
      date_of_birth: ISODate("1990-08-15"),
      birth_time: "14:30",
      birth_location: "Mumbai, India",
      birth_timezone: "Asia/Kolkata"
    }
  }
)
```

2. Trigger chart calculation:
```bash
curl -X POST http://localhost:3000/api/tasks/chart \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_TOKEN" \
  -d '{"chart_system": "vedic"}'
```

3. Check MongoDB:
```javascript
db.user.findOne(
  { email: "test@example.com" },
  { "user_overview.birth_chart": 1 }
)
```

4. Start conversation and verify agent has chart context

### Automatic Test Flow

1. Sign up new user
2. Start conversation
3. Mention birth details: "I was born on August 15, 1990 at 2:30 PM in Mumbai"
4. End conversation
5. Wait 30-60 seconds for background processing
6. Check MongoDB for birth_chart
7. Start new conversation - agent should reference chart

## Future Enhancements

- [ ] Support for multiple chart calculation methods (Whole Sign, Placidus, etc.)
- [ ] Chart visualization (SVG/Canvas generation)
- [ ] Progressions and transits
- [ ] Chart comparison (synastry)
- [ ] Dashas and periods timeline
- [ ] Integration with external astrology APIs for precise calculations
- [ ] PDF export of full chart report

## Troubleshooting

### Chart not calculating

**Check:**
1. Birth data completeness:
   ```javascript
   const user = await db.user.findOne({ email: "user@example.com" });
   console.log({
     date: user.date_of_birth,
     time: user.birth_time,
     location: user.birth_location
   });
   ```

2. Task execution logs:
   ```bash
   # Check API logs for "Starting chart calculation"
   # Check Julep dashboard for task execution status
   ```

3. MongoDB sync:
   ```javascript
   // Should have user_overview.birth_chart after task completes
   ```

### Chart data incorrect

- Verify birth data format (date: YYYY-MM-DD, time: HH:MM)
- Check timezone is correct IANA format
- Review task output in Julep execution logs
- Consider using `force_recalculate: true` to regenerate

### Task fails with timeout

- Chart calculation can take 30-60 seconds
- Default timeout is 2 minutes (60 attempts × 2s)
- Check network connectivity to Julep API
- Review Julep rate limits

## Related Files

- Task: `agents/tasks/chart-calculator.yaml`
- API: `app/src/app/api/tasks/chart/route.ts`
- Schema: `app/src/lib/mongo.ts` (UserOverviewBirthChart)
- Loader: `app/src/lib/tasks/loader.ts`
- Trigger: `app/src/app/api/tasks/transcript/route.ts` (automatic)
