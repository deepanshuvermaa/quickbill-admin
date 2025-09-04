-- Migration to update subscription plans to yearly pricing
-- Silver: ₹1999/year, Gold: ₹2999/year, Platinum: ₹4999/year

-- Update subscription plans to yearly pricing with 365 days duration
UPDATE subscription_plans 
SET 
    price_monthly = CASE
        WHEN name = 'silver' THEN 1999
        WHEN name = 'gold' THEN 2999
        WHEN name = 'platinum' THEN 4999
        ELSE price_monthly
    END,
    duration_days = 365,
    display_name = CASE
        WHEN name = 'silver' THEN 'Silver - Yearly'
        WHEN name = 'gold' THEN 'Gold - Yearly'
        WHEN name = 'platinum' THEN 'Platinum - Yearly'
        ELSE display_name
    END,
    updated_at = NOW()
WHERE name IN ('silver', 'gold', 'platinum');

-- Update features for Silver plan to have 100 items limit instead of unlimited
UPDATE subscription_plans
SET features = jsonb_set(
    features,
    '{maxItems}',
    '100'::jsonb
)
WHERE name = 'silver';

-- Also update the features to reflect the item limit in the feature list
UPDATE subscription_plans
SET features = jsonb_set(
    features,
    '{hasUnlimitedItems}',
    'false'::jsonb
)
WHERE name = 'silver';

-- Add maxItems to Gold and Platinum plans as -1 (unlimited)
UPDATE subscription_plans
SET features = jsonb_set(
    features,
    '{maxItems}',
    '-1'::jsonb
)
WHERE name IN ('gold', 'platinum');

-- Log the changes
DO $$
BEGIN
    RAISE NOTICE 'Subscription plans updated to yearly pricing:';
    RAISE NOTICE 'Silver: ₹1999/year (365 days) with 100 items limit';
    RAISE NOTICE 'Gold: ₹2999/year (365 days) with unlimited items';
    RAISE NOTICE 'Platinum: ₹4999/year (365 days) with unlimited items';
END $$;