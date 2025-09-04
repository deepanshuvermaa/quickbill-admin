const { Client } = require('pg');
require('dotenv').config();

async function checkUserSubscriptions() {
  const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    
    // Check Girjesh and Deepanshu subscriptions
    console.log('\n📋 Checking subscriptions for Girjesh and Deepanshu...\n');
    
    const result = await client.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        us.id as subscription_id,
        us.plan,
        us.status,
        us.start_date,
        us.end_date,
        us.is_trial,
        us.created_at as subscription_created,
        us.updated_at as subscription_updated,
        us.end_date > NOW() as should_be_active,
        EXTRACT(DAY FROM us.end_date - NOW()) as days_remaining
      FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id
      WHERE u.name ILIKE '%girjesh%' OR u.name ILIKE '%deepanshu%'
      ORDER BY u.id, us.created_at DESC
    `);
    
    if (result.rows.length > 0) {
      console.table(result.rows);
      
      // Check for issues
      console.log('\n⚠️  Potential Issues:');
      
      result.rows.forEach(row => {
        if (row.subscription_id) {
          console.log(`\n👤 ${row.name} (${row.email}):`);
          
          // Check status mismatch
          if (row.should_be_active && row.status !== 'active') {
            console.log(`   ❌ Status mismatch: status is '${row.status}' but end_date > NOW()`);
          }
          
          // Check plan format
          if (row.plan.includes('_')) {
            console.log(`   ⚠️  Plan has underscore: '${row.plan}' (app might expect '${row.plan.split('_')[0]}')`);
          }
          
          // Check if recently updated
          const updatedTime = new Date(row.subscription_updated);
          const minutesAgo = (Date.now() - updatedTime) / 1000 / 60;
          console.log(`   🕒 Last updated: ${minutesAgo.toFixed(0)} minutes ago`);
          
          // Check multiple subscriptions
          const userSubs = result.rows.filter(r => r.id === row.id && r.subscription_id);
          if (userSubs.length > 1) {
            console.log(`   ⚠️  User has ${userSubs.length} subscriptions (might be selecting wrong one)`);
          }
        } else {
          console.log(`\n👤 ${row.name}: ❌ No subscription found`);
        }
      });
    }
    
    // Check what login endpoint would return
    console.log('\n\n🔍 Testing login query for these users...\n');
    
    const users = [...new Set(result.rows.map(r => r.id))];
    
    for (const userId of users) {
      const loginQuery = await client.query(`
        SELECT id, plan, status, start_date, end_date, grace_period_end, is_trial
        FROM user_subscriptions 
        WHERE user_id = $1 
        AND (status IN ('active', 'expired', 'trial', 'grace_period') OR end_date > NOW())
        ORDER BY end_date DESC
        LIMIT 1
      `, [userId]);
      
      const user = result.rows.find(r => r.id === userId);
      console.log(`\n👤 ${user.name}:`);
      
      if (loginQuery.rows.length > 0) {
        console.log('   ✅ Login query returns subscription:');
        console.table(loginQuery.rows);
      } else {
        console.log('   ❌ Login query returns NO subscription');
      }
    }
    
    // Show exact SQL to fix
    console.log('\n\n🔧 SQL to fix any issues:\n');
    console.log(`-- Fix status for active subscriptions`);
    console.log(`UPDATE user_subscriptions SET status = 'active' WHERE end_date > NOW() AND status != 'active';`);
    console.log(`\n-- Remove underscores from plan names`);
    console.log(`UPDATE user_subscriptions SET plan = REPLACE(plan, '_monthly', '') WHERE plan LIKE '%_monthly';`);
    console.log(`UPDATE user_subscriptions SET plan = REPLACE(plan, '_quarterly', '') WHERE plan LIKE '%_quarterly';`);
    console.log(`UPDATE user_subscriptions SET plan = REPLACE(plan, '_yearly', '') WHERE plan LIKE '%_yearly';`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n🔒 Database connection closed');
  }
}

checkUserSubscriptions();