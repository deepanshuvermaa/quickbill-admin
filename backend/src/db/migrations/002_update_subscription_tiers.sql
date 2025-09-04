-- Migration: Update subscription system for Silver/Gold/Platinum tiers
-- This migration safely updates the existing schema to support the new subscription model

BEGIN;

-- 1. Add new columns to subscription_plans table for tier-based features
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS tier_level VARCHAR(20),
ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS has_inventory BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_tax_reports BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_customer_reports BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_user_reports BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_kot_billing BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS printer_support VARCHAR(50) DEFAULT 'bluetooth',
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- 2. Add trial configuration to user_subscriptions
ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS original_plan_id INTEGER REFERENCES subscription_plans(id);

-- 3. Create admin_controls table for subscription management
CREATE TABLE IF NOT EXISTS admin_controls (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    old_value JSONB DEFAULT '{}',
    new_value JSONB DEFAULT '{}',
    admin_notes TEXT,
    performed_by VARCHAR(100) DEFAULT 'system',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create manual_payments table for UPI/QR payments
CREATE TABLE IF NOT EXISTS manual_payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subscription_id INTEGER REFERENCES user_subscriptions(id),
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL, -- 'upi_qr', 'paytm', 'phonepe', 'googlepay'
    transaction_reference VARCHAR(100),
    qr_code_data TEXT,
    verification_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
    verified_by VARCHAR(100),
    verified_at TIMESTAMP,
    rejection_reason TEXT,
    screenshot_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Update payment_transactions to support manual payments
ALTER TABLE payment_transactions
ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) DEFAULT 'automatic', -- 'automatic', 'manual'
ADD COLUMN IF NOT EXISTS manual_payment_id INTEGER REFERENCES manual_payments(id);

-- 6. Create subscription_features table for granular feature control
CREATE TABLE IF NOT EXISTS subscription_features (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER REFERENCES subscription_plans(id) ON DELETE CASCADE,
    feature_key VARCHAR(100) NOT NULL,
    feature_name VARCHAR(200) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    limit_value INTEGER, -- For features with numeric limits
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(plan_id, feature_key)
);

-- 7. Create grace_period_logs for tracking notifications
CREATE TABLE IF NOT EXISTS grace_period_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subscription_id INTEGER REFERENCES user_subscriptions(id),
    notification_day INTEGER NOT NULL, -- 1, 2, 3, 4
    notification_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP,
    user_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_controls_user_id ON admin_controls(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_payments_user_id ON manual_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_payments_verification_status ON manual_payments(verification_status);
CREATE INDEX IF NOT EXISTS idx_subscription_features_plan_id ON subscription_features(plan_id);
CREATE INDEX IF NOT EXISTS idx_grace_period_logs_user_id ON grace_period_logs(user_id);

-- 9. Clear existing subscription plans to insert new ones
DELETE FROM subscription_features WHERE plan_id IN (SELECT id FROM subscription_plans);
DELETE FROM subscription_plans;

-- 10. Insert new subscription plans
INSERT INTO subscription_plans (
    name, display_name, tier_level, price_monthly, duration_days, 
    max_users, has_inventory, has_tax_reports, has_customer_reports, 
    has_user_reports, has_kot_billing, printer_support, priority, features
) VALUES 
(
    'silver', 'Silver Plan', 'silver', 1999.00, 30, 
    1, false, false, false, 
    false, false, 'bluetooth', 1,
    '{"description": "Essential billing features for small businesses", "highlight": "Perfect for getting started"}'::jsonb
),
(
    'gold', 'Gold Plan', 'gold', 2999.00, 30, 
    1, true, true, true, 
    false, false, 'bluetooth', 2,
    '{"description": "Advanced features with inventory and reports", "highlight": "Most popular choice"}'::jsonb
),
(
    'platinum', 'Platinum Plan', 'platinum', 3500.00, 30, 
    1, true, true, true, 
    true, true, 'bluetooth', 3,
    '{"description": "Complete solution with all premium features", "highlight": "Best value for growing businesses"}'::jsonb
);

-- 11. Insert detailed features for each plan
-- Silver Plan Features
INSERT INTO subscription_features (plan_id, feature_key, feature_name, is_enabled, limit_value)
SELECT id, feature_key, feature_name, is_enabled, limit_value
FROM subscription_plans sp
CROSS JOIN (VALUES
    ('create_bills', 'Create and Print Bills', true, NULL),
    ('bill_reports', 'Bill-wise Reports', true, NULL),
    ('item_reports', 'Item-wise Reports', true, NULL),
    ('bluetooth_printing', 'Bluetooth Printer Support', true, NULL),
    ('basic_support', 'Email Support', true, NULL)
) AS features(feature_key, feature_name, is_enabled, limit_value)
WHERE sp.name = 'silver';

-- Gold Plan Features
INSERT INTO subscription_features (plan_id, feature_key, feature_name, is_enabled, limit_value)
SELECT id, feature_key, feature_name, is_enabled, limit_value
FROM subscription_plans sp
CROSS JOIN (VALUES
    ('create_bills', 'Create and Print Bills', true, NULL),
    ('bill_reports', 'Bill-wise Reports', true, NULL),
    ('item_reports', 'Item-wise Reports', true, NULL),
    ('inventory_management', 'Inventory Management', true, NULL),
    ('inventory_reports', 'Inventory Reports', true, NULL),
    ('tax_reports', 'Tax Reports', true, NULL),
    ('customer_database', 'Customer Database', true, NULL),
    ('customer_reports', 'Customer Reports', true, NULL),
    ('bluetooth_printing', 'Bluetooth Printer Support', true, NULL),
    ('usb_printing', 'USB Printer Support', true, NULL),
    ('priority_support', 'Priority Email Support', true, NULL)
) AS features(feature_key, feature_name, is_enabled, limit_value)
WHERE sp.name = 'gold';

-- Platinum Plan Features
INSERT INTO subscription_features (plan_id, feature_key, feature_name, is_enabled, limit_value)
SELECT id, feature_key, feature_name, is_enabled, limit_value
FROM subscription_plans sp
CROSS JOIN (VALUES
    ('create_bills', 'Create and Print Bills', true, NULL),
    ('bill_reports', 'Bill-wise Reports', true, NULL),
    ('item_reports', 'Item-wise Reports', true, NULL),
    ('inventory_management', 'Inventory Management', true, NULL),
    ('inventory_reports', 'Inventory Reports', true, NULL),
    ('tax_reports', 'Tax Reports', true, NULL),
    ('customer_database', 'Customer Database', true, NULL),
    ('customer_reports', 'Customer Reports', true, NULL),
    ('user_reports', 'User-wise Reports', true, NULL),
    ('kot_billing', 'KOT Billing', true, NULL),
    ('bluetooth_printing', 'Bluetooth Printer Support', true, NULL),
    ('usb_printing', 'USB Printer Support', true, NULL),
    ('lan_printing', 'LAN Printer Support', true, NULL),
    ('premium_support', '24/7 Premium Support', true, NULL),
    ('data_export', 'Advanced Data Export', true, NULL)
) AS features(feature_key, feature_name, is_enabled, limit_value)
WHERE sp.name = 'platinum';

-- 12. Create function to handle trial to paid conversion
CREATE OR REPLACE FUNCTION handle_trial_expiry() RETURNS void AS $$
BEGIN
    -- Update expired trials
    UPDATE user_subscriptions
    SET status = 'expired',
        updated_at = NOW()
    WHERE is_trial = true 
    AND status = 'active' 
    AND end_date < NOW();
    
    -- Update expired paid subscriptions to grace period
    UPDATE user_subscriptions
    SET status = 'grace_period',
        grace_period_end = end_date + INTERVAL '4 days',
        updated_at = NOW()
    WHERE is_trial = false 
    AND status = 'active' 
    AND end_date < NOW()
    AND grace_period_end IS NULL;
    
    -- Expire grace period subscriptions
    UPDATE user_subscriptions
    SET status = 'expired',
        updated_at = NOW()
    WHERE status = 'grace_period' 
    AND grace_period_end < NOW();
END;
$$ LANGUAGE plpgsql;

-- 13. Create function for admin subscription override
CREATE OR REPLACE FUNCTION admin_update_subscription(
    p_user_id INTEGER,
    p_action VARCHAR,
    p_value JSONB,
    p_admin_notes TEXT,
    p_performed_by VARCHAR
) RETURNS JSONB AS $$
DECLARE
    v_old_value JSONB;
    v_result JSONB;
BEGIN
    -- Get current subscription state
    SELECT to_jsonb(us.*) INTO v_old_value
    FROM user_subscriptions us
    WHERE us.user_id = p_user_id
    AND us.status IN ('active', 'trial', 'grace_period')
    ORDER BY us.created_at DESC
    LIMIT 1;
    
    -- Perform the action
    CASE p_action
        WHEN 'extend_subscription' THEN
            UPDATE user_subscriptions
            SET end_date = end_date + ((p_value->>'days')::INTEGER || ' days')::INTERVAL,
                updated_at = NOW()
            WHERE user_id = p_user_id AND id = (v_old_value->>'id')::INTEGER;
            
        WHEN 'change_plan' THEN
            UPDATE user_subscriptions
            SET plan = p_value->>'plan',
                updated_at = NOW()
            WHERE user_id = p_user_id AND id = (v_old_value->>'id')::INTEGER;
            
        WHEN 'reset_trial' THEN
            UPDATE user_subscriptions
            SET is_trial = true,
                start_date = NOW(),
                end_date = NOW() + ((p_value->>'days')::INTEGER || ' days')::INTERVAL,
                status = 'active',
                updated_at = NOW()
            WHERE user_id = p_user_id AND id = (v_old_value->>'id')::INTEGER;
            
        WHEN 'activate_subscription' THEN
            UPDATE user_subscriptions
            SET status = 'active',
                updated_at = NOW()
            WHERE user_id = p_user_id AND id = (v_old_value->>'id')::INTEGER;
    END CASE;
    
    -- Log the action
    INSERT INTO admin_controls (user_id, action, old_value, new_value, admin_notes, performed_by)
    VALUES (p_user_id, p_action, v_old_value, p_value, p_admin_notes, p_performed_by);
    
    -- Return result
    SELECT to_jsonb(us.*) INTO v_result
    FROM user_subscriptions us
    WHERE us.id = (v_old_value->>'id')::INTEGER;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 14. Update existing user subscriptions to match new structure
UPDATE user_subscriptions us
SET 
    is_trial = (us.plan = 'trial'),
    trial_days = CASE WHEN us.plan = 'trial' THEN 7 ELSE NULL END,
    plan = CASE 
        WHEN us.plan IN ('monthly', 'quarterly', 'yearly') THEN 'silver'
        ELSE us.plan
    END,
    updated_at = NOW()
WHERE us.status IN ('active', 'grace_period');

COMMIT;