# Running the Astra Application

Complete guide to setting up and running Astra with Julep multi-agent orchestration, OpenRouter LLM, and Bun WebSocket.

---

## Prerequisites

- **Bun runtime** installed (`curl -fsSL https://bun.sh/install | bash`)
- **MongoDB Atlas** account and cluster
- **Julep API key** from [dashboard.julep.ai](https://dashboard.julep.ai)
- **OpenRouter API key** from [openrouter.ai](https://openrouter.ai)
- **Google OAuth credentials** for authentication
- **ElevenLabs API key** (optional, for voice features)

---

## Initial Setup (One-Time)

### 1. Clone and Navigate

```bash
cd /path/to/astra
cd app
```

### 2. Install Dependencies

```bash
bun install
```

This will install all required packages including `@julep/sdk@^2.7.4`.

### 3. Configure Environment Variables

Copy the example file:

```bash
cp .env.example .env
```

Edit `.env` and configure:

```bash
# --- Core database ---
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority&appName=astra
# OR use individual credentials:
MONGODB_USERNAME=your_username
MONGODB_PASSWORD=your_password
MONGODB_CLUSTER=your_cluster.mongodb.net
MONGODB_DB=astra

# --- Better Auth secrets ---
BETTER_AUTH_SECRET=your_generated_secret  # Generate with: openssl rand -hex 32

# --- Google OAuth ---
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google

# --- Julep AI Orchestration ---
JULEP_API_KEY=julep_xxxxxxxxxxxxx  # From dashboard.julep.ai
JULEP_PROJECT=astra
JULEP_ENVIRONMENT=production
ASTRA_AGENT_ID=  # Leave blank, will be filled after sync
BACKGROUND_AGENT_ID=  # Leave blank, will be filled after sync

# --- OpenRouter LLM Provider ---
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx  # From openrouter.ai
OPENROUTER_MODEL=anthropic/claude-sonnet-4.5

# --- ElevenLabs TTS (Optional) ---
ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxx
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

### 4. Create Julep Agents

Run the agent sync script to create agents from YAML definitions:

```bash
bun run sync:agents
```

**Expected Output:**

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

### 5. Update .env with Agent IDs

Copy the agent IDs from the output above and paste them into your `.env` file:

```bash
ASTRA_AGENT_ID=agent_abc123xyz
BACKGROUND_AGENT_ID=agent_def456uvw
```

---

## Running the Application

### Development Mode

```bash
cd app
bun run dev
```

Navigate to: **http://localhost:3000**

### Production Mode

```bash
cd app
bun run build
bun run start
```

---

## Testing the Setup

### 1. Test Authentication

1. Navigate to `http://localhost:3000`
2. Click "Sign in with Google"
3. Complete OAuth flow
4. Check console logs for Julep user sync:
   ```
   Syncing new user to Julep: user@example.com
   Successfully synced user with Julep ID: user_xxxxx
   ```

### 2. Test WebSocket Connection

After signing in, open browser console and run:

```javascript
// Connect to WebSocket
const ws = new WebSocket("ws://localhost:3000/api/responder/socket");

ws.onopen = () => {
  console.log("✓ WebSocket connected!");
  
  // Send a test message
  ws.send(JSON.stringify({
    type: "chat",
    text: "Hello Astra! Tell me about astrology."
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Received:", data);
  
  if (data.type === "message:assistant") {
    console.log("Astra:", data.data.content);
  }
  
  if (data.type === "audio:chunk") {
    console.log("Audio chunk received (base64)");
  }
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};

ws.onclose = () => {
  console.log("WebSocket closed");
};
```

**Expected flow:**
1. `{ type: "connected", data: { userId, sessionId } }`
2. `{ type: "message:user", ... }`
3. `{ type: "message:assistant", ... }` ← Response from Astra (via OpenRouter)
4. `{ type: "audio:chunk", ... }` (if ElevenLabs configured)
5. `{ type: "audio:end" }`

### 3. Verify Agent Configuration

Check that agents are using OpenRouter:

```bash
# In Julep Dashboard (dashboard.julep.ai):
# 1. Navigate to project "astra"
# 2. Go to "Agents"
# 3. Click on "Astra"
# 4. Verify:
#    - Model: openrouter/anthropic/claude-sonnet-4.5
#    - Instructions: Should contain Astra persona
```

---

## Updating Agents

If you need to modify agent configuration:

### 1. Edit YAML Definition

```bash
vim agents/definitions/astra.yaml
```

Make your changes (instructions, model, settings, etc.)

### 2. Re-sync Agents

```bash
cd app
bun run sync:agents
```

The script will **update** existing agents (by name) rather than creating duplicates.

**No need to change `.env`** - agent IDs remain the same.

---

## Troubleshooting

### Issue: "JULEP_API_KEY not set"

**Fix:**
```bash
# Check if .env exists and has the key
cat app/.env | grep JULEP_API_KEY

# If missing, add it:
echo "JULEP_API_KEY=your_key" >> app/.env
```

### Issue: "ASTRA_AGENT_ID not configured"

**Cause:** Agent sync script not run, or .env not updated.

**Fix:**
```bash
cd app
bun run sync:agents
# Copy agent IDs to .env
```

### Issue: WebSocket won't connect

**Check:**
1. Server is running: `bun run dev`
2. You're signed in (auth required)
3. Check browser console for errors
4. Check server logs for errors

**Test connection manually:**
```bash
# In browser console after signing in:
const ws = new WebSocket("ws://localhost:3000/api/responder/socket");
ws.onopen = () => console.log("Connected!");
ws.onerror = (e) => console.error("Error:", e);
```

### Issue: "ws package not found" errors

**Cause:** Old dependencies not cleaned up.

**Fix:**
```bash
cd app
rm -rf node_modules bun.lockb
bun install
```

### Issue: Agent responses are slow or timing out

**Check:**
1. OpenRouter API key is valid
2. Model name is correct: `anthropic/claude-sonnet-4.5`
3. OpenRouter account has credits
4. Check OpenRouter dashboard for rate limits

**Debug:**
```bash
# Check if secret is stored in Julep:
# Go to dashboard.julep.ai → Secrets
# Should see: OPENROUTER_API_KEY
```

### Issue: User not syncing to Julep

**Check MongoDB:**
```javascript
// In MongoDB compass or shell:
db.user.findOne({ email: "your@email.com" })

// Should have fields:
// - julep_user_id: "user_xxxxx"
// - julep_project: "astra"
```

**Manual sync:**
```typescript
// In app/src/lib/auth.ts, the hooks.after.signUp should run
// Check console logs during signup for errors
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes* | Full MongoDB connection string |
| `MONGODB_USERNAME` | Yes* | MongoDB username (if not using URI) |
| `MONGODB_PASSWORD` | Yes* | MongoDB password (if not using URI) |
| `MONGODB_CLUSTER` | Yes* | MongoDB cluster address (if not using URI) |
| `BETTER_AUTH_SECRET` | Yes | Secret for auth sessions (use `openssl rand -hex 32`) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `JULEP_API_KEY` | Yes | Julep API key from dashboard |
| `JULEP_PROJECT` | Yes | Must be "astra" |
| `ASTRA_AGENT_ID` | Yes | Frontline agent ID (from sync script) |
| `BACKGROUND_AGENT_ID` | Yes | Background agent ID (from sync script) |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `OPENROUTER_MODEL` | No | Default: `anthropic/claude-sonnet-4.5` |
| `ELEVENLABS_API_KEY` | No | For voice features |
| `ELEVENLABS_VOICE_ID` | No | Default voice ID |

*Either `MONGODB_URI` OR the individual credentials are required.

---

## Next Steps

After successful setup:

1. **Test conversation flow** - Chat with Astra via WebSocket
2. **Configure background tasks** - Set up horoscope generation (see `agents/tasks/README.md`)
3. **Build frontend UI** - Create chat interface components
4. **Deploy to production** - Vercel, Railway, or your platform of choice

---

## Additional Resources

- [Julep Documentation](https://docs.julep.ai)
- [OpenRouter Models](https://openrouter.ai/models)
- [Agent Management Guide](./AGENT_MANAGEMENT.md)
- [Julep Implementation Guide](./JULEP_IMPLEMENTATION.md)
- [Architecture Overview](./ARCHITECTURE.md)
