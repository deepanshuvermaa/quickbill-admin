const { Client } = require('pg');
require('dotenv').config();

async function checkAllActiveUsers() {
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
    
    // Get ALL users with active subscriptions
    console.log('\n📋 All users with active/recent subscriptions:\n');
    
    const result = await client.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        us.plan,
        us.status,
        us.end_date,
        EXTRACT(DAY FROM us.end_date - NOW()) as days_remaining,
        us.is_trial,
        us.created_at as subscription_created
      FROM users u
      INNER JOIN user_subscriptions us ON u.id = us.user_id
      WHERE us.status = 'active' 
         OR us.end_date > NOW()
         OR us.created_at > NOW() - INTERVAL '7 days'
      ORDER BY us.created_at DESC
      LIMIT 20
    `);
    
    console.table(result.rows);
    
    // Search for specific names
    console.log('\n🔍 Searching for users with names containing "gir" or "jesh"...\n');
    
    const nameSearch = await client.query(`
      SELECT id, name, email, created_at
      FROM users
      WHERE LOWER(name) LIKE '%gir%' 
         OR LOWER(name) LIKE '%jesh%'
         OR LOWER(email) LIKE '%gir%'
         OR LOWER(email) LIKE '%jesh%'
    `);
    
    if (nameSearch.rows.length > 0) {
      console.table(nameSearch.rows);
    } else {
      console.log('❌ No users found with "gir" or "jesh" in their name/email');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n🔒 Database connection closed');
  }
}

checkAllActiveUsers();