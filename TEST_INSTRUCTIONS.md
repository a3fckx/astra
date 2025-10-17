# 🧪 Testing Instructions

## Current State ✅

**What's Ready:**
- ✅ Background processing code fixed (credentials included)
- ✅ Chart calculation task ready
- ✅ Agent prompt updated (18,179 chars)
- ✅ Famous people integration
- ✅ Incident map working

**What's Missing:**
- ❌ Birth time (need to mention in conversation)
- ❌ Processed conversations (old code still running in browser)

---

## 🔄 Step 1: Refresh to Get New Code

**Your browser is still running OLD code without the auth fix!**

1. **Hard refresh the app:** `Cmd+Shift+R` (Mac) or `Ctrl+Shift+F5` (Windows)
2. **Or restart dev server:**
   ```bash
   cd app
   # Stop current server (Ctrl+C)
   bun run dev
   ```

3. **Verify in browser console:**
   Open dev tools and look for this when you start a conversation:
   ```
   [ElevenLabs] Session configuration: {
     hasPromptOverride: true,
     promptLength: 18179,
     ...
   }
   ```

---

## 🎤 Step 2: Have a Test Conversation

**Test the complete flow:**

1. **Start conversation**
2. **Say something like:**
   ```
   "I was born around 7 AM in the morning"
   ```
3. **End conversation by saying:**
   ```
   "Let's close this conversation"
   ```

**Watch browser console for:**
```
[ElevenLabs] Triggering background transcript processing conv_xxxxx
[ElevenLabs] Transcript processing triggered successfully  ✅
```

If you see "401 Unauthorized" instead, the refresh didn't work.

---

## 🔍 Step 3: Verify Processing Worked

**Wait 30 seconds**, then check MongoDB:

```bash
cd app
bun run --bun node -e "
const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://astra_dev:2KxftjyhbNzM0edN@astra.ethgite.mongodb.net/?retryWrites=true&w=majority&appName=astra';

async function check() {
  const client = new MongoClient(uri);
  await client.connect();
  
  const db = client.db('astra');
  const user = await db.collection('user').findOne({ id: '68ea36edd789ed3a1e501236' });
  
  console.log('Last Updated:', user.user_overview?.last_updated);
  console.log('Birth Time:', user.birth_time || 'Still missing');
  console.log('Has Chart:', !!user.user_overview?.birth_chart ? 'YES! 🎉' : 'Not yet');
  
  const latestConv = await db.collection('elevenlabs_conversations')
    .findOne({ user_id: user.id }, { sort: { updated_at: -1 } });
  
  console.log('\nLatest Conversation:');
  console.log('  ID:', latestConv?.conversation_id);
  console.log('  Processed:', latestConv?.processed ? '✅ YES!' : '❌ No');
  
  await client.close();
}

check();
"
```

**Expected output:**
```
Last Updated: 2025-10-17T15:30:XX (RECENT TIME)
Birth Time: 07:00  ✅
Has Chart: YES! 🎉
Latest Conversation:
  ID: conv_xxxxx
  Processed: ✅ YES!
```

---

## 🎉 Step 4: Test Chart in Next Conversation

**If Step 3 shows chart exists:**

1. **Start new conversation**
2. **Ask about career:**
   ```
   "What does my chart say about my career?"
   ```

**Agent should respond with:**
- References to planetary positions ("Mars in your 10th house...")
- Famous people mention ("Steve Wozniak shares your birthday...")
- Specific chart insights

---

## 🐛 Troubleshooting

### Issue: Still getting 401 errors

**Solution:** Hard refresh didn't work
```bash
# Clear browser cache completely
# Or use incognito/private window
# Or restart dev server and browser
```

### Issue: Birth time not extracted

**Check if you said it clearly:**
- ✅ "I was born around 7 AM"
- ✅ "My birth time is 7 in the morning"
- ❌ "seven" (needs to be clear)

**Wait for transcript processing, then check MongoDB**

### Issue: Chart not calculating

**Check trigger conditions:**
```bash
bun run --bun node -e "
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
client.connect().then(async () => {
  const user = await client.db('astra').collection('user')
    .findOne({id: '68ea36edd789ed3a1e501236'});
  
  console.log('Birth date:', !!user.date_of_birth ? '✅' : '❌');
  console.log('Birth time:', !!user.birth_time ? '✅' : '❌');
  console.log('Birth place:', !!user.birth_location ? '✅' : '❌');
  console.log('Chart exists:', !!user.user_overview?.birth_chart ? '✅' : '❌');
  
  if (user.date_of_birth && user.birth_time && user.birth_location && !user.user_overview?.birth_chart) {
    console.log('\n🎯 All conditions met - chart should calculate!');
  } else {
    console.log('\n⚠️  Missing:', [
      !user.date_of_birth && 'date',
      !user.birth_time && 'time',
      !user.birth_location && 'place',
      user.user_overview?.birth_chart && 'already exists'
    ].filter(Boolean).join(', '));
  }
  
  await client.close();
});
"
```

---

## ✅ Success Checklist

- [ ] Hard refreshed browser / restarted dev server
- [ ] Saw "Session configuration" log with promptLength: 18179
- [ ] Had conversation mentioning birth time
- [ ] Saw "Transcript processing triggered successfully"
- [ ] Waited 30 seconds
- [ ] MongoDB shows last_updated is recent
- [ ] MongoDB shows birth_time exists
- [ ] MongoDB shows processed: true for latest conversation
- [ ] MongoDB shows birth_chart exists with famous_people
- [ ] Next conversation references chart and famous people

---

**Current Blocker:** Browser running old code without auth fix

**Next Action:** Hard refresh or restart dev server, then test!
