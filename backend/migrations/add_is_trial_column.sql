-- Add is_trial column to user_subscriptions table if it doesn't exist
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false;

-- Update existing trial subscriptions (if any)
UPDATE user_subscriptions 
SET is_trial = true 
WHERE plan = 'platinum' 
  AND EXTRACT(DAY FROM (end_date - start_date)) <= 7;