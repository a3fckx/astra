import { julepClient } from '@/lib/julep-client';

const executionId = '068faaba-9997-7c32-8000-a0ffeecd4ad6';

const execution = await julepClient.getExecution(executionId);

console.log('Execution Status:', execution.status);
console.log('\nError:', execution.error);
console.log('\nOutput:', JSON.stringify(execution.output, null, 2));

process.exit(0);
