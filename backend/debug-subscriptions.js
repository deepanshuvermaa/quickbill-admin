const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function debugSubscriptions() {
  const client = await pool.connect();
  
  try {
    console.log('=== SUBSCRIPTION DEBUG REPORT ===\n');
    
    // 1. Check all active subscriptions
    console.log('1. ACTIVE SUBSCRIPTIONS:');
    const activeSubsQuery = `
      SELECT 
        us.id,
        us.user_id,
        u.email,
        u.name,
        us.plan,
        us.status,
        us.start_date,
        us.end_date,
        us.is_trial,
        us.grace_period_end,
        CASE 
          WHEN us.end_date > NOW() THEN 'Not Expired'
          ELSE 'Expired'
        END as expiry_status,
        EXTRACT(DAY FROM us.end_date - NOW()) as days_remaining
      FROM user_subscriptions us
      JOIN users u ON us.user_id = u.id
      WHERE us.status = 'active'
      ORDER BY us.created_at DESC
    `;
    
    const activeSubs = await client.query(activeSubsQuery);
    console.table(activeSubs.rows);
    
    // 2. Check subscriptions that should be active (end_date > now) but have wrong status
    console.log('\n2. SUBSCRIPTIONS WITH MISMATCHED STATUS:');
    const mismatchedQuery = `
      SELECT 
        us.id,
        us.user_id,
        u.email,
        us.plan,
        us.status,
        us.end_date,
        CASE 
          WHEN us.end_date > NOW() THEN 'Should be ACTIVE'
          ELSE 'Should be EXPIRED'
        END as expected_status
      FROM user_subscriptions us
      JOIN users u ON us.user_id = u.id
      WHERE (us.end_date > NOW() AND us.status != 'active')
         OR (us.end_date <= NOW() AND us.status = 'active')
    `;
    
    const mismatched = await client.query(mismatchedQuery);
    if (mismatched.rows.length > 0) {
      console.table(mismatched.rows);
    } else {
      console.log('No mismatched statuses found.');
    }
    
    // 3. Check platinum subscriptions specifically
    console.log('\n3. ALL PLATINUM SUBSCRIPTIONS:');
    const platinumQuery = `
      SELECT 
        us.id,
        us.user_id,
        u.email,
        u.name,
        us.plan,
        us.status,
        us.start_date,
        us.end_date,
        us.is_trial,
        EXTRACT(DAY FROM us.end_date - NOW()) as days_remaining,
        us.created_at,
        us.updated_at
      FROM user_subscriptions us
      JOIN users u ON us.user_id = u.id
      WHERE us.plan = 'platinum' OR us.plan LIKE 'platinum%'
      ORDER BY us.created_at DESC
    `;
    
    const platinumSubs = await client.query(platinumQuery);
    console.table(platinumSubs.rows);
    
    // 4. Check the exact SQL query used in login endpoint
    console.log('\n4. LOGIN ENDPOINT QUERY SIMULATION:');
    console.log('Testing query that would run for each platinum user...\n');
    
    for (const sub of platinumSubs.rows.slice(0, 3)) { // Test first 3 platinum users
      const loginQuery = `
        SELECT id, plan, status, start_date, end_date, grace_period_end, is_trial
        FROM user_subscriptions 
        WHERE user_id = $1 AND status IN ('active', 'expired')
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      const result = await client.query(loginQuery, [sub.user_id]);
      console.log(`User ${sub.email} (ID: ${sub.user_id}):`);
      if (result.rows.length > 0) {
        console.log('  Found subscription:', result.rows[0]);
      } else {
        console.log('  NO SUBSCRIPTION FOUND BY LOGIN QUERY!');
      }
    }
    
    // 5. Check timezone and server time
    console.log('\n5. TIMEZONE AND SERVER TIME:');
    const timeQuery = `
      SELECT 
        NOW() as server_time,
        NOW() AT TIME ZONE 'UTC' as utc_time,
        NOW() AT TIME ZONE 'Asia/Kolkata' as india_time,
        current_setting('TIMEZONE') as db_timezone
    `;
    
    const timeResult = await client.query(timeQuery);
    console.table(timeResult.rows);
    
    // 6. Check if there are duplicate subscriptions
    console.log('\n6. USERS WITH MULTIPLE SUBSCRIPTIONS:');
    const duplicatesQuery = `
      SELECT 
        u.email,
        u.id as user_id,
        COUNT(*) as subscription_count,
        array_agg(us.plan || ' (' || us.status || ')' ORDER BY us.created_at DESC) as subscriptions
      FROM users u
      JOIN user_subscriptions us ON u.id = us.user_id
      GROUP BY u.id, u.email
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `;
    
    const duplicates = await client.query(duplicatesQuery);
    if (duplicates.rows.length > 0) {
      console.table(duplicates.rows);
    } else {
      console.log('No users with multiple subscriptions found.');
    }
    
    // 7. Fix suggestions
    console.log('\n7. SUGGESTED FIXES:');
    console.log('To fix subscriptions with wrong status, run:');
    console.log(`
UPDATE user_subscriptions 
SET status = 'active', updated_at = NOW() 
WHERE end_date > NOW() AND status != 'active';

UPDATE user_subscriptions 
SET status = 'expired', updated_at = NOW() 
WHERE end_date <= NOW() AND status = 'active';
    `);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

debugSubscriptions();