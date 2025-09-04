const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const SessionService = require('../services/sessionService');
const router = express.Router();

/**
 * Check if current session is still valid
 * Called every 30 seconds by frontend
 */
router.post('/check-session', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.userId;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }
    
    // Get session token from auth header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    // Validate session
    const validation = await SessionService.validateSession(token, userId);
    
    res.json({
      success: true,
      isValid: validation.isValid,
      reason: validation.reason
    });
  } catch (error) {
    console.error('Session check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking session'
    });
  }
});

/**
 * Force logout all other devices
 */
router.post('/force-logout-others', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const authHeader = req.headers['authorization'];
    const currentToken = authHeader && authHeader.split(' ')[1];
    
    await SessionService.forceLogoutOtherDevices(userId, currentToken);
    
    res.json({
      success: true,
      message: 'All other devices have been logged out'
    });
  } catch (error) {
    console.error('Force logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error forcing logout on other devices'
    });
  }
});

/**
 * Logout endpoint with session cleanup
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      await SessionService.logout(token);
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during logout'
    });
  }
});

/**
 * Get active sessions for current user (admin feature)
 */
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const sessions = await SessionService.getActiveSessions(userId);
    
    res.json({
      success: true,
      sessions: sessions.map(session => ({
        id: session.id,
        deviceId: session.device_id,
        deviceInfo: session.device_info,
        createdAt: session.created_at,
        lastActive: session.last_active
      }))
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sessions'
    });
  }
});

module.exports = router;