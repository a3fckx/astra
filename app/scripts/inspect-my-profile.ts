import { getUsers } from '@/lib/mongo';

const users = getUsers();
const user = await users.findOne({ id: '68ea36edd789ed3a1e501236' });

console.log('===========================================');
console.log('       SHUBHAM ATTRI - USER PROFILE');
console.log('===========================================\n');

console.log('📋 BASIC INFO:');
console.log('Name:', user?.name);
console.log('Email:', user?.email);
console.log('Birth Date:', user?.date_of_birth?.toISOString().split('T')[0]);
console.log('Birth Time:', user?.birth_time);
console.log('Birth Location:', user?.birth_location);
console.log('Birth Timezone:', user?.birth_timezone);

console.log('\n===========================================');
console.log('       USER OVERVIEW (AI-GENERATED)');
console.log('===========================================\n');

const overview = user?.user_overview;

if (overview) {
  console.log('📝 PROFILE SUMMARY:');
  console.log(overview.profile_summary || 'Not yet generated');
  
  console.log('\n💬 PREFERENCES:');
  console.log('Communication Style:', overview.preferences?.communication_style || 'Not set');
  console.log('Hinglish Level:', overview.preferences?.hinglish_level ?? 'Not set');
  console.log('Astrology System:', overview.preferences?.astrology_system || 'Not set');
  console.log('Topics of Interest:', overview.preferences?.topics_of_interest?.slice(0, 10).join(', ') || 'None');
  
  console.log('\n💡 RECENT INSIGHTS:');
  if (overview.insights && overview.insights.length > 0) {
    overview.insights.slice(-3).forEach((insight: any, idx: number) => {
      console.log(`${idx + 1}. [${insight.type}] ${insight.content}`);
    });
  } else {
    console.log('No insights yet');
  }
  
  console.log('\n🎯 INCIDENT MAP (Creative Sparks & Key Moments):');
  if (overview.incident_map && overview.incident_map.length > 0) {
    overview.incident_map.slice(-5).forEach((incident: any, idx: number) => {
      console.log(`\n${idx + 1}. ${incident.title || 'Untitled'}`);
      console.log(`   ${incident.description}`);
      console.log(`   Tags: ${incident.tags?.join(', ') || 'None'}`);
    });
  } else {
    console.log('No incidents tracked yet');
  }
  
  console.log('\n📊 RECENT CONVERSATIONS:');
  if (overview.recent_conversations && overview.recent_conversations.length > 0) {
    console.log(`Total: ${overview.recent_conversations.length} conversations tracked`);
    overview.recent_conversations.slice(-3).forEach((conv: any, idx: number) => {
      console.log(`\n${idx + 1}. ${conv.date}`);
      console.log(`   Summary: ${conv.summary?.substring(0, 150)}...`);
      console.log(`   Topics: ${conv.topics?.join(', ') || 'None'}`);
      console.log(`   Tone: ${conv.emotional_tone || 'Not analyzed'}`);
    });
  } else {
    console.log('No conversations yet');
  }
  
  console.log('\n🎮 GAMIFICATION:');
  console.log('Streak Days:', overview.gamification?.streak_days ?? 0);
  console.log('Total Conversations:', overview.gamification?.total_conversations ?? 0);
  console.log('Level:', overview.gamification?.level ?? 1);
  
  console.log('\n🌟 BIRTH CHART STATUS:');
  if (overview.birth_chart) {
    console.log('✅ Chart Calculated');
    console.log('System:', overview.birth_chart.system);
    console.log('Calculated At:', overview.birth_chart.calculated_at);
  } else {
    console.log('❌ Not yet calculated');
  }
  
  console.log('\n⏰ LAST UPDATED:');
  console.log(overview.last_updated || 'Never');
}

process.exit(0);
