# Admin Panel - Backend Endpoints Verification

## Backend Endpoints (Railway)

### 1. Authentication
- [x] **POST** `/api/auth/login` - Admin login
- [x] **POST** `/api/auth/register` - User registration  
- [x] **POST** `/api/auth/refresh` - Refresh token
- [x] **GET** `/api/auth/verify` - Verify token

### 2. Subscription Management (subscriptions-simple)
- [x] **GET** `/api/subscriptions-simple/pending-payments` - Get pending manual payments
- [x] **GET** `/api/subscriptions-simple/active-subscriptions` - Get all active subscriptions with user details
- [x] **POST** `/api/subscriptions-simple/verify-payment/:paymentId` - Verify manual payment
- [x] **POST** `/api/subscriptions-simple/submit-payment` - Submit manual payment

### 3. Admin Routes
- [x] **GET** `/api/admin/users` - Get all users
- [x] **GET** `/api/admin/dashboard` - Dashboard statistics
- [x] **POST** `/api/admin/create-subscription` - Manual subscription creation
- [x] **GET** `/api/admin/export/subscriptions` - Export subscription data

### 4. Admin Subscription Management (NEW)
- [x] **POST** `/api/admin/subscriptions/activate/:userId` - Activate subscription
- [x] **POST** `/api/admin/subscriptions/deactivate/:userId` - Deactivate subscription
- [x] **POST** `/api/admin/subscriptions/extend/:userId` - Extend subscription
- [x] **POST** `/api/admin/subscriptions/change-plan/:userId` - Change plan
- [x] **POST** `/api/admin/subscriptions/force-refresh/:userId` - Force refresh user data
- [x] **GET** `/api/admin/subscriptions/subscription/:userId` - Get user subscription details

## Admin Panel Functions (GitHub Pages)

### 1. Dashboard Display
- [x] Pending payments count with user details
- [x] Active subscriptions list with user info
- [x] Total users count
- [x] Monthly revenue calculation

### 2. Payment Management
- [x] View pending payments with user details (name, email, phone)
- [x] Verify payment button
- [x] View payment proof/screenshot

### 3. Subscription Management (Per User)
- [x] **Manage Button** - Opens modal with options:
  - [x] Activate Subscription (set plan & days)
  - [x] Deactivate Subscription
  - [x] Extend Subscription (add days)
  - [x] Change Plan (silver/gold/platinum)
- [x] **Refresh Button** - Force refresh user's subscription data

### 4. User Information Display
- [x] User name
- [x] Email
- [x] Phone number
- [x] Business name
- [x] Subscription plan
- [x] Status (active/expired/trial)
- [x] Days remaining
- [x] Trial indicator
- [x] Grace period indicator

## Database Views (Created)
- [x] `user_subscriptions_detailed` - Comprehensive subscription data with user info
- [x] `active_subscriptions_detailed` - Active subscriptions only

## Server Configuration
- [x] `server-with-migration.js` updated with all routes
- [x] CORS configured for GitHub Pages
- [x] Authentication middleware in place
- [x] Admin email verification

## What You Can Do As Admin:

1. **Full Subscription Control**
   - Activate any user's subscription with custom plan and duration
   - Deactivate subscriptions immediately
   - Extend subscriptions by any number of days
   - Change between silver/gold/platinum plans
   - Force refresh to fix any sync issues

2. **Payment Verification**
   - See all pending payments with full user details
   - Verify payments to activate subscriptions
   - View payment screenshots/proof

3. **User Management**
   - View all users and their subscription status
   - Export subscription data as CSV
   - Monitor revenue and user statistics

4. **Real-time Updates**
   - All changes reflect immediately in the database
   - Users see updates after login/refresh
   - Force refresh clears any cached data

## Testing Commands

To verify everything is working after deployment:

```bash
# Test health endpoint
curl https://quickbill-production.up.railway.app/api/health

# Test with your admin credentials
curl -X POST https://quickbill-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"deepanshuverma966@gmail.com","password":"YOUR_PASSWORD"}'
```

## Notes:
- All endpoints require authentication token except login
- Admin functions verify admin email (deepanshuverma966@gmail.com)
- Database views optimize query performance
- All user data is included in subscription lists