import { julepClient } from '@/lib/julep-client';
const execution = await julepClient.getExecution('068faac5-574c-72bb-8000-fa6b1afc60b3');
console.log('Output:', execution.output);
process.exit(0);
