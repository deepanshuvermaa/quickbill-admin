const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const crypto = require('crypto');
const QRCode = require('qrcode');
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

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  const adminToken = req.headers['x-admin-token'];
  
  if (!adminToken || adminToken !== process.env.ADMIN_SECRET_TOKEN) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  
  next();
};

// Get subscription plans with detailed features
router.get('/plans', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sp.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'key', sf.feature_key,
              'name', sf.feature_name,
              'enabled', sf.is_enabled,
              'limit', sf.limit_value
            ) ORDER BY sf.id
          ) FILTER (WHERE sf.id IS NOT NULL), 
          '[]'::json
        ) as detailed_features
       FROM subscription_plans sp
       LEFT JOIN subscription_features sf ON sp.id = sf.plan_id
       WHERE sp.is_active = true
       GROUP BY sp.id
       ORDER BY sp.priority ASC`
    );

    // Transform data for frontend
    const plans = result.rows.map(plan => ({
      id: plan.id,
      name: plan.name,
      displayName: plan.display_name,
      tierLevel: plan.tier_level,
      price: plan.price_monthly,
      duration: plan.duration_days,
      features: plan.detailed_features,
      maxUsers: plan.max_users,
      hasInventory: plan.has_inventory,
      hasTaxReports: plan.has_tax_reports,
      hasCustomerReports: plan.has_customer_reports,
      hasUserReports: plan.has_user_reports,
      hasKotBilling: plan.has_kot_billing,
      printerSupport: plan.printer_support,
      highlight: plan.features?.highlight || ''
    }));

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user's current subscription status with grace period handling
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT us.*, sp.display_name as plan_display_name, sp.tier_level, sp.features,
        sp.has_inventory, sp.has_tax_reports, sp.has_customer_reports, 
        sp.has_user_reports, sp.has_kot_billing, sp.max_users
       FROM user_subscriptions us
       LEFT JOIN subscription_plans sp ON us.plan = sp.name
       WHERE us.user_id = $1 
       ORDER BY us.created_at DESC
       LIMIT 1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      // Create trial subscription for new users
      const trialResult = await pool.query(
        `INSERT INTO user_subscriptions (
          user_id, plan, status, is_trial, trial_days, 
          start_date, end_date, created_at, updated_at
        ) VALUES (
          $1, 'platinum', 'active', true, 7,
          NOW(), NOW() + INTERVAL '7 days', NOW(), NOW()
        ) RETURNING *`,
        [req.userId]
      );
      
      const subscription = trialResult.rows[0];
      return res.json({
        success: true,
        data: {
          id: subscription.id,
          plan: 'platinum',
          planDisplayName: 'Platinum Plan (7-Day Trial)',
          tierLevel: 'platinum',
          status: 'active',
          isTrial: true,
          trialDaysRemaining: 7,
          startDate: subscription.start_date,
          endDate: subscription.end_date,
          features: {
            hasInventory: true,
            hasTaxReports: true,
            hasCustomerReports: true,
            hasUserReports: true,
            hasKotBilling: true,
            maxUsers: 1
          }
        }
      });
    }

    const subscription = result.rows[0];
    const now = new Date();
    const endDate = new Date(subscription.end_date);
    const gracePeriodEnd = subscription.grace_period_end ? new Date(subscription.grace_period_end) : null;
    
    // Calculate days remaining
    let daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    let graceDaysRemaining = 0;
    
    // Handle trial expiry
    if (subscription.is_trial && now > endDate && subscription.status === 'active') {
      await pool.query(
        'UPDATE user_subscriptions SET status = $1, updated_at = NOW() WHERE id = $2',
        ['expired', subscription.id]
      );
      subscription.status = 'expired';
    }
    
    // Handle grace period for paid subscriptions
    if (!subscription.is_trial && now > endDate && subscription.status === 'active') {
      const gracePeriodEndDate = new Date(endDate.getTime() + (4 * 24 * 60 * 60 * 1000)); // 4 days grace
      
      await pool.query(
        'UPDATE user_subscriptions SET status = $1, grace_period_end = $2, updated_at = NOW() WHERE id = $3',
        ['grace_period', gracePeriodEndDate, subscription.id]
      );
      
      subscription.status = 'grace_period';
      subscription.grace_period_end = gracePeriodEndDate;
      graceDaysRemaining = Math.ceil((gracePeriodEndDate - now) / (1000 * 60 * 60 * 24));
      
      // Create grace period notification log
      await pool.query(
        `INSERT INTO grace_period_logs (user_id, subscription_id, notification_day, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT DO NOTHING`,
        [req.userId, subscription.id, 5 - graceDaysRemaining]
      );
    }
    
    // Check if grace period has expired
    if (subscription.status === 'grace_period' && gracePeriodEnd && now > gracePeriodEnd) {
      await pool.query(
        'UPDATE user_subscriptions SET status = $1, updated_at = NOW() WHERE id = $2',
        ['expired', subscription.id]
      );
      subscription.status = 'expired';
    }

    res.json({
      success: true,
      data: {
        id: subscription.id,
        plan: subscription.plan,
        planDisplayName: subscription.plan_display_name,
        tierLevel: subscription.tier_level,
        status: subscription.status,
        isTrial: subscription.is_trial,
        trialDaysRemaining: subscription.is_trial ? Math.max(0, daysRemaining) : null,
        startDate: subscription.start_date,
        endDate: subscription.end_date,
        gracePeriodEnd: subscription.grace_period_end,
        daysRemaining: Math.max(0, daysRemaining),
        graceDaysRemaining: graceDaysRemaining,
        features: {
          hasInventory: subscription.has_inventory,
          hasTaxReports: subscription.has_tax_reports,
          hasCustomerReports: subscription.has_customer_reports,
          hasUserReports: subscription.has_user_reports,
          hasKotBilling: subscription.has_kot_billing,
          maxUsers: subscription.max_users
        },
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

// Create payment order with multiple payment methods
router.post('/create-order', authenticateToken, async (req, res) => {
  try {
    const schema = Joi.object({
      planId: Joi.number().required(),
      paymentMethod: Joi.string().valid('razorpay', 'upi_qr', 'paytm', 'phonepe', 'googlepay').required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { planId, paymentMethod } = value;

    // Get plan details
    const planResult = await pool.query(
      'SELECT * FROM subscription_plans WHERE id = $1 AND is_active = true',
      [planId]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    const planDetails = planResult.rows[0];
    const amount = planDetails.price_monthly;

    // Create payment transaction record
    const transactionResult = await pool.query(
      `INSERT INTO payment_transactions (
        user_id, payment_gateway, amount, currency, status, 
        payment_type, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id`,
      [req.userId, paymentMethod, amount, 'INR', 'pending', 
       paymentMethod === 'razorpay' ? 'automatic' : 'manual']
    );

    const transactionId = transactionResult.rows[0].id;

    if (paymentMethod === 'razorpay') {
      // TODO: Integrate with Razorpay
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      res.json({
        success: true,
        data: {
          orderId,
          amount,
          currency: 'INR',
          transactionId,
          paymentMethod: 'razorpay'
        }
      });
    } else {
      // Generate UPI QR code for manual payment
      const upiId = process.env.UPI_ID || 'quickbill@paytm';
      const merchantName = process.env.MERCHANT_NAME || 'QuickBill';
      const transactionNote = `QuickBill ${planDetails.display_name}`;
      
      // UPI payment string format
      const upiString = `upi://pay?pa=${upiId}&pn=${merchantName}&am=${amount}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
      
      // Generate QR code
      const qrCodeData = await QRCode.toDataURL(upiString);
      
      // Create manual payment record
      const manualPaymentResult = await pool.query(
        `INSERT INTO manual_payments (
          user_id, amount, payment_method, qr_code_data, 
          verification_status, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING id`,
        [req.userId, amount, paymentMethod, qrCodeData, 'pending']
      );
      
      const manualPaymentId = manualPaymentResult.rows[0].id;
      
      // Update payment transaction with manual payment ID
      await pool.query(
        'UPDATE payment_transactions SET manual_payment_id = $1 WHERE id = $2',
        [manualPaymentId, transactionId]
      );
      
      res.json({
        success: true,
        data: {
          transactionId,
          manualPaymentId,
          amount,
          currency: 'INR',
          paymentMethod,
          qrCode: qrCodeData,
          upiId,
          merchantName,
          instructions: `Please scan the QR code and complete the payment of ₹${amount}. After payment, enter the transaction reference number.`
        }
      });
    }
  } catch (error) {
    console.error('Error creating payment order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Submit manual payment reference
router.post('/submit-payment-reference', authenticateToken, async (req, res) => {
  try {
    const schema = Joi.object({
      manualPaymentId: Joi.number().required(),
      transactionReference: Joi.string().required(),
      screenshotUrl: Joi.string().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { manualPaymentId, transactionReference, screenshotUrl } = value;

    // Update manual payment record
    const result = await pool.query(
      `UPDATE manual_payments 
       SET transaction_reference = $1, screenshot_url = $2, updated_at = NOW()
       WHERE id = $3 AND user_id = $4 AND verification_status = 'pending'
       RETURNING *`,
      [transactionReference, screenshotUrl, manualPaymentId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found or already processed'
      });
    }

    res.json({
      success: true,
      message: 'Payment reference submitted successfully. Your payment will be verified within 24 hours.',
      data: {
        manualPaymentId,
        status: 'pending_verification'
      }
    });
  } catch (error) {
    console.error('Error submitting payment reference:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Admin: Get pending manual payments
router.get('/admin/pending-payments', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT mp.*, u.email, u.name, u.business_name,
        pt.amount as transaction_amount, sp.display_name as plan_name
       FROM manual_payments mp
       JOIN users u ON mp.user_id = u.id
       LEFT JOIN payment_transactions pt ON pt.manual_payment_id = mp.id
       LEFT JOIN subscription_plans sp ON sp.price_monthly = mp.amount
       WHERE mp.verification_status = 'pending'
       ORDER BY mp.created_at DESC`
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching pending payments:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Admin: Verify manual payment
router.post('/admin/verify-payment', authenticateAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const schema = Joi.object({
      manualPaymentId: Joi.number().required(),
      action: Joi.string().valid('approve', 'reject').required(),
      rejectionReason: Joi.string().when('action', {
        is: 'reject',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      adminNotes: Joi.string().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { manualPaymentId, action, rejectionReason, adminNotes } = value;

    await client.query('BEGIN');

    // Get payment details
    const paymentResult = await client.query(
      `SELECT mp.*, pt.id as transaction_id, pt.user_id
       FROM manual_payments mp
       JOIN payment_transactions pt ON pt.manual_payment_id = mp.id
       WHERE mp.id = $1`,
      [manualPaymentId]
    );

    if (paymentResult.rows.length === 0) {
      throw new Error('Payment not found');
    }

    const payment = paymentResult.rows[0];

    if (action === 'approve') {
      // Update manual payment
      await client.query(
        `UPDATE manual_payments 
         SET verification_status = 'verified', verified_by = $1, verified_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        ['admin', manualPaymentId]
      );

      // Update payment transaction
      await client.query(
        `UPDATE payment_transactions 
         SET status = 'completed', processed_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [payment.transaction_id]
      );

      // Get plan based on amount
      const planResult = await client.query(
        'SELECT * FROM subscription_plans WHERE price_monthly = $1',
        [payment.amount]
      );

      if (planResult.rows.length === 0) {
        throw new Error('No matching plan found for payment amount');
      }

      const plan = planResult.rows[0];

      // Create subscription
      await client.query(
        `INSERT INTO user_subscriptions (
          user_id, plan, status, is_trial, start_date, end_date, 
          payment_id, amount_paid, currency, created_at, updated_at
        ) VALUES (
          $1, $2, 'active', false, NOW(), NOW() + INTERVAL '${plan.duration_days} days',
          $3, $4, 'INR', NOW(), NOW()
        )`,
        [payment.user_id, plan.name, payment.transaction_reference, payment.amount]
      );

      // Log admin action
      await client.query(
        `INSERT INTO admin_controls (
          user_id, action, new_value, admin_notes, performed_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [payment.user_id, 'verify_payment', 
         JSON.stringify({ manualPaymentId, action, amount: payment.amount }), 
         adminNotes, 'admin']
      );

    } else {
      // Reject payment
      await client.query(
        `UPDATE manual_payments 
         SET verification_status = 'rejected', rejection_reason = $1, 
             verified_by = $2, verified_at = NOW(), updated_at = NOW()
         WHERE id = $3`,
        [rejectionReason, 'admin', manualPaymentId]
      );

      await client.query(
        `UPDATE payment_transactions 
         SET status = 'failed', updated_at = NOW()
         WHERE id = $1`,
        [payment.transaction_id]
      );

      // Log admin action
      await client.query(
        `INSERT INTO admin_controls (
          user_id, action, new_value, admin_notes, performed_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [payment.user_id, 'reject_payment', 
         JSON.stringify({ manualPaymentId, action, rejectionReason }), 
         adminNotes, 'admin']
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Payment ${action === 'approve' ? 'approved' : 'rejected'} successfully`
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error verifying manual payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  } finally {
    client.release();
  }
});

// Admin: Update user subscription
router.post('/admin/update-subscription', authenticateAdmin, async (req, res) => {
  try {
    const schema = Joi.object({
      userId: Joi.number().required(),
      action: Joi.string().valid('extend_subscription', 'change_plan', 'reset_trial', 'activate_subscription').required(),
      value: Joi.object().required(),
      adminNotes: Joi.string().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { userId, action, value: actionValue, adminNotes } = value;

    // Call the admin update function
    const result = await pool.query(
      'SELECT admin_update_subscription($1, $2, $3, $4, $5) as result',
      [userId, action, JSON.stringify(actionValue), adminNotes, 'admin']
    );

    res.json({
      success: true,
      message: 'Subscription updated successfully',
      data: result.rows[0].result
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get grace period notifications
router.get('/grace-notifications', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM grace_period_logs 
       WHERE user_id = $1 AND user_acknowledged = false
       ORDER BY created_at DESC`,
      [req.userId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching grace notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Acknowledge grace period notification
router.post('/acknowledge-grace-notification', authenticateToken, async (req, res) => {
  try {
    const schema = Joi.object({
      notificationId: Joi.number().required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    await pool.query(
      `UPDATE grace_period_logs 
       SET user_acknowledged = true, acknowledged_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [value.notificationId, req.userId]
    );

    res.json({
      success: true,
      message: 'Notification acknowledged'
    });
  } catch (error) {
    console.error('Error acknowledging notification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Check feature access
router.get('/check-feature/:featureKey', authenticateToken, async (req, res) => {
  try {
    const { featureKey } = req.params;

    const result = await pool.query(
      `SELECT sf.is_enabled, sf.limit_value, us.status, us.is_trial, us.grace_period_end
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan = sp.name
       LEFT JOIN subscription_features sf ON sp.id = sf.plan_id AND sf.feature_key = $1
       WHERE us.user_id = $2 AND us.status IN ('active', 'grace_period')
       ORDER BY us.created_at DESC
       LIMIT 1`,
      [featureKey, req.userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          hasAccess: false,
          reason: 'no_subscription'
        }
      });
    }

    const feature = result.rows[0];
    const now = new Date();
    const isInGracePeriod = feature.status === 'grace_period' && 
                           feature.grace_period_end && 
                           now <= new Date(feature.grace_period_end);

    // During grace period, limit certain features
    const gracePeriodRestrictedFeatures = ['data_export', 'inventory_management'];
    const isRestricted = isInGracePeriod && gracePeriodRestrictedFeatures.includes(featureKey);

    res.json({
      success: true,
      data: {
        hasAccess: feature.is_enabled && !isRestricted,
        limit: feature.limit_value,
        isInGracePeriod,
        reason: !feature.is_enabled ? 'feature_not_in_plan' : 
                isRestricted ? 'grace_period_restriction' : null
      }
    });
  } catch (error) {
    console.error('Error checking feature access:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;