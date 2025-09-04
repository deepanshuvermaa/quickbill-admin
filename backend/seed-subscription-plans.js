const { Pool } = require('pg');
require('dotenv').config();

// Database connection - use public URL when running locally
const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function seedSubscriptionPlans() {
  const client = await pool.connect();
  
  try {
    console.log('Starting subscription plans seeding...\n');
    
    await client.query('BEGIN');
    
    // Check if subscription_plans table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'subscription_plans'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('Creating subscription_plans table...');
      
      await client.query(`
        CREATE TABLE subscription_plans (
          id SERIAL PRIMARY KEY,
          name VARCHAR(50) UNIQUE NOT NULL,
          display_name VARCHAR(100) NOT NULL,
          price_monthly DECIMAL(10, 2) NOT NULL,
          duration_days INTEGER NOT NULL DEFAULT 30,
          features JSONB DEFAULT '{}',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      console.log('✓ Table created successfully\n');
    }
    
    // Insert subscription plans with yearly pricing
    const plans = [
      {
        name: 'silver',
        display_name: 'Silver - Yearly',
        price: 1999,
        duration_days: 365,
        features: {
          maxItems: 100,
          hasUnlimitedItems: false,
          hasInventory: false,
          hasTaxReports: false,
          hasCustomerReports: false,
          hasUserReports: false,
          hasKotBilling: false,
          maxBills: -1,
          maxCustomers: -1
        }
      },
      {
        name: 'gold',
        display_name: 'Gold - Yearly',
        price: 2999,
        duration_days: 365,
        features: {
          maxItems: -1,
          hasUnlimitedItems: true,
          hasInventory: true,
          hasTaxReports: true,
          hasCustomerReports: true,
          hasUserReports: false,
          hasKotBilling: false,
          maxBills: -1,
          maxCustomers: -1
        }
      },
      {
        name: 'platinum',
        display_name: 'Platinum - Yearly',
        price: 4999,
        duration_days: 365,
        features: {
          maxItems: -1,
          hasUnlimitedItems: true,
          hasInventory: true,
          hasTaxReports: true,
          hasCustomerReports: true,
          hasUserReports: true,
          hasKotBilling: true,
          maxBills: -1,
          maxCustomers: -1
        }
      }
    ];
    
    for (const plan of plans) {
      console.log(`Inserting ${plan.display_name}...`);
      
      await client.query(`
        INSERT INTO subscription_plans (name, display_name, price_monthly, duration_days, features, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (name) 
        DO UPDATE SET 
          display_name = EXCLUDED.display_name,
          price_monthly = EXCLUDED.price_monthly,
          duration_days = EXCLUDED.duration_days,
          features = EXCLUDED.features,
          updated_at = NOW()
      `, [plan.name, plan.display_name, plan.price, plan.duration_days, JSON.stringify(plan.features)]);
      
      console.log(`✓ ${plan.display_name} created/updated successfully`);
    }
    
    // Verify the inserted plans
    console.log('\n--- Verifying Subscription Plans ---\n');
    
    const verifyResult = await client.query(`
      SELECT 
        name,
        display_name,
        price_monthly as price,
        duration_days,
        features
      FROM subscription_plans 
      WHERE name IN ('silver', 'gold', 'platinum')
      ORDER BY 
        CASE name 
          WHEN 'silver' THEN 1
          WHEN 'gold' THEN 2
          WHEN 'platinum' THEN 3
        END
    `);
    
    verifyResult.rows.forEach(plan => {
      const items = plan.features.maxItems === -1 ? 'Unlimited' : plan.features.maxItems;
      console.log(`${plan.display_name}: ₹${plan.price}/year (${plan.duration_days} days) - ${items} items`);
    });
    
    await client.query('COMMIT');
    console.log('\n✅ All subscription plans have been successfully seeded with yearly pricing!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding subscription plans:', error);
    throw error;
  } finally {
    client.release();
    pool.end();
  }
}

// Run the seeding
seedSubscriptionPlans()
  .then(() => {
    console.log('\nSeeding completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });