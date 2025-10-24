import { getUsers } from '@/lib/mongo';

const users = getUsers();
const user = await users.findOne({ id: '68ea36edd789ed3a1e501236' });

console.log('=== Birth Chart Status ===');
console.log('Has chart:', !!user?.user_overview?.birth_chart);

if (user?.user_overview?.birth_chart) {
  const chart = user.user_overview.birth_chart;
  console.log('\n=== Famous People ===');
  if (chart.famous_people && chart.famous_people.length > 0) {
    chart.famous_people.forEach((person, idx) => {
      console.log(`\n${idx + 1}. ${person.name} (${person.birth_year})`);
      console.log(`   Category: ${person.category}`);
      console.log(`   Known for: ${person.known_for}`);
      if (person.origin) console.log(`   Origin: ${person.origin}`);
    });
  } else {
    console.log('No famous people data yet');
  }
}

process.exit(0);
