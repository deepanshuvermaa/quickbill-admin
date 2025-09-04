const express = require('express');
const router = express.Router();
const pool = require('../db');

// Public endpoint to verify subscription by email
router.get('/verify/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    // Get user and subscription
    const result = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        us.plan,
        us.status,
        us.start_date,
        us.end_date,
        us.is_trial,
        CASE 
          WHEN us.end_date > NOW() THEN true
          ELSE false
        END as is_valid,
        EXTRACT(DAY FROM us.end_date - NOW()) as days_remaining
      FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id
      WHERE u.email = $1
        AND (us.status = 'active' OR us.end_date > NOW())
      ORDER BY us.end_date DESC
      LIMIT 1
    `, [email.toLowerCase()]);
    
    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: 'No active subscription found for this email',
        email: email.toLowerCase()
      });
    }
    
    const subscription = result.rows[0];
    
    res.json({
      success: true,
      user: {
        name: subscription.name,
        email: subscription.email
      },
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        isValid: subscription.is_valid,
        daysRemaining: parseInt(subscription.days_remaining),
        endDate: subscription.end_date,
        isTrial: subscription.is_trial
      },
      message: subscription.is_valid 
        ? `Active ${subscription.plan} subscription with ${subscription.days_remaining} days remaining`
        : 'Subscription has expired'
    });
    
  } catch (error) {
    console.error('Subscription verify error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking subscription'
    });
  }
});

module.exports = router;