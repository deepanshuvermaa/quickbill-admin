const { Client } = require('pg');
require('dotenv').config();

async function createMissingViews() {
  const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ No database connection string found!');
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

    // Create user_subscriptions_detailed view
    console.log('\n📝 Creating user_subscriptions_detailed view...');
    await client.query(`
      CREATE OR REPLACE VIEW user_subscriptions_detailed AS
      SELECT 
          us.id as subscription_id,
          us.user_id,
          u.name as user_name,
          u.email as user_email,
          u.phone as user_phone,
          u.business_name,
          us.plan,
          us.status,
          us.start_date,
          us.end_date,
          us.is_trial,
          us.grace_period_end,
          us.created_at,
          us.updated_at,
          -- Calculate days remaining
          CASE 
              WHEN us.end_date > NOW() THEN 
                  EXTRACT(DAY FROM us.end_date - NOW())::INTEGER
              ELSE 0
          END as days_remaining,
          -- Check if in grace period
          CASE 
              WHEN us.grace_period_end IS NOT NULL AND us.grace_period_end > NOW() THEN 
                  true
              ELSE false
          END as is_in_grace_period
      FROM 
          user_subscriptions us
      INNER JOIN 
          users u ON us.user_id = u.id
      ORDER BY 
          us.created_at DESC
    `);
    console.log('✅ Created user_subscriptions_detailed view');

    // Create active_subscriptions_detailed view
    console.log('\n📝 Creating active_subscriptions_detailed view...');
    await client.query(`
      CREATE OR REPLACE VIEW active_subscriptions_detailed AS
      SELECT * FROM user_subscriptions_detailed
      WHERE status = 'active' AND end_date > NOW()
    `);
    console.log('✅ Created active_subscriptions_detailed view');

    // Create indexes
    console.log('\n📝 Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
      CREATE INDEX IF NOT EXISTS idx_user_subscriptions_end_date ON user_subscriptions(end_date);
    `);
    console.log('✅ Created indexes');

    // Verify views
    console.log('\n🔍 Verifying views...');
    const verifyResult = await client.query(`
      SELECT 'user_subscriptions_detailed' as view_name, EXISTS (
          SELECT FROM information_schema.views 
          WHERE table_name = 'user_subscriptions_detailed'
      ) as exists
      UNION ALL
      SELECT 'active_subscriptions_detailed' as view_name, EXISTS (
          SELECT FROM information_schema.views 
          WHERE table_name = 'active_subscriptions_detailed'
      ) as exists
    `);
    
    console.table(verifyResult.rows);

    // Test the views
    console.log('\n📊 Testing views with sample data...');
    
    const activeSubsResult = await client.query(
      'SELECT COUNT(*) as count FROM active_subscriptions_detailed'
    );
    console.log(`Active subscriptions: ${activeSubsResult.rows[0].count}`);
    
    const allSubsResult = await client.query(
      'SELECT COUNT(*) as count FROM user_subscriptions_detailed'
    );
    console.log(`Total subscriptions: ${allSubsResult.rows[0].count}`);

    console.log('\n✅ All views created successfully!');
    console.log('The admin panel should now be able to load data properly.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n🔒 Database connection closed');
  }
}

// Run the script
createMissingViews().catch(console.error);