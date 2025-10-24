import { julepClient } from '@/lib/julep-client';
const execution = await julepClient.getExecution('068faac2-1f18-75c5-8000-1a3f4fbf438b');
console.log('Status:', execution.status);
console.log('Error:', execution.error);
console.log('Output:', typeof execution.output === 'string' ? execution.output.substring(0, 500) : JSON.stringify(execution.output, null, 2));
process.exit(0);
