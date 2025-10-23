import { getUsers } from '@/lib/mongo';

const users = getUsers();
const user = await users.findOne({ id: '68ea36edd789ed3a1e501236' });

const chart = user?.user_overview?.birth_chart;

console.log('===========================================');
console.log('   SHUBHAM ATTRI - ASTROLOGICAL CHART');
console.log('===========================================\n');

console.log('🎂 Birth Details:');
console.log('Date: August 14, 2002');
console.log('Time: 07:15 AM');
console.log('Place: Jhajjar, Haryana, India');
console.log('Timezone: Asia/Kolkata (IST)');
console.log('\n-------------------------------------------\n');

if (!chart) {
  console.log('❌ Chart not yet calculated');
  process.exit(0);
}

console.log('🕉️  VEDIC CHART (Sidereal Zodiac)');
console.log('===========================================\n');

if (chart.vedic) {
  console.log('☀️  Sun Sign:', chart.vedic.sun_sign);
  console.log('🌙 Moon Sign:', chart.vedic.moon_sign);
  console.log('⬆️  Ascendant (Lagna):', chart.vedic.ascendant);
  
  if (chart.vedic.dasha) {
    console.log('\n🔄 Current Dasha Period:');
    console.log('Mahadasha:', chart.vedic.dasha.current_mahadasha);
    console.log('Antardasha:', chart.vedic.dasha.current_antardasha);
    console.log('Start Date:', chart.vedic.dasha.start_date);
  }
  
  console.log('\n🪐 Planetary Positions:');
  if (chart.vedic.planets && chart.vedic.planets.length > 0) {
    chart.vedic.planets.forEach((planet: any) => {
      console.log(`\n${planet.name}:`);
      console.log(`  Sign: ${planet.sign}`);
      console.log(`  House: ${planet.house}`);
      console.log(`  Degree: ${planet.degree}`);
      if (planet.nakshatra) console.log(`  Nakshatra: ${planet.nakshatra}`);
      if (planet.retrograde) console.log(`  ⚠️  RETROGRADE`);
    });
  }
  
  console.log('\n📖 Vedic Chart Summary:');
  console.log(chart.vedic.chart_summary || 'Not available');
}

console.log('\n\n♈ WESTERN CHART (Tropical Zodiac)');
console.log('===========================================\n');

if (chart.western) {
  console.log('☀️  Sun Sign:', chart.western.sun_sign);
  console.log('🌙 Moon Sign:', chart.western.moon_sign);
  console.log('⬆️  Rising Sign:', chart.western.rising_sign);
  
  console.log('\n🪐 Planetary Positions:');
  if (chart.western.planets && chart.western.planets.length > 0) {
    chart.western.planets.forEach((planet: any) => {
      console.log(`\n${planet.name}:`);
      console.log(`  Sign: ${planet.sign}`);
      console.log(`  House: ${planet.house}`);
      console.log(`  Degree: ${planet.degree}`);
      if (planet.retrograde) console.log(`  ⚠️  RETROGRADE`);
    });
  }
  
  console.log('\n🔗 Major Aspects:');
  if (chart.western.aspects && chart.western.aspects.length > 0) {
    chart.western.aspects.forEach((aspect: any) => {
      console.log(`${aspect.planets?.join(' ')} - ${aspect.type} (orb: ${aspect.orb})`);
    });
  }
  
  console.log('\n📖 Western Chart Summary:');
  console.log(chart.western.chart_summary || 'Not available');
}

console.log('\n\n⭐ FAMOUS PEOPLE BORN ON YOUR DATE');
console.log('===========================================\n');

if (chart.famous_people && chart.famous_people.length > 0) {
  chart.famous_people.forEach((person: any, idx: number) => {
    console.log(`${idx + 1}. ${person.name} (${person.birth_year})`);
    console.log(`   ${person.category}: ${person.known_for}`);
    console.log('');
  });
} else {
  console.log('No famous people data available');
}

console.log('\n-------------------------------------------');
console.log(`Chart calculated at: ${chart.calculated_at}`);
console.log('===========================================\n');

process.exit(0);
