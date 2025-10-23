import { getBackgroundWorkerAgentId, julepClient } from '@/lib/julep-client';
import { loadTaskDefinition } from '@/lib/tasks/loader';
import { getUsers } from '@/lib/mongo';

const users = getUsers();
const user = await users.findOne({ id: '68ea36edd789ed3a1e501236' });

if (!user) {
  console.error('User not found');
  process.exit(1);
}

console.log('Birth Data:');
console.log('  Date:', user.date_of_birth?.toISOString().split('T')[0]);
console.log('  Time:', user.birth_time);
console.log('  Location:', user.birth_location);
console.log('  Timezone:', user.birth_timezone);
console.log('\nTriggering chart calculation...\n');

const taskDef = loadTaskDefinition('CHART_CALCULATOR');
const agentId = getBackgroundWorkerAgentId();

const result = await julepClient.createAndExecuteTask(
  agentId,
  taskDef,
  {
    birth_date: user.date_of_birth?.toISOString().split('T')[0],
    birth_time: user.birth_time,
    birth_location: user.birth_location,
    birth_timezone: user.birth_timezone || 'UTC',
    ayanamsha: 'lahiri',
  },
  {
    maxAttempts: 60,
    intervalMs: 2000,
    onProgress: (status, attempt) => {
      console.log(`[${attempt}] Status: ${status}`);
    },
  }
);

console.log('\nResult:', result.status);
if (result.status === 'succeeded') {
  console.log('Chart data:', JSON.stringify(result.output, null, 2));
  
  // Update MongoDB
  await users.updateOne(
    { id: user.id },
    {
      $set: {
        'user_overview.birth_chart': result.output.birth_chart,
        'user_overview.last_updated': new Date(),
      },
    }
  );
  console.log('\n✅ Chart saved to MongoDB!');
} else {
  console.error('Error:', result.error);
}

process.exit(0);
