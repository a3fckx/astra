import { julepClient } from '@/lib/julep-client';
const execution = await julepClient.getExecution('068faad4-9609-703b-8000-cafed0f13895');
console.log('Output:', typeof execution.output === 'string' ? execution.output : JSON.stringify(execution.output, null, 2));
process.exit(0);
