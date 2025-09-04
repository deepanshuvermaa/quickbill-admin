const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  console.log('🚀 Starting subscription system migration...');
  
  try {
    // Read the migration SQL file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'src/db/migrations/002_update_subscription_tiers.sql'),
      'utf8'
    );
    
    // Execute the migration
    console.log('📝 Running migration: 002_update_subscription_tiers.sql');
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the new tables
    console.log('\n📊 Verifying new tables...');
    
    const tables = [
      'admin_controls',
      'manual_payments',
      'subscription_features',
      'grace_period_logs'
    ];
    
    for (const table of tables) {
      const result = await pool.query(
        `SELECT COUNT(*) FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = $1`,
        [table]
      );
      
      if (result.rows[0].count === '1') {
        console.log(`✅ Table '${table}' exists`);
      } else {
        console.log(`❌ Table '${table}' not found`);
      }
    }
    
    // Check subscription plans
    console.log('\n📋 Checking subscription plans...');
    const plansResult = await pool.query('SELECT name, display_name, price_monthly FROM subscription_plans ORDER BY priority');
    console.log('Subscription plans:');
    plansResult.rows.forEach(plan => {
      console.log(`  - ${plan.display_name}: ₹${plan.price_monthly}`);
    });
    
    // Update environment variables reminder
    console.log('\n⚠️  Important: Make sure to update your .env file with:');
    console.log('  - ADMIN_SECRET_TOKEN=your-secure-admin-token');
    console.log('  - UPI_ID=yourbusiness@paytm');
    console.log('  - MERCHANT_NAME=YourBusinessName');
    console.log('  - DEFAULT_TRIAL_DAYS=7');
    console.log('  - DEFAULT_GRACE_PERIOD_DAYS=4');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration();