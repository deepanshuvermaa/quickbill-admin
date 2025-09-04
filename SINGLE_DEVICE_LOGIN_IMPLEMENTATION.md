# Single Device Login & Admin Management Implementation

## Overview
This document outlines the implementation of single device login system for QuickBill POS, ensuring one user can only be logged in on one device at a time with admin management capabilities.

## Backend Configuration
- **API Base URL**: `https://quickbill-production.up.railway.app/api`
- **Admin Email**: `deepanshuverma966@gmail.com` (has full access to all features and user management)

## Key Features Implemented

### 1. Device Tracking (`utils/deviceTracking.ts`)
- Generates unique device ID for each installation
- Tracks device type (phone/tablet/desktop/web)
- Stores device information including:
  - Device name
  - Platform (iOS/Android/Web)
  - OS version
  - App version
  - Last active timestamp

### 2. Enhanced Auth Store (`store/authStore.enhanced.ts`)

#### Single Device Login
- **Last Write Wins Policy**: When a user logs in on a new device, the previous device session is automatically terminated
- Session validation every 30 seconds to check if current session is still valid
- Automatic logout if session is invalidated (user logged in elsewhere)

#### Admin Features
- Admin account (`deepanshuverma966@gmail.com`) has:
  - Full access to all features regardless of subscription
  - Ability to disable/enable user accounts
  - Access to all user data and reports
  - Override capabilities for subscription restrictions

#### Session Management
```typescript
// Login with device tracking
await authStore.login(email, password);
// This will:
// 1. Get current device info
// 2. Send to backend with forceLogin: true
// 3. Logout any other active sessions
// 4. Create new session with device info

// Check session validity (runs every 30 seconds)
await authStore.checkSessionValidity();
// If invalid, user is automatically logged out
```

### 3. Data Sync Strategy

#### On Device Switch
1. **Before Logout** (Old Device):
   ```typescript
   await authStore.syncDataOnDeviceSwitch();
   ```
   - Uploads all local data to cloud
   - Includes: bills, items, customers, settings
   - Updates lastSyncTime

2. **After Login** (New Device):
   - Downloads latest data from cloud
   - Merges with any local data
   - Resolves conflicts using timestamp (latest wins)

#### Sync Points
- On login
- On logout
- Every 5 minutes (if online)
- Before app goes to background
- On network reconnection

### 4. Subscription Management

#### Admin Override
```typescript
if (isAdmin) {
  // Admin gets platinum features regardless
  subscription = {
    plan: 'platinum',
    status: 'active',
    features: {
      hasInventory: true,
      hasTaxReports: true,
      hasCustomerReports: true,
      hasUserReports: true,
      hasKotBilling: true,
      maxUsers: 999
    }
  };
}
```

#### User Account Control
```typescript
// Admin can disable accounts
await authStore.disableUserAccount(userId);
// Sets subscription.status = 'disabled'
// User cannot access app until re-enabled

// Admin can enable accounts
await authStore.enableUserAccount(userId);
// Restores previous subscription status
```

## Backend API Endpoints Required

### Authentication
- `POST /api/auth/login` - Login with device info
  ```json
  {
    "email": "user@example.com",
    "password": "password",
    "deviceInfo": {
      "deviceId": "uuid",
      "deviceName": "iPhone 13",
      "deviceType": "phone",
      "platform": "ios",
      "osVersion": "15.0",
      "appVersion": "1.0.0"
    },
    "forceLogin": true
  }
  ```

- `POST /api/auth/check-session` - Validate current session
- `POST /api/auth/force-logout-others` - Force logout on other devices
- `POST /api/auth/logout` - Logout with session cleanup

### Admin Endpoints
- `POST /api/admin/users/:userId/disable` - Disable user account
- `POST /api/admin/users/:userId/enable` - Enable user account
- `GET /api/admin/users` - List all users with sessions
- `GET /api/admin/sessions/active` - View all active sessions

### Data Sync
- `POST /api/sync/upload` - Upload local data
- `GET /api/sync/download` - Download latest data
- `POST /api/sync/merge` - Merge conflicts

## Database Schema Updates

### Users Table
```sql
ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';
UPDATE users SET role = 'admin' WHERE email = 'deepanshuverma966@gmail.com';
```

### Sessions Table
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  session_token TEXT UNIQUE NOT NULL,
  device_id TEXT NOT NULL,
  device_info JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  invalidated_at TIMESTAMP,
  invalidated_by TEXT -- 'new_login', 'manual_logout', 'admin_action'
);

CREATE INDEX idx_sessions_user_active ON sessions(user_id, is_active);
CREATE INDEX idx_sessions_token ON sessions(session_token);
```

### Subscriptions Table
```sql
ALTER TABLE subscriptions ADD COLUMN disabled_by UUID REFERENCES users(id);
ALTER TABLE subscriptions ADD COLUMN disabled_at TIMESTAMP;
ALTER TABLE subscriptions ADD COLUMN disabled_reason TEXT;
```

## Security Considerations

1. **Token Rotation**: Refresh tokens on each session check
2. **Session Timeout**: Auto-logout after 24 hours of inactivity
3. **Device Fingerprinting**: Additional validation using device characteristics
4. **Rate Limiting**: Limit login attempts to prevent brute force
5. **Audit Logging**: Track all admin actions

## Testing Scenarios

1. **Single Device Login**
   - Login on Device A
   - Login on Device B with same credentials
   - Device A should be logged out automatically

2. **Admin Functions**
   - Login as `deepanshuverma966@gmail.com`
   - Disable a user account
   - User should be unable to access app
   - Enable the account
   - User should regain access

3. **Data Sync**
   - Create bills on Device A
   - Login on Device B
   - All bills should appear on Device B
   - Device A should be logged out

## Implementation Checklist

- [x] Create device tracking utility
- [x] Enhance auth store with session management
- [x] Add admin role and permissions
- [x] Implement single device login logic
- [x] Remove hardcoded demo credentials
- [ ] Update backend API endpoints
- [ ] Add database tables for sessions
- [ ] Implement WebSocket for real-time session invalidation
- [ ] Add data sync mechanisms
- [ ] Test all scenarios

## Notes for Desktop Build

Since the desktop app uses the React Native Web build, all authentication and session management will work seamlessly across platforms. The device type will be detected as 'desktop' when running in Electron.

To rebuild the desktop app with these changes:
```bash
# Build web version
npm run web:build

# Package as desktop app
npm run build:desktop-win
```

The final exe will be at: `C:\Users\Asus\Quickbill\desktop-final\win-unpacked\QuickBill POS.exe`