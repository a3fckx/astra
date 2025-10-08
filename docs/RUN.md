# Running Astra Locally

The legacy ElevenLabs Python runner has been removed. Follow these steps to run the Next.js gateway and integrate with Julep.

---

## 1. Install Dependencies

```bash
cd app
npm install
```

---

## 2. Configure Environment

Copy the example file and fill in required values:

```bash
cp .env.example .env
```

Required variables:
- `BETTER_AUTH_SECRET`
- `MONGODB_URI` **or** (`MONGODB_USERNAME`, `MONGODB_PASSWORD`, `MONGODB_CLUSTER`)
- `MONGODB_DB` (defaults to `astra`)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- Optional toggles: `GOOGLE_ENABLE_BIRTHDAY_SCOPE`, `GOOGLE_ENABLE_GMAIL_READ_SCOPE`

Keep secrets out of version control.

---

## 3. Run the App

```bash
npm run dev         # http://localhost:3000
```

Use `npm run build && npm run start` for a production build.

---

## 4. Lint / Format

```bash
npm run lint        # Uses Biome for TypeScript + formatting
```

---

## 5. Integrate with Julep

During development you can interact with Julep via scripts or the console:

```python
from julep import Client

client = Client(api_key=os.environ["JULEP_API_KEY"])

user = client.users.create(project="astra", email="demo@astralabs.dev")
client.users.docs.create(
    project="astra",
    user_id=user.id,
    type="profile",
    metadata={"scope": "frontline", "updated_by": "setup", "timestamp_iso": datetime.utcnow().isoformat()},
    content={"name": "Demo User"}
)
```

- Store `JULEP_API_KEY` in `app/.env` (gitignored) and mirror it inside Julep Secrets.
- Background tasks should poll `responder_outbox` and emit events back to `responder_events`.

---

## Troubleshooting

- **Missing env var error:** Check `app/src/lib/env.ts` for required keys.
- **Mongo connection failure:** Ensure your IP is allow-listed or use MongoDB Atlas srv URI.
- **Google OAuth redirect mismatch:** Update the OAuth client with `http://localhost:3000/api/auth/callback/google`.
- **WebSocket disconnects:** Verify the responder worker is publishing events and that `MONGODB_URI` permits change streams.
