const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token is required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    req.userId = user.userId;
    next();
  });
};

// Get subscription plans
router.get('/plans', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM subscription_plans WHERE is_active = true ORDER BY price_monthly ASC'
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user's current subscription status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT us.*, sp.display_name as plan_display_name, sp.features
       FROM user_subscriptions us
       LEFT JOIN subscription_plans sp ON us.plan = sp.name
       WHERE us.user_id = $1 AND us.status IN ('active', 'expired')
       ORDER BY us.created_at DESC
       LIMIT 1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No active subscription found'
      });
    }

    const subscription = result.rows[0];
    const now = new Date();
    const endDate = new Date(subscription.end_date);
    const gracePeriodEnd = subscription.grace_period_end ? new Date(subscription.grace_period_end) : null;
    
    // Calculate days remaining
    const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    
    // Update status if expired
    let currentStatus = subscription.status;
    let isInGracePeriod = false;
    
    if (now > endDate && currentStatus === 'active') {
      // Subscription expired, start grace period
      const gracePeriodEndDate = new Date(endDate.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days grace
      
      await pool.query(
        'UPDATE user_subscriptions SET status = $1, grace_period_end = $2, updated_at = NOW() WHERE id = $3',
        ['expired', gracePeriodEndDate, subscription.id]
      );
      
      currentStatus = 'expired';
      isInGracePeriod = now <= gracePeriodEndDate;
    } else if (gracePeriodEnd && now <= gracePeriodEnd) {
      isInGracePeriod = true;
    }

    res.json({
      success: true,
      data: {
        id: subscription.id,
        plan: subscription.plan,
        planDisplayName: subscription.plan_display_name,
        status: currentStatus,
        startDate: subscription.start_date,
        endDate: subscription.end_date,
        gracePeriodEnd: subscription.grace_period_end,
        isInGracePeriod,
        daysRemaining: Math.max(0, daysRemaining),
        features: subscription.features,
        autoRenew: subscription.auto_renew
      }
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create payment order (for Razorpay integration)
router.post('/create-order', authenticateToken, async (req, res) => {
  try {
    const schema = Joi.object({
      plan: Joi.string().valid('monthly', 'quarterly', 'yearly').required(),
      paymentMethod: Joi.string().default('razorpay')
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { plan, paymentMethod } = value;

    // Get plan details
    const planResult = await pool.query(
      'SELECT * FROM subscription_plans WHERE name = $1 AND is_active = true',
      [plan]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    const planDetails = planResult.rows[0];
    const amount = planDetails[`price_${plan}`] || planDetails.price_monthly;

    // Create payment transaction record
    const transactionResult = await pool.query(
      `INSERT INTO payment_transactions (user_id, payment_gateway, amount, currency, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, amount, currency`,
      [req.userId, paymentMethod, amount, 'INR', 'pending']
    );

    const transaction = transactionResult.rows[0];

    // TODO: Integrate with Razorpay to create actual order
    // For now, return a mock order
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    res.json({
      success: true,
      data: {
        orderId,
        amount: transaction.amount,
        currency: transaction.currency,
        transactionId: transaction.id,
        plan: planDetails
      }
    });
  } catch (error) {
    console.error('Error creating payment order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Verify payment and activate subscription
router.post('/verify-payment', authenticateToken, async (req, res) => {
  try {
    const schema = Joi.object({
      transactionId: Joi.number().required(),
      paymentId: Joi.string().required(),
      orderId: Joi.string().required(),
      signature: Joi.string().required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { transactionId, paymentId, orderId, signature } = value;

    // TODO: Verify payment with Razorpay
    // For now, simulate successful payment verification

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Update payment transaction
      await client.query(
        `UPDATE payment_transactions 
         SET status = $1, gateway_transaction_id = $2, gateway_response = $3, processed_at = NOW(), updated_at = NOW()
         WHERE id = $4 AND user_id = $5`,
        ['completed', paymentId, JSON.stringify({ orderId, signature }), transactionId, req.userId]
      );

      // Get transaction details
      const transactionResult = await client.query(
        'SELECT * FROM payment_transactions WHERE id = $1',
        [transactionId]
      );

      if (transactionResult.rows.length === 0) {
        throw new Error('Transaction not found');
      }

      const transaction = transactionResult.rows[0];

      // Determine plan based on amount (this is a simplified approach)
      let plan = 'monthly';
      if (transaction.amount >= 2999) plan = 'yearly';
      else if (transaction.amount >= 799) plan = 'quarterly';

      // Get plan duration
      const planResult = await client.query(
        'SELECT duration_days FROM subscription_plans WHERE name = $1',
        [plan]
      );

      const durationDays = planResult.rows[0]?.duration_days || 30;

      // Create new subscription
      const subscriptionResult = await client.query(
        `INSERT INTO user_subscriptions (user_id, plan, status, start_date, end_date, payment_id, amount_paid, currency, auto_renew, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '${durationDays} days', $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [req.userId, plan, 'active', paymentId, transaction.amount, transaction.currency, true]
      );

      await client.query('COMMIT');

      const subscription = subscriptionResult.rows[0];

      res.json({
        success: true,
        message: 'Payment verified and subscription activated',
        data: {
          subscription: {
            id: subscription.id,
            plan: subscription.plan,
            status: subscription.status,
            startDate: subscription.start_date,
            endDate: subscription.end_date,
            daysRemaining: durationDays
          }
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed'
    });
  }
});

// Cancel subscription
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE user_subscriptions 
       SET auto_renew = false, cancelled_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'
       RETURNING *`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    res.json({
      success: true,
      message: 'Subscription cancelled successfully. You can continue using the service until the end of your billing period.'
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;