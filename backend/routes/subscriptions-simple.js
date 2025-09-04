const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const Joi = require('joi');

// Simple payment submission without order creation
router.post('/submit-payment-simple', authenticateToken, async (req, res) => {
  try {
    const schema = Joi.object({
      planId: Joi.number().required(),
      planName: Joi.string().required(),
      amount: Joi.number().required(),
      transactionReference: Joi.string().required(),
      paymentMethod: Joi.string().default('upi_manual'),
      userName: Joi.string().optional(),
      userEmail: Joi.string().email().optional(),
      userPhone: Joi.string().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { planId, planName, amount, transactionReference, paymentMethod } = value;
    const userId = req.userId;

    // Create a simple payment record
    const result = await pool.query(
      `INSERT INTO manual_payments (
        user_id, plan_id, amount, payment_method, 
        transaction_reference, verification_status, 
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id`,
      [userId, planId, amount, paymentMethod, transactionReference, 'pending']
    );

    res.json({
      success: true,
      message: 'Payment submitted successfully. It will be verified within 24 hours.',
      data: {
        paymentId: result.rows[0].id,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Error submitting payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit payment'
    });
  }
});

// Get pending payments (for admin)
router.get('/pending-payments', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const userResult = await pool.query(
      'SELECT email FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (!userResult.rows[0] || userResult.rows[0].email.toLowerCase() !== 'deepanshuverma966@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const result = await pool.query(
      `SELECT 
        mp.id,
        mp.user_id as "userId",
        u.name as "userName",
        u.email as "userEmail",
        u.phone as "userPhone",
        mp.plan_id as "planId",
        sp.display_name as "planName",
        mp.amount,
        mp.transaction_reference as "transactionRef",
        mp.verification_status as status,
        mp.created_at as "submittedAt"
      FROM manual_payments mp
      JOIN users u ON mp.user_id = u.id
      JOIN subscription_plans sp ON mp.plan_id = sp.id
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
      message: 'Failed to fetch pending payments'
    });
  }
});

// Get all subscriptions with user details (for admin)
router.get('/subscriptions-detailed', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const userResult = await pool.query(
      'SELECT email FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (!userResult.rows[0] || userResult.rows[0].email.toLowerCase() !== 'deepanshuverma966@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const result = await pool.query(
      `SELECT * FROM user_subscriptions_detailed 
       ORDER BY created_at DESC 
       LIMIT 100`
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscriptions'
    });
  }
});

// Get active subscriptions with user details (for admin)
router.get('/active-subscriptions', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const userResult = await pool.query(
      'SELECT email FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (!userResult.rows[0] || userResult.rows[0].email.toLowerCase() !== 'deepanshuverma966@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const result = await pool.query(
      `SELECT * FROM active_subscriptions_detailed 
       ORDER BY days_remaining ASC`
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching active subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active subscriptions'
    });
  }
});

// Verify payment (for admin)
router.post('/verify-payment/:paymentId', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const userResult = await pool.query(
      'SELECT email FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (!userResult.rows[0] || userResult.rows[0].email.toLowerCase() !== 'deepanshuverma966@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { paymentId } = req.params;
    const { status, reason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be approved or rejected'
      });
    }

    // Get payment details
    const paymentResult = await pool.query(
      `SELECT mp.*, sp.duration_days, sp.display_name
       FROM manual_payments mp
       JOIN subscription_plans sp ON mp.plan_id = sp.id
       WHERE mp.id = $1`,
      [paymentId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    const payment = paymentResult.rows[0];

    // Update payment status
    await pool.query(
      `UPDATE manual_payments 
       SET verification_status = $1, verified_at = NOW(), verified_by = $2
       WHERE id = $3`,
      [status, req.userId, paymentId]
    );

    // If approved, create subscription
    if (status === 'approved') {
      // Check for existing active subscription
      const existingSub = await pool.query(
        `SELECT id FROM user_subscriptions 
         WHERE user_id = $1 AND status = 'active'`,
        [payment.user_id]
      );

      if (existingSub.rows.length > 0) {
        // Update existing subscription
        await pool.query(
          `UPDATE user_subscriptions 
           SET end_date = end_date + INTERVAL '${payment.duration_days} days',
               plan = $2,
               updated_at = NOW()
           WHERE id = $1`,
          [existingSub.rows[0].id, payment.display_name]
        );
      } else {
        // Create new subscription
        await pool.query(
          `INSERT INTO user_subscriptions (
            user_id, plan, status, start_date, end_date, 
            created_at, updated_at
          ) VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '${payment.duration_days} days', NOW(), NOW())`,
          [payment.user_id, payment.display_name]
        );
      }
    }

    res.json({
      success: true,
      message: `Payment ${status} successfully`
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment'
    });
  }
});

module.exports = router;