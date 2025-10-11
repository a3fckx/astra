# 🎯 Next Steps - Getting Astra Running

Clear, actionable steps to get your application fully operational.

---

## Current Status

✅ **Infrastructure Complete**
- YAML-based agent definitions created
- Sync script ready
- Dependencies cleaned up
- Bun WebSocket migrated
- Documentation complete
- TTS configured

🔄 **Ready for Agent Creation & Testing**

---

## Immediate Actions (Do These Now)

### 1. Create Agents in Julep

```bash
cd app

# Make sure your .env has:
# - JULEP_API_KEY
# - OPENROUTER_API_KEY
# - All MongoDB and Google OAuth credentials

bun run sync:agents
```

**Expected Output**:
```
🚀 Syncing agents from YAML definitions...

🔑 Storing OpenRouter API key in Julep Secrets...
   ✓ Secret stored

🤖 Processing agent: Astra
   + Creating new agent
   ✓ Created with ID: agent_abc123xyz

🤖 Processing agent: Astra Background Worker
   + Creating new agent
   ✓ Created with ID: agent_def456uvw

============================================================
📋 Add these to your app/.env file:
============================================================
ASTRA_AGENT_ID=agent_abc123xyz
BACKGROUND_AGENT_ID=agent_def456uvw
============================================================

✓ Saved agent IDs to julep-lock.json
```

### 2. Update .env with Agent IDs

Copy the agent IDs from the output above and add to `app/.env`:

```bash
# Open your .env file
vim app/.env

# Add these lines (use your actual IDs from step 1):
ASTRA_AGENT_ID=agent_abc123xyz
BACKGROUND_AGENT_ID=agent_def456uvw
```

### 3. Start the Application

```bash
cd app
bun run dev
```

Should see:
```
> next dev

  ▲ Next.js 15.5.0
  - Local:        http://localhost:3000

 ✓ Ready in 1.2s
```

### 4. Test Google OAuth Sign-In

1. Navigate to `http://localhost:3000`
2. Click "Sign in with Google"
3. Complete OAuth flow
4. Check server console for Julep sync logs:
   ```
   Syncing new user to Julep: your@email.com
   Successfully synced user with Julep ID: user_xxxxx
   ```

### 5. Test WebSocket Chat

After signing in, open browser console (`F12` → Console):

```javascript
// Connect to WebSocket
const ws = new WebSocket("ws://localhost:3000/api/responder/socket");

ws.onopen = () => {
  console.log("✓ Connected to Astra!");
  
  // Send a test message
  ws.send(JSON.stringify({
    type: "chat",
    text: "Hello Astra! Tell me about astrology."
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Received:", data.type);
  
  if (data.type === "message:assistant") {
    console.log("Astra says:", data.data.content);
  }
  
  if (data.type === "audio:chunk") {
    console.log("Audio chunk received!");
  }
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};
```

**Expected Flow**:
1. `{ type: "connected", data: { userId, sessionId } }`
2. `{ type: "message:user", ... }` (your message)
3. `{ type: "message:assistant", ... }` (Astra's response via OpenRouter/Claude)
4. `{ type: "audio:chunk", ... }` (TTS audio, if ElevenLabs configured)
5. `{ type: "audio:end" }`

### 6. Verify Everything Works

**Checklist**:
- [ ] Agents created successfully
- [ ] App starts without errors
- [ ] Google OAuth sign-in works
- [ ] User synced to Julep (check MongoDB for `julep_user_id` field)
- [ ] WebSocket connects
- [ ] Chat message sent
- [ ] Response received from Astra
- [ ] (Optional) Audio streaming works

---

## Phase 2: Birth Data Collection (After Basic App Works)

### Goal
Collect user's birth information to enable Vedic chart generation.

### Tasks

1. **Create Birth Data Form Component**
   ```typescript
   // app/src/components/birth-data-form.tsx
   
   interface BirthData {
     date: string;        // YYYY-MM-DD
     time: string;        // HH:mm
     timezone: string;    // IANA timezone (e.g., "Asia/Kolkata")
     location: string;    // City, Country
     latitude?: number;
     longitude?: number;
     system: "vedic" | "western";
     ayanamsha?: "Lahiri" | "Raman" | "KP";
   }
   ```

2. **Create API Route to Store Birth Data**
   ```typescript
   // app/src/app/api/user/birth-data/route.ts
   
   export async function POST(req: Request) {
     const session = await auth.api.getSession({ headers: req.headers });
     if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
     
     const birthData = await req.json();
     
     // Update MongoDB user record
     await getUsers().updateOne(
       { id: session.user.id },
       { $set: { birth_data: birthData, updated_at: new Date() } }
     );
     
     // Update Julep profile document
     await updateJulepProfileDoc(session.user.julep_user_id, birthData);
     
     return Response.json({ success: true });
   }
   ```

3. **Trigger Background Chart Generation**
   ```typescript
   // After birth data saved:
   await julepClient.executions.create({
     taskId: process.env.CHART_GENERATION_TASK_ID,
     input: {
       julep_user_id: session.user.julep_user_id,
       birth_data: birthData
     }
   });
   ```

---

## Phase 3: Vedic Chart Calculation

### Research Phase

**Options for Vedic Calculations**:

1. **Swiss Ephemeris Library**
   - C library with Python/Node bindings
   - Industry standard, extremely accurate
   - Repo: [aloistr/swisseph](https://github.com/aloistr/swisseph)
   - Node wrapper: `swisseph` npm package

2. **Astro-Seek API** (Paid)
   - REST API for calculations
   - No local computation needed
   - Monthly subscription

3. **Custom MCP Server**
   - Build MCP server wrapping Swiss Ephemeris
   - Deploy as separate service
   - Julep agents call via MCP protocol

**Recommended**: Option 3 (Custom MCP Server)

### Implementation Steps

1. **Create Vedic MCP Server** (separate project)
   ```typescript
   // vedic-mcp-server/
   // - Wraps Swiss Ephemeris
   // - Exposes MCP endpoints:
   //   - calculate_planets
   //   - calculate_houses
   //   - calculate_dashas
   //   - find_yogas
   ```

2. **Add MCP Tool to Background Worker**
   ```yaml
   # In agents/definitions/background-worker.yaml
   tools:
     - name: vedic_calculator
       type: integration
       integration:
         provider: mcp
         method: call_tool
         setup:
           transport: http
           http_url: https://vedic-mcp.your-domain.com/mcp
           http_headers:
             Authorization: "Bearer {VEDIC_MCP_API_KEY}"
   ```

3. **Create Chart Generation Task**
   ```yaml
   # agents/tasks/generate-chart.yaml
   name: Generate Vedic Birth Chart
   
   tools:
     - name: vedic_calculator
       # ... MCP tool definition
   
   main:
     - tool: search_user_profile
       # Get birth data
     
     - tool: vedic_calculator
       arguments:
         tool_name: "calculate_planets"
         arguments:
           date: $ _.birth_data.date
           time: $ _.birth_data.time
           # ...
     
     - tool: create_user_doc
       # Store chart data
   ```

---

## Phase 4: Enhanced Features

### 4.1 Daily Horoscope Generation

- Set up cron job (Vercel Cron, AWS EventBridge, etc.)
- Execute horoscope task for all users
- Generate predictions based on transits

### 4.2 Conversation Summarization

- After each chat session, write summary to notes document
- Background task analyzes patterns after 5+ conversations
- Updates preferences document

### 4.3 Voice-to-Voice Pipeline

- Add audio input capture (Web Audio API)
- Transcribe via Whisper API
- Process through Astra
- Stream TTS response

### 4.4 MCP Tool Ecosystem

**Potential MCP Integrations**:
- DeepWiki for astrology knowledge lookup
- GitHub Copilot for code generation (if needed)
- Weather API for auspicious timing
- Calendar integration for scheduling

---

## Development Workflow

### Daily Development

1. Start session tracking:
   ```bash
   ./session.sh start
   ```

2. Work on features, track in `SESSION.md`

3. Commit changes:
   ```bash
   git add .
   git commit -m "feat: add birth data form"
   ```

4. Archive session:
   ```bash
   ./session.sh backup
   ```

### Testing

```bash
# Run linter
cd app
bun run lint

# Type check
bun run type-check

# Start dev server
bun run dev
```

### Deployment

When ready for production:

1. **Set Production Environment Variables**
   - All API keys
   - Production MongoDB URI
   - Production Julep environment
   - Secure Better Auth secret

2. **Deploy to Platform**
   ```bash
   # Example: Vercel
   vercel --prod
   
   # Or: Railway, Render, etc.
   ```

3. **Verify Agents**
   - Check Julep dashboard
   - Test production endpoints
   - Monitor logs

---

## Troubleshooting Guide

### Issue: Agents Not Created

**Symptoms**: Sync script fails or no agent IDs shown

**Fixes**:
```bash
# Check .env has JULEP_API_KEY
cat app/.env | grep JULEP_API_KEY

# Verify API key is valid
# Go to dashboard.julep.ai → Settings → API Keys

# Re-run sync
cd app
bun run sync:agents
```

### Issue: WebSocket Won't Connect

**Symptoms**: Console shows connection refused or unauthorized

**Fixes**:
```bash
# 1. Make sure you're signed in
# 2. Check server logs for errors
# 3. Verify ASTRA_AGENT_ID is set
cat app/.env | grep ASTRA_AGENT_ID

# 4. Restart dev server
cd app
bun run dev
```

### Issue: No Response from Astra

**Symptoms**: Message sent but no response received

**Fixes**:
```bash
# Check OpenRouter API key
cat app/.env | grep OPENROUTER_API_KEY

# Check Julep dashboard → Agents → Astra
# - Verify model is set correctly
# - Check if any errors logged

# Check server console for errors
```

### Issue: TTS Not Working

**Symptoms**: Text response works but no audio

**Fixes**:
```bash
# Check ElevenLabs API key
cat app/.env | grep ELEVENLABS_API_KEY

# TTS failures are non-blocking
# Check server console for "TTS error" messages
# Verify API key has credits remaining
```

---

## Success Metrics

After completing immediate steps, you should have:

✅ Two agents created in Julep  
✅ App running on localhost:3000  
✅ Authentication working  
✅ WebSocket chat functional  
✅ Responses from OpenRouter/Claude  
✅ (Optional) TTS audio streaming  
✅ User data synced to Julep  
✅ Shared memory system operational  

---

## Questions to Answer

Before moving to Phase 2:

1. **Does the basic chat work?** - Can you have a conversation with Astra?
2. **Is memory working?** - Does Astra remember context across messages?
3. **Is TTS streaming?** - If configured, do you hear audio?
4. **Are users syncing?** - Check MongoDB for `julep_user_id` field

Once all "Yes" → Move to Phase 2 (Birth Data)

---

## Resources

- **Setup**: [docs/RUNNING_THE_APP.md](./docs/RUNNING_THE_APP.md)
- **Architecture**: [docs/SHARED_MEMORY_ARCHITECTURE.md](./docs/SHARED_MEMORY_ARCHITECTURE.md)
- **Agent Management**: [docs/AGENT_MANAGEMENT.md](./docs/AGENT_MANAGEMENT.md)
- **Julep Docs**: [docs.julep.ai](https://docs.julep.ai)
- **OpenRouter**: [openrouter.ai](https://openrouter.ai)

---

**Current Status**: 🚀 **Ready to create agents and test**

**Next Command**: `cd app && bun run sync:agents`
