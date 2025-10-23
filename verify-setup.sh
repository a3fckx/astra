#!/bin/bash
set -e

echo "🔍 Verifying Astra Setup"
echo "========================"
echo ""

cd app

echo "1️⃣ Checking environment variables..."
if grep -q "BACKGROUND_WORKER_AGENT_ID=" .env; then
  echo "   ✅ BACKGROUND_WORKER_AGENT_ID is set"
else
  echo "   ❌ BACKGROUND_WORKER_AGENT_ID is missing"
  exit 1
fi

if grep -q "JULEP_API_KEY=" .env; then
  echo "   ✅ JULEP_API_KEY is set"
else
  echo "   ❌ JULEP_API_KEY is missing"
  exit 1
fi

echo ""
echo "2️⃣ Running linter..."
bun run lint > /dev/null 2>&1
echo "   ✅ Linter passed"

echo ""
echo "3️⃣ Checking user sync status..."
USER_COUNT=$(bun --eval "import { getUsers } from './src/lib/mongo'; const users = await getUsers().countDocuments({}); console.log(users); process.exit(0);" 2>/dev/null)
SYNCED_COUNT=$(bun --eval "import { getUsers } from './src/lib/mongo'; const users = await getUsers().countDocuments({ julep_user_id: { \$exists: true } }); console.log(users); process.exit(0);" 2>/dev/null)

echo "   Total users: $USER_COUNT"
echo "   Synced to Julep: $SYNCED_COUNT"

if [ "$USER_COUNT" -eq "$SYNCED_COUNT" ]; then
  echo "   ✅ All users synced"
else
  echo "   ⚠️  $(($USER_COUNT - $SYNCED_COUNT)) users need syncing"
  echo "   Run: bun run scripts/sync-existing-users.ts"
fi

echo ""
echo "4️⃣ Testing session creation..."
bun --eval "
import { getUsers } from './src/lib/mongo';
import { julepEnv } from './src/lib/julep';
import { getOrCreateJulepSession } from './src/lib/julep-docs';

const users = getUsers();
const user = await users.findOne({});

if (user?.julep_user_id && julepEnv.backgroundWorkerAgentId) {
  const sessionId = await getOrCreateJulepSession(user.julep_user_id);
  console.log('   ✅ Session created:', sessionId.substring(0, 20) + '...');
} else {
  console.log('   ❌ Cannot create session - missing requirements');
  process.exit(1);
}
process.exit(0);
" 2>&1 | grep -E "✅|❌"

echo ""
echo "========================"
echo "✨ Setup verification complete!"
echo ""
echo "Next steps:"
echo "  • Run: bun run dev"
echo "  • Test voice session at: http://localhost:3000"
