const { Pool } = require('pg');
require('dotenv').config();

// Database connection - use public URL when running locally
const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function applyYearlyPricing() {
  const client = await pool.connect();
  
  try {
    console.log('Starting subscription plan update to yearly pricing...\n');
    
    await client.query('BEGIN');
    
    // Update Silver plan
    console.log('Updating Silver plan...');
    const silverResult = await client.query(`
      UPDATE subscription_plans 
      SET 
        price_monthly = 1999,
        duration_days = 365,
        display_name = 'Silver - Yearly',
        features = jsonb_set(
          jsonb_set(
            COALESCE(features, '{}'::jsonb),
            '{maxItems}',
            '100'::jsonb
          ),
          '{hasUnlimitedItems}',
          'false'::jsonb
        ),
        updated_at = NOW()
      WHERE name = 'silver'
      RETURNING *
    `);
    
    if (silverResult.rowCount > 0) {
      console.log('✓ Silver plan updated: ₹1999/year with 100 items limit');
    } else {
      console.log('⚠ Silver plan not found');
    }
    
    // Update Gold plan
    console.log('\nUpdating Gold plan...');
    const goldResult = await client.query(`
      UPDATE subscription_plans 
      SET 
        price_monthly = 2999,
        duration_days = 365,
        display_name = 'Gold - Yearly',
        features = jsonb_set(
          COALESCE(features, '{}'::jsonb),
          '{maxItems}',
          '-1'::jsonb
        ),
        updated_at = NOW()
      WHERE name = 'gold'
      RETURNING *
    `);
    
    if (goldResult.rowCount > 0) {
      console.log('✓ Gold plan updated: ₹2999/year with unlimited items');
    } else {
      console.log('⚠ Gold plan not found');
    }
    
    // Update Platinum plan
    console.log('\nUpdating Platinum plan...');
    const platinumResult = await client.query(`
      UPDATE subscription_plans 
      SET 
        price_monthly = 4999,
        duration_days = 365,
        display_name = 'Platinum - Yearly',
        features = jsonb_set(
          COALESCE(features, '{}'::jsonb),
          '{maxItems}',
          '-1'::jsonb
        ),
        updated_at = NOW()
      WHERE name = 'platinum'
      RETURNING *
    `);
    
    if (platinumResult.rowCount > 0) {
      console.log('✓ Platinum plan updated: ₹4999/year with unlimited items');
    } else {
      console.log('⚠ Platinum plan not found');
    }
    
    // Verify the updates
    console.log('\n--- Verifying Updated Plans ---');
    const verifyResult = await client.query(`
      SELECT 
        name,
        display_name,
        price_monthly as price,
        duration_days,
        features->>'maxItems' as max_items
      FROM subscription_plans 
      WHERE name IN ('silver', 'gold', 'platinum')
      ORDER BY 
        CASE name 
          WHEN 'silver' THEN 1
          WHEN 'gold' THEN 2
          WHEN 'platinum' THEN 3
        END
    `);
    
    console.log('\nCurrent subscription plans:');
    verifyResult.rows.forEach(plan => {
      const items = plan.max_items === '-1' ? 'Unlimited' : plan.max_items;
      console.log(`${plan.display_name}: ₹${plan.price}/year (${plan.duration_days} days) - ${items} items`);
    });
    
    await client.query('COMMIT');
    console.log('\n✅ All subscription plans have been successfully updated to yearly pricing!');
    
    // Show note about existing subscriptions
    console.log('\n📌 Note: Existing active subscriptions will continue with their current duration until renewal.');
    console.log('📌 New subscriptions will use the updated yearly pricing.\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error updating subscription plans:', error);
    throw error;
  } finally {
    client.release();
    pool.end();
  }
}

// Run the update
applyYearlyPricing()
  .then(() => {
    console.log('Update completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Update failed:', error);
    process.exit(1);
  });