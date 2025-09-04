const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read the migration file
const migrationSQL = fs.readFileSync(path.join(__dirname, 'migrations/fix-database.sql'), 'utf8');

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found!');
  process.exit(1);
}

// Use pg module to run migration
const { Client } = require('pg');
const client = new Client({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    await client.query(migrationSQL);
    console.log('Migration completed successfully!');
    
    // Verify the views were created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%subscriptions_detailed%'
    `);
    
    console.log('Created views:', result.rows);
    
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();