const express = require('express');
const { Pool } = require('pg');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const userId = req.userId;
    console.log('Admin check - userId:', userId);
    
    // Get user email
    const userResult = await pool.query(
      'SELECT id, email FROM users WHERE id = $1',
      [userId]
    );
    
    console.log('Admin check - user:', userResult.rows[0]);
    
    if (!userResult.rows[0] || userResult.rows[0].email.toLowerCase() !== 'deepanshuverma966@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Apply JWT auth first, then admin check
router.use(authenticateToken);
router.use(authenticateAdmin);

// Get all users with subscription details
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', status = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        u.id, u.name, u.email, u.phone, u.business_name, u.created_at,
        us.id as subscription_id, us.plan, us.status as subscription_status, 
        us.is_trial, us.start_date, us.end_date, us.grace_period_end,
        sp.display_name as plan_display_name, sp.tier_level
      FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id 
        AND us.id = (
          SELECT id FROM user_subscriptions 
          WHERE user_id = u.id 
          ORDER BY created_at DESC 
          LIMIT 1
        )
      LEFT JOIN subscription_plans sp ON us.plan = sp.name
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (search) {
      paramCount++;
      query += ` AND (u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount} OR u.business_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    
    if (status) {
      paramCount++;
      query += ` AND us.status = $${paramCount}`;
      params.push(status);
    }
    
    query += ` ORDER BY u.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Get total count
    let countQuery = `
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id
      WHERE 1=1
    `;
    
    const countParams = [];
    paramCount = 0;
    
    if (search) {
      paramCount++;
      countQuery += ` AND (u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount} OR u.business_name ILIKE $${paramCount})`;
      countParams.push(`%${search}%`);
    }
    
    if (status) {
      paramCount++;
      countQuery += ` AND us.status = $${paramCount}`;
      countParams.push(status);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    
    res.json({
      success: true,
      data: {
        users: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(countResult.rows[0].total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user details with full subscription history
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user details
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get subscription history
    const subscriptionsResult = await pool.query(
      `SELECT us.*, sp.display_name as plan_display_name
       FROM user_subscriptions us
       LEFT JOIN subscription_plans sp ON us.plan = sp.name
       WHERE us.user_id = $1
       ORDER BY us.created_at DESC`,
      [userId]
    );
    
    // Get payment history
    const paymentsResult = await pool.query(
      `SELECT pt.*, mp.transaction_reference, mp.payment_method as manual_method
       FROM payment_transactions pt
       LEFT JOIN manual_payments mp ON pt.manual_payment_id = mp.id
       WHERE pt.user_id = $1
       ORDER BY pt.created_at DESC`,
      [userId]
    );
    
    // Get admin actions history
    const adminActionsResult = await pool.query(
      `SELECT * FROM admin_controls 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );
    
    res.json({
      success: true,
      data: {
        user: userResult.rows[0],
        subscriptions: subscriptionsResult.rows,
        payments: paymentsResult.rows,
        adminActions: adminActionsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Dashboard statistics
router.get('/dashboard/stats', async (req, res) => {
  try {
    // Get subscription statistics
    const statsResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT CASE WHEN us.status = 'active' AND us.is_trial = true THEN u.id END) as trial_users,
        COUNT(DISTINCT CASE WHEN us.status = 'active' AND us.is_trial = false THEN u.id END) as paid_users,
        COUNT(DISTINCT CASE WHEN us.status = 'grace_period' THEN u.id END) as grace_period_users,
        COUNT(DISTINCT CASE WHEN us.status = 'expired' OR us.status IS NULL THEN u.id END) as expired_users,
        COUNT(DISTINCT CASE WHEN us.plan = 'silver' AND us.status = 'active' THEN u.id END) as silver_users,
        COUNT(DISTINCT CASE WHEN us.plan = 'gold' AND us.status = 'active' THEN u.id END) as gold_users,
        COUNT(DISTINCT CASE WHEN us.plan = 'platinum' AND us.status = 'active' THEN u.id END) as platinum_users
      FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id 
        AND us.id = (
          SELECT id FROM user_subscriptions 
          WHERE user_id = u.id 
          ORDER BY created_at DESC 
          LIMIT 1
        )
    `);
    
    // Get revenue statistics
    const revenueResult = await pool.query(`
      SELECT 
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN status = 'completed' AND created_at >= NOW() - INTERVAL '30 days' THEN amount ELSE 0 END) as monthly_revenue,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_revenue,
        COUNT(CASE WHEN payment_type = 'manual' AND status = 'pending' THEN 1 END) as pending_manual_verifications
      FROM payment_transactions
    `);
    
    // Get recent signups
    const recentSignupsResult = await pool.query(`
      SELECT COUNT(*) as recent_signups
      FROM users
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);
    
    // Get expiring subscriptions
    const expiringResult = await pool.query(`
      SELECT COUNT(*) as expiring_soon
      FROM user_subscriptions
      WHERE status = 'active' 
        AND is_trial = false
        AND end_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
    `);
    
    res.json({
      success: true,
      data: {
        users: statsResult.rows[0],
        revenue: revenueResult.rows[0],
        recentSignups: parseInt(recentSignupsResult.rows[0].recent_signups),
        expiringSoon: parseInt(expiringResult.rows[0].expiring_soon)
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get pending manual payments
router.get('/payments/pending', async (req, res) => {
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

// Create manual subscription (for admin use)
router.post('/subscriptions/create-manual', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { userId, plan, durationDays, notes } = req.body;
    
    await client.query('BEGIN');
    
    // Expire any existing active subscriptions
    await client.query(
      `UPDATE user_subscriptions 
       SET status = 'expired', updated_at = NOW()
       WHERE user_id = $1 AND status IN ('active', 'trial', 'grace_period')`,
      [userId]
    );
    
    // Create new subscription
    const result = await client.query(
      `INSERT INTO user_subscriptions (
        user_id, plan, status, is_trial, start_date, end_date, 
        payment_id, amount_paid, created_at, updated_at
      ) VALUES (
        $1, $2, 'active', false, NOW(), NOW() + INTERVAL '${durationDays} days',
        'manual_admin', 0, NOW(), NOW()
      ) RETURNING *`,
      [userId, plan]
    );
    
    // Log admin action
    await client.query(
      `INSERT INTO admin_controls (
        user_id, action, new_value, admin_notes, performed_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, 'create_manual_subscription', 
       JSON.stringify({ plan, durationDays }), 
       notes, 'admin']
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Subscription created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating manual subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  } finally {
    client.release();
  }
});

// Export subscription data
router.get('/export/subscriptions', async (req, res) => {
  try {
    const { format = 'json', status = '' } = req.query;
    
    let query = `
      SELECT 
        u.id as user_id, u.name, u.email, u.business_name,
        us.plan, us.status, us.is_trial, us.start_date, us.end_date,
        us.amount_paid, us.created_at as subscription_created
      FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id 
        AND us.id = (
          SELECT id FROM user_subscriptions 
          WHERE user_id = u.id 
          ORDER BY created_at DESC 
          LIMIT 1
        )
      WHERE 1=1
    `;
    
    const params = [];
    if (status) {
      query += ` AND us.status = $1`;
      params.push(status);
    }
    
    query += ` ORDER BY u.created_at DESC`;
    
    const result = await pool.query(query, params);
    
    if (format === 'csv') {
      const csv = [
        'User ID,Name,Email,Business Name,Plan,Status,Is Trial,Start Date,End Date,Amount Paid,Subscription Created',
        ...result.rows.map(row => 
          `${row.user_id},"${row.name}","${row.email}","${row.business_name}",${row.plan},${row.status},${row.is_trial},${row.start_date},${row.end_date},${row.amount_paid},${row.subscription_created}`
        )
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=subscriptions.csv');
      res.send(csv);
    } else {
      res.json({
        success: true,
        data: result.rows
      });
    }
  } catch (error) {
    console.error('Error exporting subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update configuration
router.post('/config/update', async (req, res) => {
  try {
    const { trialDays, gracePeriodDays } = req.body;
    
    // For now, return success as these would be environment variables
    // In production, you might want to store these in a configuration table
    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: {
        trialDays,
        gracePeriodDays
      }
    });
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Disable user account (admin only)
router.post('/users/:userId/disable', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    
    await client.query('BEGIN');
    
    // Update subscription status to disabled
    await client.query(
      `UPDATE user_subscriptions 
       SET status = 'disabled', updated_at = NOW()
       WHERE user_id = $1 AND status IN ('active', 'trial', 'grace_period')`,
      [userId]
    );
    
    // Invalidate all active sessions for this user
    await client.query(
      `UPDATE sessions 
       SET is_active = false, 
           invalidated_at = NOW(),
           invalidated_by = 'admin_disabled'
       WHERE user_id = $1 AND is_active = true`,
      [userId]
    );
    
    // Log admin action
    await client.query(
      `INSERT INTO admin_controls (
        user_id, action, new_value, admin_notes, performed_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, 'disable_account', 'disabled', reason || 'Admin disabled account', req.userId]
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'User account disabled successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error disabling user account:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  } finally {
    client.release();
  }
});

// Enable user account (admin only)
router.post('/users/:userId/enable', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { userId } = req.params;
    const { restorePreviousStatus } = req.body;
    
    await client.query('BEGIN');
    
    // Restore subscription to active or previous status
    const newStatus = restorePreviousStatus ? 'active' : 'expired';
    await client.query(
      `UPDATE user_subscriptions 
       SET status = $2, updated_at = NOW()
       WHERE user_id = $1 AND status = 'disabled'`,
      [userId, newStatus]
    );
    
    // Log admin action
    await client.query(
      `INSERT INTO admin_controls (
        user_id, action, new_value, admin_notes, performed_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, 'enable_account', newStatus, 'Admin enabled account', req.userId]
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'User account enabled successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error enabling user account:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  } finally {
    client.release();
  }
});

// Get user session details (admin only)
router.get('/users/:userId/sessions', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        id,
        device_id,
        device_info,
        is_active,
        created_at,
        last_active,
        invalidated_at,
        invalidated_by
      FROM sessions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [userId]);
    
    res.json({
      success: true,
      sessions: result.rows
    });
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;