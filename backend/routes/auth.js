const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const Joi = require('joi');
const { authenticateToken } = require('../middleware/auth');
const SessionService = require('../services/sessionService');
const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Validation schemas
const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
  businessName: Joi.string().min(2).max(100).required(),
  password: Joi.string().min(6).required(),
  deviceInfo: Joi.object({
    deviceId: Joi.string().required(),
    deviceName: Joi.string().optional(),
    deviceType: Joi.string().valid('phone', 'tablet', 'desktop', 'web').optional(),
    platform: Joi.string().optional(),
    osVersion: Joi.string().optional(),
    appVersion: Joi.string().optional()
  }).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  deviceInfo: Joi.object({
    deviceId: Joi.string().required(),
    deviceName: Joi.string().optional(),
    deviceType: Joi.string().valid('phone', 'tablet', 'desktop', 'web').optional(),
    platform: Joi.string().optional(),
    osVersion: Joi.string().optional(),
    appVersion: Joi.string().optional()
  }).optional(),
  forceLogin: Joi.boolean().optional()
});

// Helper function to generate JWT with session info
const generateToken = (userId, sessionId) => {
  return jwt.sign({ userId, sessionId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
};

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    // Validate input
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { name, email, phone, businessName, password } = value;

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const userResult = await pool.query(
      `INSERT INTO users (name, email, phone, business_name, password_hash, is_email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, name, email, phone, business_name, is_email_verified, created_at`,
      [name, email, phone, businessName, hashedPassword, false]
    );

    const user = userResult.rows[0];

    // Create 7-day trial subscription with platinum features
    // First check if is_trial column exists
    const columnCheck = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'user_subscriptions' AND column_name = 'is_trial'`
    );
    
    const hasIsTrialColumn = columnCheck.rows.length > 0;
    
    const subscriptionQuery = hasIsTrialColumn
      ? `INSERT INTO user_subscriptions (user_id, plan, status, start_date, end_date, is_trial, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '7 days', true, NOW(), NOW())
         RETURNING id, plan, status, start_date, end_date, is_trial`
      : `INSERT INTO user_subscriptions (user_id, plan, status, start_date, end_date, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '7 days', NOW(), NOW())
         RETURNING id, plan, status, start_date, end_date`;
    
    const subscriptionResult = await pool.query(subscriptionQuery, [user.id, 'platinum', 'active']);

    const subscription = subscriptionResult.rows[0];

    // Generate tokens
    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Calculate days remaining
    const endDate = new Date(subscription.end_date);
    const now = new Date();
    const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          businessName: user.business_name,
          isEmailVerified: user.is_email_verified,
          createdAt: user.created_at
        },
        subscription: {
          id: subscription.id,
          plan: subscription.plan,
          status: subscription.status,
          startDate: subscription.start_date,
          endDate: subscription.end_date,
          isInGracePeriod: false,
          daysRemaining: Math.max(0, daysRemaining)
        },
        token,
        refreshToken
      }
    });

    // TODO: Send welcome email with verification link

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { email, password, deviceInfo, forceLogin } = value;

    // Find user
    const userResult = await pool.query(
      'SELECT id, name, email, phone, business_name, password_hash, is_email_verified, created_at FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = userResult.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Get active subscription
    // First check if is_trial column exists
    const columnCheck = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'user_subscriptions' AND column_name = 'is_trial'`
    );
    
    const hasIsTrialColumn = columnCheck.rows.length > 0;
    
    const subscriptionQuery = hasIsTrialColumn
      ? `SELECT id, plan, status, start_date, end_date, grace_period_end, is_trial
         FROM user_subscriptions 
         WHERE user_id = $1 
         AND (status IN ('active', 'expired', 'trial', 'grace_period') OR end_date > NOW())
         ORDER BY end_date DESC
         LIMIT 1`
      : `SELECT id, plan, status, start_date, end_date, grace_period_end, false as is_trial
         FROM user_subscriptions 
         WHERE user_id = $1 
         AND (status IN ('active', 'expired', 'trial', 'grace_period') OR end_date > NOW())
         ORDER BY end_date DESC
         LIMIT 1`;
    
    const subscriptionResult = await pool.query(subscriptionQuery, [user.id]);

    let subscription = null;
    if (subscriptionResult.rows.length > 0) {
      const sub = subscriptionResult.rows[0];
      const endDate = new Date(sub.end_date);
      const now = new Date();
      const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      
      // Correct subscription status based on dates
      let actualStatus = sub.status;
      if (endDate > now && sub.status === 'expired') {
        // Subscription end date is in future but marked as expired - fix it
        actualStatus = 'active';
        await pool.query(
          'UPDATE user_subscriptions SET status = $1, updated_at = NOW() WHERE id = $2',
          ['active', sub.id]
        );
      } else if (endDate <= now && (sub.status === 'active' || sub.status === 'trial')) {
        // Subscription has expired but still marked as active - fix it
        actualStatus = 'expired';
        await pool.query(
          'UPDATE user_subscriptions SET status = $1, updated_at = NOW() WHERE id = $2',
          ['expired', sub.id]
        );
      }
      
      // Normalize plan name (remove _monthly, _quarterly, _yearly suffixes)
      const planType = sub.plan.replace(/_monthly|_quarterly|_yearly/g, '');
      
      subscription = {
        id: sub.id,
        plan: planType,
        status: actualStatus,
        startDate: new Date(sub.start_date).getTime(),
        endDate: new Date(sub.end_date).getTime(),
        gracePeriodEnd: sub.grace_period_end ? new Date(sub.grace_period_end).getTime() : null,
        isInGracePeriod: sub.grace_period_end && new Date() <= new Date(sub.grace_period_end),
        daysRemaining: Math.max(0, daysRemaining),
        isTrial: sub.is_trial || false,
        trialDaysRemaining: sub.is_trial ? Math.max(0, daysRemaining) : 0,
        version: Date.now() // Add version for change detection
      };
    } else {
      // First-time login - create 7-day trial
      const trialStart = new Date();
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);
      
      // Check if user has ever had a trial
      const trialCheckQuery = hasIsTrialColumn
        ? `SELECT COUNT(*) as trial_count FROM user_subscriptions WHERE user_id = $1 AND is_trial = true`
        : `SELECT COUNT(*) as trial_count FROM user_subscriptions WHERE user_id = $1 AND plan = 'platinum' AND status = 'trial'`;
      
      const trialCheck = await pool.query(trialCheckQuery, [user.id]);
      const hadTrial = trialCheck.rows[0].trial_count > 0;
      
      if (!hadTrial) {
        // Create trial subscription
        const createTrialQuery = hasIsTrialColumn
          ? `INSERT INTO user_subscriptions (user_id, plan, status, start_date, end_date, is_trial, created_at, updated_at)
             VALUES ($1, 'platinum', 'active', $2, $3, true, NOW(), NOW())
             RETURNING id, plan, status, start_date, end_date, is_trial`
          : `INSERT INTO user_subscriptions (user_id, plan, status, start_date, end_date, created_at, updated_at)
             VALUES ($1, 'platinum', 'trial', $2, $3, NOW(), NOW())
             RETURNING id, plan, status, start_date, end_date, 'true' as is_trial`;
        
        const trialResult = await pool.query(createTrialQuery, [user.id, trialStart, trialEnd]);
        const trial = trialResult.rows[0];
        
        subscription = {
          id: trial.id,
          plan: trial.plan,
          status: trial.status,
          startDate: new Date(trial.start_date).getTime(),
          endDate: new Date(trial.end_date).getTime(),
          gracePeriodEnd: null,
          isInGracePeriod: false,
          daysRemaining: 7,
          isTrial: true,
          trialDaysRemaining: 7,
          version: Date.now()
        };
      }
    }

    // Create session if device info provided (single device login)
    let sessionId = null;
    let sessionToken = null;
    
    if (deviceInfo && forceLogin) {
      // Create new session (will invalidate other sessions)
      const session = await SessionService.createSession(user.id, deviceInfo);
      sessionId = session.sessionId;
      sessionToken = session.sessionToken;
    }
    
    // Check if user is admin
    const isAdmin = user.email === 'deepanshuverma966@gmail.com';
    if (isAdmin) {
      // Update user role if needed
      await pool.query('UPDATE users SET role = $1 WHERE id = $2 AND role IS DISTINCT FROM $1', ['admin', user.id]);
    }

    // Generate tokens with session info
    const token = generateToken(user.id, sessionId);
    const refreshToken = generateRefreshToken(user.id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          businessName: user.business_name,
          isEmailVerified: user.is_email_verified,
          createdAt: user.created_at
        },
        subscription,
        token,
        refreshToken,
        sessionId,
        isAdmin
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Generate new tokens
    const newToken = generateToken(decoded.userId);
    const newRefreshToken = generateRefreshToken(decoded.userId);

    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
});

// Refresh subscription status (lightweight endpoint)
router.get('/subscription-refresh', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    // Get active subscription with auto-correction
    const subscriptionResult = await pool.query(
      `SELECT id, plan, status, start_date, end_date, grace_period_end, is_trial
       FROM user_subscriptions 
       WHERE user_id = $1 
       AND (status IN ('active', 'expired', 'trial', 'grace_period') OR end_date > NOW())
       ORDER BY end_date DESC
       LIMIT 1`,
      [userId]
    );

    if (subscriptionResult.rows.length > 0) {
      const sub = subscriptionResult.rows[0];
      
      // Auto-correct subscription status based on dates
      if (sub.end_date && new Date(sub.end_date) > new Date()) {
        // If end_date is in future but status is not active, fix it
        if (sub.status !== 'active' && sub.status !== 'trial') {
          await pool.query(
            'UPDATE user_subscriptions SET status = $1 WHERE id = $2',
            ['active', sub.id]
          );
          sub.status = 'active';
        }
      } else if (sub.end_date && new Date(sub.end_date) <= new Date()) {
        // If end_date is past but status is still active, fix it
        if (sub.status === 'active' || sub.status === 'trial') {
          await pool.query(
            'UPDATE user_subscriptions SET status = $1 WHERE id = $2',
            ['expired', sub.id]
          );
          sub.status = 'expired';
        }
      }
      
      // Normalize plan name
      const planType = sub.plan.replace(/_monthly|_quarterly|_yearly/g, '');
      
      // Calculate days remaining
      const now = new Date();
      const endDate = new Date(sub.end_date);
      const daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
      
      const subscription = {
        id: sub.id,
        plan: planType,
        planDisplayName: planType.charAt(0).toUpperCase() + planType.slice(1),
        tierLevel: planType === 'trial' ? 'platinum' : planType,
        status: sub.status,
        isTrial: sub.is_trial || sub.plan === 'trial',
        startDate: new Date(sub.start_date).getTime(),
        endDate: new Date(sub.end_date).getTime(),
        gracePeriodEnd: sub.grace_period_end ? new Date(sub.grace_period_end).getTime() : null,
        isInGracePeriod: sub.status === 'grace_period',
        daysRemaining: daysRemaining,
        graceDaysRemaining: 0,
        features: {
          hasInventory: ['gold', 'platinum', 'trial'].includes(planType),
          hasTaxReports: ['gold', 'platinum', 'trial'].includes(planType),
          hasCustomerReports: ['gold', 'platinum', 'trial'].includes(planType),
          hasUserReports: ['platinum', 'trial'].includes(planType),
          hasKotBilling: ['platinum', 'trial'].includes(planType),
          maxUsers: planType === 'platinum' ? 5 : planType === 'gold' ? 3 : 1
        },
        autoRenew: false,
        version: Date.now() // Add version for change detection
      };
      
      res.json({
        success: true,
        subscription
      });
    } else {
      // No subscription
      res.json({
        success: true,
        subscription: null
      });
    }
  } catch (error) {
    console.error('Subscription refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Error refreshing subscription'
    });
  }
});

module.exports = router;