const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrations = [
  // Users table
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(15),
    business_name VARCHAR(200),
    password_hash VARCHAR(255) NOT NULL,
    is_email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // Subscription plans table
  `CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    price_monthly DECIMAL(10,2) DEFAULT 0,
    price_quarterly DECIMAL(10,2) DEFAULT 0,
    price_yearly DECIMAL(10,2) DEFAULT 0,
    duration_days INTEGER NOT NULL,
    features JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // User subscriptions table
  `CREATE TABLE IF NOT EXISTS user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    grace_period_end TIMESTAMP,
    payment_id VARCHAR(255),
    amount_paid DECIMAL(10,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'INR',
    auto_renew BOOLEAN DEFAULT FALSE,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // Usage logs table
  `CREATE TABLE IF NOT EXISTS usage_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // Payment transactions table
  `CREATE TABLE IF NOT EXISTS payment_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subscription_id INTEGER REFERENCES user_subscriptions(id),
    payment_gateway VARCHAR(50) NOT NULL,
    gateway_transaction_id VARCHAR(255) UNIQUE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(20) DEFAULT 'pending',
    gateway_response JSONB DEFAULT '{}',
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // App sessions table
  `CREATE TABLE IF NOT EXISTS app_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    device_info JSONB DEFAULT '{}',
    last_activity TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // Create indexes for better performance
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status)`,
  `CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON app_sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_app_sessions_session_token ON app_sessions(session_token)`,
];

const seedData = [
  // Insert default subscription plans
  `INSERT INTO subscription_plans (name, display_name, price_monthly, price_quarterly, price_yearly, duration_days, features)
   VALUES 
   ('trial', 'Free Trial', 0, 0, 0, 30, '{"maxBills": 50, "maxItems": 100, "reports": true, "support": "email"}'),
   ('monthly', 'Monthly Plan', 299, 0, 0, 30, '{"maxBills": -1, "maxItems": -1, "reports": true, "support": "priority", "bluetooth": true}'),
   ('quarterly', 'Quarterly Plan', 0, 799, 0, 90, '{"maxBills": -1, "maxItems": -1, "reports": true, "support": "priority", "bluetooth": true, "discount": "10%"}'),
   ('yearly', 'Yearly Plan', 0, 0, 2999, 365, '{"maxBills": -1, "maxItems": -1, "reports": true, "support": "priority", "bluetooth": true, "discount": "25%"}')
   ON CONFLICT (name) DO NOTHING`,
];

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Running database migrations...');
    
    // Run migrations
    for (let i = 0; i < migrations.length; i++) {
      console.log(`Running migration ${i + 1}/${migrations.length}...`);
      await client.query(migrations[i]);
    }
    
    console.log('🌱 Seeding initial data...');
    
    // Run seed data
    for (let i = 0; i < seedData.length; i++) {
      console.log(`Running seed ${i + 1}/${seedData.length}...`);
      await client.query(seedData[i]);
    }
    
    // Run session management migration
    console.log('🔐 Running session management migration...');
    try {
      const addSessionManagement = require('./migrations/006_add_session_management');
      await addSessionManagement(pool);
    } catch (error) {
      console.log('Session migration may have already been applied:', error.message);
    }
    
    console.log('✅ Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };