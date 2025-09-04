const { Pool } = require('pg');
require('dotenv').config();

// Database connection - use public URL when running locally
const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkSubscriptionPlans() {
  const client = await pool.connect();
  
  try {
    console.log('=== Current Subscription Plans ===\n');
    
    // Check if subscription_plans table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'subscription_plans'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ subscription_plans table does not exist!');
      console.log('Please run your database migrations first.');
      return;
    }
    
    // Get all subscription plans
    const plansResult = await client.query(`
      SELECT 
        id,
        name,
        display_name,
        price_monthly as price,
        duration_days,
        features,
        is_active,
        created_at,
        updated_at
      FROM subscription_plans 
      ORDER BY 
        CASE name 
          WHEN 'silver' THEN 1
          WHEN 'gold' THEN 2
          WHEN 'platinum' THEN 3
          ELSE 4
        END
    `);
    
    if (plansResult.rows.length === 0) {
      console.log('⚠️  No subscription plans found in the database.');
      console.log('You may need to run initial data seeding.');
      return;
    }
    
    console.log(`Found ${plansResult.rows.length} subscription plans:\n`);
    
    plansResult.rows.forEach((plan, index) => {
      console.log(`${index + 1}. ${plan.display_name} (${plan.name})`);
      console.log(`   Price: ₹${plan.price}`);
      console.log(`   Duration: ${plan.duration_days} days`);
      console.log(`   Active: ${plan.is_active ? 'Yes' : 'No'}`);
      
      if (plan.features) {
        console.log('   Features:');
        if (plan.features.maxItems !== undefined) {
          const maxItems = plan.features.maxItems === -1 ? 'Unlimited' : plan.features.maxItems;
          console.log(`     - Max Items: ${maxItems}`);
        }
        if (plan.features.hasInventory !== undefined) {
          console.log(`     - Inventory: ${plan.features.hasInventory ? 'Yes' : 'No'}`);
        }
        if (plan.features.hasTaxReports !== undefined) {
          console.log(`     - Tax Reports: ${plan.features.hasTaxReports ? 'Yes' : 'No'}`);
        }
        if (plan.features.hasCustomerReports !== undefined) {
          console.log(`     - Customer Reports: ${plan.features.hasCustomerReports ? 'Yes' : 'No'}`);
        }
        if (plan.features.hasUserReports !== undefined) {
          console.log(`     - User Reports: ${plan.features.hasUserReports ? 'Yes' : 'No'}`);
        }
        if (plan.features.hasKotBilling !== undefined) {
          console.log(`     - KOT Billing: ${plan.features.hasKotBilling ? 'Yes' : 'No'}`);
        }
      }
      
      console.log(`   Last Updated: ${plan.updated_at ? new Date(plan.updated_at).toLocaleString() : 'Never'}`);
      console.log('');
    });
    
    // Check for active subscriptions
    console.log('=== Active Subscriptions Summary ===\n');
    
    const activeSubsResult = await client.query(`
      SELECT 
        plan,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_count,
        COUNT(CASE WHEN is_trial = true THEN 1 END) as trial_count
      FROM user_subscriptions
      WHERE plan IN ('silver', 'gold', 'platinum')
      GROUP BY plan
      ORDER BY plan
    `);
    
    if (activeSubsResult.rows.length > 0) {
      console.log('Current user distribution:');
      activeSubsResult.rows.forEach(sub => {
        console.log(`${sub.plan}: ${sub.count} total (${sub.active_count} active, ${sub.expired_count} expired, ${sub.trial_count} trials)`);
      });
    } else {
      console.log('No active subscriptions found.');
    }
    
  } catch (error) {
    console.error('Error checking subscription plans:', error);
  } finally {
    client.release();
    pool.end();
  }
}

// Run the check
checkSubscriptionPlans();