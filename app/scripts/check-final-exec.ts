import { julepClient } from '@/lib/julep-client';
const execution = await julepClient.getExecution('068faad1-fdc9-7c0e-8000-49bc5aaa244d');
console.log('Status:', execution.status);
console.log('Output:', execution.output);
process.exit(0);
