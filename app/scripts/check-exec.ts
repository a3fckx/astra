import { julepClient } from '@/lib/julep-client';
const execution = await julepClient.getExecution('068faabd-d900-7a42-8000-57897a60cb1e');
console.log('Error:', execution.error);
console.log('Output:', execution.output);
process.exit(0);
