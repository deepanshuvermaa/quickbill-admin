const fetch = require('node-fetch');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function testSubscriptionVerify() {
  const emails = [
    'girjeshverma24@gmail.com',
    'deepanshuverma966@gmail.com',
    'nonexistent@gmail.com'
  ];

  console.log('🔍 Testing subscription verification endpoint...\n');

  for (const email of emails) {
    try {
      console.log(`📧 Checking: ${email}`);
      
      const response = await fetch(`${BASE_URL}/api/subscription-verify/verify/${email}`);
      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ ${data.message}`);
        console.log(`   User: ${data.user.name}`);
        console.log(`   Plan: ${data.subscription.plan}`);
        console.log(`   Status: ${data.subscription.status}`);
        console.log(`   Days Remaining: ${data.subscription.daysRemaining}`);
      } else {
        console.log(`❌ ${data.message}`);
      }
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error checking ${email}:`, error.message);
      console.log('');
    }
  }
}

testSubscriptionVerify();