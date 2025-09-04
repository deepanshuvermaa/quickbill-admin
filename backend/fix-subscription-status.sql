-- Fix subscription status based on dates
-- This script corrects subscription status mismatches

-- 1. Fix subscriptions that should be active (end_date is in future but status is not active)
UPDATE user_subscriptions 
SET status = 'active', 
    updated_at = NOW() 
WHERE end_date > NOW() 
  AND status NOT IN ('active', 'trial')
  AND status != 'cancelled';

-- 2. Fix subscriptions that should be expired (end_date has passed but status is still active)
UPDATE user_subscriptions 
SET status = 'expired', 
    updated_at = NOW() 
WHERE end_date <= NOW() 
  AND status IN ('active', 'trial')
  AND (grace_period_end IS NULL OR grace_period_end <= NOW());

-- 3. Fix subscriptions in grace period
UPDATE user_subscriptions 
SET status = 'grace_period', 
    updated_at = NOW() 
WHERE end_date <= NOW() 
  AND grace_period_end IS NOT NULL 
  AND grace_period_end > NOW()
  AND status != 'grace_period';

-- 4. Show current subscription status summary
SELECT 
    status,
    COUNT(*) as count,
    COUNT(CASE WHEN end_date > NOW() THEN 1 END) as should_be_active,
    COUNT(CASE WHEN end_date <= NOW() THEN 1 END) as should_be_expired
FROM user_subscriptions
GROUP BY status
ORDER BY status;

-- 5. Show users with platinum subscriptions that should be active
SELECT 
    us.user_id,
    u.name,
    u.email,
    us.plan,
    us.status,
    us.start_date,
    us.end_date,
    us.end_date > NOW() as should_be_active,
    us.is_trial
FROM user_subscriptions us
JOIN users u ON us.user_id = u.id
WHERE us.plan LIKE '%platinum%'
  AND us.end_date > NOW()
ORDER BY us.end_date DESC;