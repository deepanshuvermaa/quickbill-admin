const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Admin check middleware
const isAdmin = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const userResult = await pool.query(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const adminEmails = ['deepanshuverma966@gmail.com']; // Add more admin emails as needed
    if (!adminEmails.includes(userResult.rows[0].email)) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Activate subscription
router.post('/activate/:userId', authenticateToken, isAdmin, async (req, res) => {
  const { userId } = req.params;
  const { plan = 'platinum', days = 30 } = req.body;
  
  try {
    // Check if user exists
    const userCheck = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const user = userCheck.rows[0];
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    
    // Deactivate any existing subscriptions
    await pool.query(
      'UPDATE user_subscriptions SET status = $1, updated_at = NOW() WHERE user_id = $2 AND status = $3',
      ['cancelled', userId, 'active']
    );
    
    // Create new active subscription
    const result = await pool.query(
      `INSERT INTO user_subscriptions (user_id, plan, status, start_date, end_date, is_trial, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [userId, plan, 'active', startDate, endDate, false]
    );
    
    res.json({
      success: true,
      message: `Subscription activated for ${user.name}`,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error activating subscription:', error);
    res.status(500).json({ success: false, message: 'Failed to activate subscription' });
  }
});

// Deactivate subscription
router.post('/deactivate/:userId', authenticateToken, isAdmin, async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      `UPDATE user_subscriptions 
       SET status = 'cancelled', updated_at = NOW() 
       WHERE user_id = $1 AND status IN ('active', 'trial')
       RETURNING *`,
      [userId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'No active subscription found' });
    }
    
    res.json({
      success: true,
      message: 'Subscription deactivated',
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error deactivating subscription:', error);
    res.status(500).json({ success: false, message: 'Failed to deactivate subscription' });
  }
});

// Extend subscription
router.post('/extend/:userId', authenticateToken, isAdmin, async (req, res) => {
  const { userId } = req.params;
  const { days = 30 } = req.body;
  
  try {
    // Get current subscription
    const currentSub = await pool.query(
      `SELECT * FROM user_subscriptions 
       WHERE user_id = $1 AND status IN ('active', 'trial', 'expired')
       ORDER BY end_date DESC LIMIT 1`,
      [userId]
    );
    
    if (currentSub.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No subscription found' });
    }
    
    const sub = currentSub.rows[0];
    const currentEndDate = new Date(sub.end_date);
    const now = new Date();
    
    // If expired, extend from today; otherwise extend from current end date
    const baseDate = currentEndDate > now ? currentEndDate : now;
    const newEndDate = new Date(baseDate);
    newEndDate.setDate(newEndDate.getDate() + days);
    
    // Update subscription
    const result = await pool.query(
      `UPDATE user_subscriptions 
       SET end_date = $1, status = 'active', updated_at = NOW() 
       WHERE id = $2
       RETURNING *`,
      [newEndDate, sub.id]
    );
    
    res.json({
      success: true,
      message: `Subscription extended by ${days} days`,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error extending subscription:', error);
    res.status(500).json({ success: false, message: 'Failed to extend subscription' });
  }
});

// Change subscription plan
router.post('/change-plan/:userId', authenticateToken, isAdmin, async (req, res) => {
  const { userId } = req.params;
  const { plan } = req.body;
  
  if (!plan) {
    return res.status(400).json({ success: false, message: 'Plan is required' });
  }
  
  try {
    const result = await pool.query(
      `UPDATE user_subscriptions 
       SET plan = $1, updated_at = NOW() 
       WHERE user_id = $2 AND status IN ('active', 'trial')
       RETURNING *`,
      [plan, userId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'No active subscription found' });
    }
    
    res.json({
      success: true,
      message: `Plan changed to ${plan}`,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error changing plan:', error);
    res.status(500).json({ success: false, message: 'Failed to change plan' });
  }
});

// Force refresh user subscription (clears any cache)
router.post('/force-refresh/:userId', authenticateToken, isAdmin, async (req, res) => {
  const { userId } = req.params;
  
  try {
    // Get user's current subscription
    const result = await pool.query(
      `SELECT us.*, u.name, u.email 
       FROM user_subscriptions us
       JOIN users u ON us.user_id = u.id
       WHERE us.user_id = $1 
       AND (us.status IN ('active', 'trial') OR us.end_date > NOW())
       ORDER BY us.end_date DESC LIMIT 1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No active subscription found' });
    }
    
    const subscription = result.rows[0];
    
    // Correct status if needed
    const now = new Date();
    const endDate = new Date(subscription.end_date);
    
    if (endDate > now && subscription.status !== 'active' && subscription.status !== 'trial') {
      await pool.query(
        'UPDATE user_subscriptions SET status = $1, updated_at = NOW() WHERE id = $2',
        ['active', subscription.id]
      );
      subscription.status = 'active';
    }
    
    res.json({
      success: true,
      message: 'Subscription refreshed. User should log out and log back in.',
      data: {
        user: {
          id: subscription.user_id,
          name: subscription.name,
          email: subscription.email
        },
        subscription: {
          id: subscription.id,
          plan: subscription.plan.replace(/_monthly|_quarterly|_yearly/g, ''),
          status: subscription.status,
          endDate: subscription.end_date,
          daysRemaining: Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))
        }
      }
    });
    
  } catch (error) {
    console.error('Error refreshing subscription:', error);
    res.status(500).json({ success: false, message: 'Failed to refresh subscription' });
  }
});

// Get subscription details for admin view
router.get('/subscription/:userId', authenticateToken, isAdmin, async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT us.*, u.name, u.email, u.phone, u.business_name
       FROM user_subscriptions us
       JOIN users u ON us.user_id = u.id
       WHERE us.user_id = $1
       ORDER BY us.created_at DESC`,
      [userId]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('Error getting subscription details:', error);
    res.status(500).json({ success: false, message: 'Failed to get subscription details' });
  }
});

module.exports = router;