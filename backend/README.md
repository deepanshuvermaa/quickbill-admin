# QuickBill Backend API

A Node.js backend API for the QuickBill application with authentication, subscription management, and usage tracking.

## Features

- 🔐 **JWT Authentication** - Secure user authentication with refresh tokens
- 👤 **User Management** - Registration, login, profile management
- 💳 **Subscription System** - Trial, monthly, quarterly, and yearly plans
- 📊 **Usage Tracking** - Activity logging and analytics
- 💰 **Payment Integration** - Razorpay payment gateway support
- 📧 **Email Service** - Welcome emails and notifications
- 🛡️ **Security** - Rate limiting, CORS, input validation

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT
- **Validation**: Joi
- **Email**: Resend
- **Payments**: Razorpay
- **Hosting**: Railway.app

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token

### Subscriptions
- `GET /api/subscriptions/plans` - Get subscription plans
- `GET /api/subscriptions/status` - Get user subscription status
- `POST /api/subscriptions/create-order` - Create payment order
- `POST /api/subscriptions/verify-payment` - Verify payment
- `POST /api/subscriptions/cancel` - Cancel subscription

### Usage Tracking
- `POST /api/usage/log` - Log user activity
- `GET /api/usage/stats` - Get usage statistics
- `POST /api/usage/sync` - Sync offline activities

### Health
- `GET /health` - API health check

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
RESEND_API_KEY=your-resend-key
RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_KEY_SECRET=your-razorpay-secret
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your values
```

3. Run database migrations:
```bash
npm run migrate
```

4. Start development server:
```bash
npm run dev
```

## Deployment

The backend is configured for one-click deployment on Railway.app with automatic PostgreSQL provisioning.

## Database Schema

- **users** - User accounts and profiles
- **subscription_plans** - Available subscription plans
- **user_subscriptions** - Active user subscriptions
- **payment_transactions** - Payment records
- **usage_logs** - User activity tracking
- **app_sessions** - Session management

## Security Features

- JWT token authentication
- Password hashing with bcrypt
- Rate limiting (100 requests per 15 minutes)
- Input validation with Joi
- CORS protection
- SQL injection prevention
- Environment-based configuration