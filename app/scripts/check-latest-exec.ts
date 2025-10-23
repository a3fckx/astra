import { julepClient } from '@/lib/julep-client';
const execution = await julepClient.getExecution('068faacb-c86e-781e-8000-b76de495bb14');
console.log('Status:', execution.status);
console.log('Output:', execution.output);
process.exit(0);
