const { Client } = require('pg');
require('dotenv').config();

async function runSubscriptionFix() {
  // Use the public database URL for Railway
  const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ No database connection string found!');
    console.log('Please set DATABASE_PUBLIC_URL in your .env file');
    console.log('You can find this in your Railway project settings');
    return;
  }

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully');

    // Fix subscriptions that should be active
    console.log('\n📝 Fixing subscriptions that should be active...');
    const activeResult = await client.query(`
      UPDATE user_subscriptions 
      SET status = 'active', updated_at = NOW() 
      WHERE end_date > NOW() AND status NOT IN ('active', 'trial')
    `);
    console.log(`✅ Fixed ${activeResult.rowCount} subscriptions to active status`);

    // Fix subscriptions that should be expired
    console.log('\n📝 Fixing subscriptions that should be expired...');
    const expiredResult = await client.query(`
      UPDATE user_subscriptions 
      SET status = 'expired', updated_at = NOW() 
      WHERE end_date <= NOW() AND status IN ('active', 'trial')
    `);
    console.log(`✅ Fixed ${expiredResult.rowCount} subscriptions to expired status`);

    // Show current status summary
    console.log('\n📊 Current subscription status summary:');
    const summaryResult = await client.query(`
      SELECT 
        status,
        COUNT(*) as count,
        COUNT(CASE WHEN end_date > NOW() THEN 1 END) as should_be_active,
        COUNT(CASE WHEN end_date <= NOW() THEN 1 END) as should_be_expired
      FROM user_subscriptions
      GROUP BY status
      ORDER BY status
    `);
    
    console.table(summaryResult.rows);

    // Show active platinum subscriptions
    console.log('\n💎 Active Platinum Subscriptions:');
    const platinumResult = await client.query(`
      SELECT 
        u.name,
        u.email,
        us.plan,
        us.status,
        us.end_date,
        us.end_date > NOW() as is_valid
      FROM user_subscriptions us
      JOIN users u ON us.user_id = u.id
      WHERE us.plan LIKE '%platinum%'
        AND us.end_date > NOW()
      ORDER BY us.end_date DESC
      LIMIT 10
    `);
    
    if (platinumResult.rows.length > 0) {
      console.table(platinumResult.rows);
    } else {
      console.log('No active platinum subscriptions found');
    }

    console.log('\n✅ All subscription statuses have been fixed!');
    console.log('Users should now see their correct subscription status in the app.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('connect')) {
      console.log('\nTroubleshooting tips:');
      console.log('1. Make sure DATABASE_PUBLIC_URL is set in your .env file');
      console.log('2. Get the public URL from Railway dashboard > Database > Connect tab');
      console.log('3. The URL should look like: postgresql://postgres:xxxxx@viaduct.proxy.rlwy.net:xxxxx/railway');
    }
  } finally {
    await client.end();
    console.log('\n🔒 Database connection closed');
  }
}

// Run the fix
runSubscriptionFix().catch(console.error);