-- Create a view that joins user information with subscriptions
-- This makes it easy to see user details alongside their subscriptions

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

-- Create an index on the view for better performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_end_date ON user_subscriptions(end_date);

-- Also create a view for active subscriptions only
CREATE OR REPLACE VIEW active_subscriptions_detailed AS
SELECT * FROM user_subscriptions_detailed
WHERE status = 'active' AND end_date > NOW();

-- Create a view for expired subscriptions
CREATE OR REPLACE VIEW expired_subscriptions_detailed AS
SELECT * FROM user_subscriptions_detailed
WHERE status = 'expired' OR end_date <= NOW();

-- Grant permissions if needed (adjust based on your database user)
-- GRANT SELECT ON user_subscriptions_detailed TO your_app_user;
-- GRANT SELECT ON active_subscriptions_detailed TO your_app_user;
-- GRANT SELECT ON expired_subscriptions_detailed TO your_app_user;