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

// Log user activity
router.post('/log', authenticateToken, async (req, res) => {
  try {
    const schema = Joi.object({
      action: Joi.string().max(100).required(),
      details: Joi.object().default({}),
      sessionId: Joi.string().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { action, details, sessionId } = value;

    // Get IP address and user agent
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await pool.query(
      `INSERT INTO usage_logs (user_id, action, details, ip_address, user_agent, session_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [req.userId, action, JSON.stringify(details), ipAddress, userAgent, sessionId]
    );

    res.json({
      success: true,
      message: 'Activity logged successfully'
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user activity statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);

    if (isNaN(days) || days < 1 || days > 365) {
      return res.status(400).json({
        success: false,
        message: 'Period must be between 1 and 365 days'
      });
    }

    // Get activity stats for the specified period
    const activityResult = await pool.query(
      `SELECT 
         action,
         COUNT(*) as count,
         DATE(created_at) as date
       FROM usage_logs 
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY action, DATE(created_at)
       ORDER BY date DESC, count DESC`,
      [req.userId]
    );

    // Get total activity count
    const totalResult = await pool.query(
      `SELECT COUNT(*) as total_activities
       FROM usage_logs 
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'`,
      [req.userId]
    );

    // Get most active days
    const dailyResult = await pool.query(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as activities
       FROM usage_logs 
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY activities DESC
       LIMIT 10`,
      [req.userId]
    );

    // Get top actions
    const topActionsResult = await pool.query(
      `SELECT 
         action,
         COUNT(*) as count,
         MAX(created_at) as last_used
       FROM usage_logs 
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY action
       ORDER BY count DESC
       LIMIT 10`,
      [req.userId]
    );

    res.json({
      success: true,
      data: {
        period: `${days} days`,
        totalActivities: parseInt(totalResult.rows[0].total_activities),
        dailyActivity: dailyResult.rows,
        topActions: topActionsResult.rows,
        activityTimeline: activityResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Sync offline data
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const schema = Joi.object({
      activities: Joi.array().items(
        Joi.object({
          action: Joi.string().max(100).required(),
          details: Joi.object().default({}),
          timestamp: Joi.date().required(),
          sessionId: Joi.string().optional()
        })
      ).required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { activities } = value;

    if (activities.length === 0) {
      return res.json({
        success: true,
        message: 'No activities to sync'
      });
    }

    // Get IP address and user agent
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      for (const activity of activities) {
        await client.query(
          `INSERT INTO usage_logs (user_id, action, details, ip_address, user_agent, session_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            req.userId,
            activity.action,
            JSON.stringify(activity.details),
            ipAddress,
            userAgent,
            activity.sessionId,
            activity.timestamp
          ]
        );
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: `${activities.length} activities synced successfully`
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error syncing activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync activities'
    });
  }
});

// Get app health metrics (for admin monitoring)
router.get('/health', async (req, res) => {
  try {
    // This endpoint could be protected with admin auth in production
    const activeUsersResult = await pool.query(
      `SELECT COUNT(DISTINCT user_id) as active_users
       FROM usage_logs 
       WHERE created_at >= NOW() - INTERVAL '24 hours'`
    );

    const totalUsersResult = await pool.query(
      'SELECT COUNT(*) as total_users FROM users'
    );

    const totalActivitiesResult = await pool.query(
      `SELECT COUNT(*) as total_activities
       FROM usage_logs 
       WHERE created_at >= NOW() - INTERVAL '24 hours'`
    );

    const topActionsResult = await pool.query(
      `SELECT action, COUNT(*) as count
       FROM usage_logs 
       WHERE created_at >= NOW() - INTERVAL '24 hours'
       GROUP BY action
       ORDER BY count DESC
       LIMIT 5`
    );

    res.json({
      success: true,
      data: {
        activeUsers24h: parseInt(activeUsersResult.rows[0].active_users),
        totalUsers: parseInt(totalUsersResult.rows[0].total_users),
        totalActivities24h: parseInt(totalActivitiesResult.rows[0].total_activities),
        topActions: topActionsResult.rows,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching health metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;