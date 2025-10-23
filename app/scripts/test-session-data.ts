import { getUsers } from '@/lib/mongo';

const users = getUsers();
const user = await users.findOne({ id: '68ea36edd789ed3a1e501236' });

if (!user) {
  console.log('User not found');
  process.exit(1);
}

const overview = user.user_overview || {};

console.log('===========================================');
console.log('  DATA SENT TO ELEVENLABS IN NEXT SESSION');
console.log('===========================================\n');

console.log('✅ BASIC USER DATA:');
console.log('├─ user_name:', user.name);
console.log('├─ date_of_birth:', user.date_of_birth?.toISOString().split('T')[0]);
console.log('├─ birth_time:', user.birth_time);
console.log('└─ birth_place:', user.birth_location);

console.log('\n✅ CHART STATUS:');
const hasVedic = !!overview.birth_chart?.vedic;
const hasWestern = !!overview.birth_chart?.western;
console.log('├─ has_birth_chart:', hasVedic || hasWestern);
console.log('├─ has_vedic_chart:', hasVedic);
console.log('├─ has_western_chart:', hasWestern);
console.log('├─ chart_status:', (hasVedic && hasWestern) ? 'ready' : 'pending');
console.log('├─ vedic_sun:', overview.birth_chart?.vedic?.sun_sign || null);
console.log('├─ vedic_moon:', overview.birth_chart?.vedic?.moon_sign || null);
console.log('├─ vedic_ascendant:', overview.birth_chart?.vedic?.ascendant || null);
console.log('├─ western_sun:', overview.birth_chart?.western?.sun_sign || null);
console.log('├─ western_moon:', overview.birth_chart?.western?.moon_sign || null);
console.log('└─ western_rising:', overview.birth_chart?.western?.rising_sign || null);

console.log('\n✅ FAMOUS PEOPLE:');
console.log('├─ has_famous_people:', !!(overview.birth_chart?.famous_people?.length));
console.log('└─ famous_people_count:', overview.birth_chart?.famous_people?.length || 0);

console.log('\n✅ PREFERENCES:');
console.log('├─ hinglish_level:', overview.preferences?.hinglish_level ?? null);
console.log('├─ flirt_opt_in:', overview.preferences?.flirt_opt_in ?? false);
console.log('├─ communication_style:', overview.preferences?.communication_style || null);
console.log('└─ astrology_system:', overview.preferences?.astrology_system || null);

console.log('\n✅ GAMIFICATION:');
console.log('├─ streak_days:', overview.gamification?.streak_days ?? 0);
console.log('├─ total_conversations:', overview.gamification?.total_conversations ?? 0);
console.log('└─ level:', overview.gamification?.level ?? 1);

console.log('\n✅ PROFILE & CONTEXT:');
console.log('├─ profile_summary:', overview.profile_summary ? 'Yes (detailed)' : 'No');
console.log('├─ recent_conversations:', overview.recent_conversations?.length || 0, 'stored');
console.log('├─ incident_map:', overview.incident_map?.length || 0, 'incidents');
console.log('└─ insights:', overview.insights?.length || 0, 'insights');

console.log('\n✅ COMPLETE user_overview JSON:');
console.log('All data above is embedded in a single JSON string');
console.log('Agent can access ANY field from your profile');
console.log('Size:', JSON.stringify(overview).length, 'characters');

console.log('\n✅ FIRST MESSAGE:');
console.log(overview.first_message || 'Using default greeting');

console.log('\n===========================================');
console.log('🚀 READY FOR CONVERSATION!');
console.log('===========================================\n');
console.log('When you start your next voice session:');
console.log('1. All this data is sent to ElevenLabs agent');
console.log('2. Agent knows your birth chart, preferences, history');
console.log('3. Agent can reference past conversations and incidents');
console.log('4. Agent knows you\'re interested in: intelligence, memory, learning');
console.log('5. Agent knows your projects: background agents, moonshot');
console.log('\nStart a conversation now to test!');

process.exit(0);
