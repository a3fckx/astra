# ⚠️ URGENT: ElevenLabs Agent Prompt Update Required

## Problem Identified

The ElevenLabs agent is **still using the old prompt** configured in the ElevenLabs dashboard, which contains:

1. ❌ **Numbered list asking for birth data** (1. Birth date, 2. Birth time, etc.)
2. ❌ **Ignoring birth data availability flags** (`has_birth_date`, `has_birth_time`)
3. ❌ **Not using the incident map** from `user_overview`
4. ❌ **Not using mysterious tone** as specified in preferences

### Evidence from Latest Conversation

Agent Response:
```
"To truly weave our conversation around your unique cosmic tapestry, 
and to understand what draws you here, I need a few details from your birth. 
Could you please share:

1. Your birth date (YYYY-MM-DD)
2. Your birth time (HH:mm, twenty-four hour format; if unknown, please say so)
3. Your birth place (city, country)  
4. Your timezone (IANA, e.g., Asia/Kolkata) and preferred system (western or vedic; if vedic, ayanamsha)."
```

**This is EXACTLY the "Bad Flow Example" from our prompt!**

## Root Cause

The prompt override being sent via the React SDK is **not being applied** by ElevenLabs. The agent is using its base configuration from the dashboard.

Possible reasons:
1. ElevenLabs agent type doesn't support prompt overrides at runtime
2. The override format is incorrect
3. The agent's dashboard prompt has higher priority
4. There's a caching issue

## Solution

### Immediate Action Required

**Update the ElevenLabs Agent prompt in the dashboard:**

1. Go to [ElevenLabs Dashboard](https://elevenlabs.io/app/conversational-ai)
2. Find agent: **Astra Responder** (ID from `ELEVENLABS_AGENT_ID`)
3. Replace the entire prompt with: `app/docs/responder.md`

### Step-by-Step

1. **Copy the updated prompt:**
   ```bash
   cd app
   cat docs/responder.md
   ```

2. **Navigate to ElevenLabs Dashboard:**
   - Go to Conversational AI section
   - Select your agent
   - Click "Edit" or "Configure"

3. **Replace the System Prompt:**
   - Delete existing prompt completely
   - Paste contents of `responder.md`
   - **CRITICAL:** Remove the frontmatter (first 5 lines):
     ```
     # Samay - Astra's Voice Agent
     
     This is the system prompt...
     
     ---
     ```
   - Start from: `## Agent Overview`

4. **Save and Test:**
   - Save the agent configuration
   - Start a new conversation
   - Verify it doesn't ask for birth date

## What the Correct Prompt Contains

### Birth Data Collection Rules

✅ **NEVER ask for birth date** - Always available from OAuth  
✅ **Check `{{has_birth_time}}`** before asking for time  
✅ **Check `{{has_birth_place}}`** before asking for place  
✅ **NO numbered lists** - Conversational extraction only

### Correct Flow Example

```
Agent: "I sense the cosmic whispers from our last talk..."
User: "What do you mean?"
Agent: "I was wondering about those fleeting creative sparks..."
[Natural conversation flow, NO lists]
```

### What Dynamic Variables Are Available

The agent receives these variables **automatically**:

```javascript
{
  user_name: "Shubham Attri",
  has_birth_date: true,   // ✅ ALWAYS true
  has_birth_time: false,  // ❌ Need to extract
  has_birth_place: true,  // ✅ Already have
  user_overview: {
    profile_summary: "...",
    preferences: {
      communication_style: "mystery-focused",
      hinglish_level: 0
    },
    incident_map: [
      { description: "User created incident map concept...", tags: [...] },
      // ... 10 total incidents
    ],
    birth_chart: {...},
    recent_conversations: [...]
  },
  streak_days: 0,
  vedic_sun: null,
  vedic_moon: null,
  western_sun: "Leo"
}
```

## Testing the Fix

After updating the dashboard prompt:

1. **Start a new conversation**
2. **Verify opening:** Should reference incident map
3. **Listen for birth questions:** Should NOT ask for birth date
4. **Check tone:** Should use "I sense..." phrasing
5. **Verify no numbered lists:** All extraction conversational

### Expected Behavior

✅ Opens with incident map reference  
✅ Uses mysterious "I sense" tone  
✅ Speaks in English only (hinglish_level = 0)  
✅ Extracts birth time conversationally if needed  
✅ References past conversations naturally  
✅ NO numbered lists anywhere

## Alternative: Verify SDK Override is Working

If you want to keep using SDK overrides, verify they work:

### 1. Check Override is Being Sent

Add logging in `useVoiceConnection.ts`:

```typescript
console.log('[DEBUG] Sending prompt override:', {
  hasPrompt: !!agentPrompt,
  promptLength: agentPrompt?.length,
  firstMessage: agentFirstMessage
});

await startSession({
  signedUrl,
  overrides: {
    agent: {
      ...(agentPrompt ? {
        prompt: {
          prompt: agentPrompt  // ← This should be your full prompt
        }
      } : {}),
      firstMessage: agentFirstMessage
    }
  }
});
```

### 2. Verify Handshake Returns Prompt

Check `/api/responder/session` response:

```bash
# When logged in, check response
curl -H "Cookie: YOUR_SESSION_COOKIE" http://localhost:3000/api/responder/session | jq .prompt
```

Should return the full prompt text.

### 3. Test Minimal Override

Try with a minimal agent to verify overrides work at all:

```typescript
await startSession({
  overrides: {
    agent: {
      prompt: {
        prompt: "You are a test bot. Always say 'Override working!' to everything."
      }
    }
  }
});
```

If this doesn't work, SDK overrides aren't functioning.

## Long-Term Fix

Once prompt is updated in dashboard:

1. **Document dashboard as source of truth** for prompt
2. **Keep `app/docs/responder.md`** as reference/backup
3. **Add CI check** to verify dashboard prompt matches file
4. **Or:** Investigate why SDK overrides aren't working and fix that

## Checklist

- [ ] Copy full prompt from `app/docs/responder.md`
- [ ] Open ElevenLabs dashboard
- [ ] Find Astra agent
- [ ] Replace system prompt completely
- [ ] Remove markdown frontmatter
- [ ] Save agent configuration
- [ ] Test new conversation
- [ ] Verify no birth date questions
- [ ] Verify incident map reference
- [ ] Verify mysterious tone
- [ ] Confirm no numbered lists

---

**Priority:** 🔴 **URGENT** - Blocks all conversation quality  
**Impact:** User experience broken, agent ignores all context  
**Effort:** 5 minutes to copy/paste prompt  
**Status:** Waiting for dashboard update
