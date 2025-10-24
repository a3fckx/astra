import { getUsers } from '@/lib/mongo';

const users = getUsers();
const user = await users.findOne({ id: '68ea36edd789ed3a1e501236' });

console.log('=== Birth Data Status ===');
console.log('Date of Birth:', user?.date_of_birth);
console.log('Birth Time:', user?.birth_time);
console.log('Birth Location:', user?.birth_location);
console.log('Birth Timezone:', user?.birth_timezone);
console.log('\n=== Chart Status ===');
console.log('Has Birth Chart:', !!user?.user_overview?.birth_chart);
console.log('\nAll required data present:', !!(user?.date_of_birth && user?.birth_time && user?.birth_location));

process.exit(0);
