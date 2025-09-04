#!/bin/bash

# Run database migration to create subscription views
# This script connects to the Railway PostgreSQL database and creates the views

echo "Running database migration to create subscription views..."

# Railway provides DATABASE_URL environment variable
# You need to run this on Railway console or with Railway CLI

psql $DATABASE_URL < migrations/create_subscription_view.sql

if [ $? -eq 0 ]; then
    echo "Migration completed successfully!"
    echo "Created views:"
    echo "  - user_subscriptions_detailed"
    echo "  - active_subscriptions_detailed"
    echo "  - expired_subscriptions_detailed"
else
    echo "Migration failed!"
    exit 1
fi