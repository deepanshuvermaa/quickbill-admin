const { Client } = require('pg');
require('dotenv').config();

async function checkAdminUser() {
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
    
    // Find the admin user
    console.log('\n🔍 Searching for admin user...');
    const result = await client.query(
      `SELECT id, name, email, created_at 
       FROM users 
       WHERE email ILIKE '%deepanshu%' OR email ILIKE '%966%'
       ORDER BY created_at DESC`
    );
    
    if (result.rows.length > 0) {
      console.log('\n✅ Found users:');
      console.table(result.rows);
      
      // Check exact match
      const exactMatch = result.rows.find(u => u.email === 'deepanshuverma966@gmail.com');
      if (exactMatch) {
        console.log('\n✅ Exact admin email match found!');
        console.log('User ID:', exactMatch.id);
      } else {
        console.log('\n⚠️  No exact match for deepanshuverma966@gmail.com');
        console.log('Make sure the email in database matches exactly (case-sensitive)');
      }
    } else {
      console.log('\n❌ No users found with deepanshu in email');
    }
    
    // Also check what email the token might be using
    console.log('\n📝 To debug further:');
    console.log('1. Check the JWT token payload in the browser');
    console.log('2. Look at browser console for the userId being sent');
    console.log('3. Verify the email matches exactly in the database');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n🔒 Database connection closed');
  }
}

checkAdminUser();