-- This script fixes all database issues for the QuickBill app

-- 1. Add is_trial column to user_subscriptions table if it doesn't exist
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false;

-- 2. Add grace_period_end column if it doesn't exist
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS grace_period_end TIMESTAMP;

-- 3. Update existing trial subscriptions (7 days or less)
UPDATE user_subscriptions 
SET is_trial = true 
WHERE plan = 'platinum' 
  AND EXTRACT(DAY FROM (end_date - start_date)) <= 7
  AND is_trial = false;

-- 4. Create manual_payments table if it doesn't exist
CREATE TABLE IF NOT EXISTS manual_payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  plan_id INTEGER,
  amount DECIMAL(10,2),
  payment_method VARCHAR(50),
  transaction_reference VARCHAR(255),
  verification_status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  verified_at TIMESTAMP,
  verified_by INTEGER REFERENCES users(id)
);

-- 5. Create subscription_plans table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_days INTEGER NOT NULL,
  features JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. Insert default subscription plans if they don't exist
INSERT INTO subscription_plans (name, display_name, price, duration_days, features)
VALUES 
  ('silver_monthly', 'Silver - Monthly', 999, 30, '{"hasInventory": false, "hasTaxReports": false, "hasCustomerReports": false, "hasUserReports": false, "hasKotBilling": false, "maxUsers": 1}'),
  ('silver_quarterly', 'Silver - Quarterly', 2997, 90, '{"hasInventory": false, "hasTaxReports": false, "hasCustomerReports": false, "hasUserReports": false, "hasKotBilling": false, "maxUsers": 1}'),
  ('silver_yearly', 'Silver - Yearly', 11988, 365, '{"hasInventory": false, "hasTaxReports": false, "hasCustomerReports": false, "hasUserReports": false, "hasKotBilling": false, "maxUsers": 1}'),
  ('gold_monthly', 'Gold - Monthly', 1999, 30, '{"hasInventory": true, "hasTaxReports": true, "hasCustomerReports": false, "hasUserReports": false, "hasKotBilling": false, "maxUsers": 3}'),
  ('gold_quarterly', 'Gold - Quarterly', 5997, 90, '{"hasInventory": true, "hasTaxReports": true, "hasCustomerReports": false, "hasUserReports": false, "hasKotBilling": false, "maxUsers": 3}'),
  ('gold_yearly', 'Gold - Yearly', 23988, 365, '{"hasInventory": true, "hasTaxReports": true, "hasCustomerReports": false, "hasUserReports": false, "hasKotBilling": false, "maxUsers": 3}'),
  ('platinum_monthly', 'Platinum - Monthly', 3999, 30, '{"hasInventory": true, "hasTaxReports": true, "hasCustomerReports": true, "hasUserReports": true, "hasKotBilling": true, "maxUsers": -1}'),
  ('platinum_quarterly', 'Platinum - Quarterly', 11997, 90, '{"hasInventory": true, "hasTaxReports": true, "hasCustomerReports": true, "hasUserReports": true, "hasKotBilling": true, "maxUsers": -1}'),
  ('platinum_yearly', 'Platinum - Yearly', 47988, 365, '{"hasInventory": true, "hasTaxReports": true, "hasCustomerReports": true, "hasUserReports": true, "hasKotBilling": true, "maxUsers": -1}')
ON CONFLICT (name) DO NOTHING;

-- 7. Create the views for better subscription visibility
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
    us.created_at DESC;

-- 8. Create view for active subscriptions only
CREATE OR REPLACE VIEW active_subscriptions_detailed AS
SELECT * FROM user_subscriptions_detailed
WHERE status = 'active' AND end_date > NOW();

-- 9. Create view for expired subscriptions
CREATE OR REPLACE VIEW expired_subscriptions_detailed AS
SELECT * FROM user_subscriptions_detailed
WHERE status = 'expired' OR end_date <= NOW();

-- 10. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_end_date ON user_subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_manual_payments_user_id ON manual_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_payments_status ON manual_payments(verification_status);

-- Success message
SELECT 'Database setup completed successfully!' as message;