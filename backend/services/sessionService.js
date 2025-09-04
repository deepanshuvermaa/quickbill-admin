const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

class SessionService {
  /**
   * Create a new session for user login
   * Implements "last write wins" policy - invalidates all other sessions
   */
  static async createSession(userId, deviceInfo) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Invalidate all existing sessions for this user
      await client.query(`
        UPDATE sessions 
        SET is_active = false, 
            invalidated_at = NOW(),
            invalidated_by = 'new_login'
        WHERE user_id = $1 AND is_active = true
      `, [userId]);
      
      // Generate unique session token
      const sessionToken = crypto.randomBytes(32).toString('hex');
      
      // Create new session
      const result = await client.query(`
        INSERT INTO sessions (
          user_id, 
          session_token, 
          device_id, 
          device_info, 
          is_active,
          created_at,
          last_active
        ) VALUES ($1, $2, $3, $4, true, NOW(), NOW())
        RETURNING id, session_token
      `, [
        userId,
        sessionToken,
        deviceInfo.deviceId || crypto.randomBytes(16).toString('hex'),
        JSON.stringify(deviceInfo)
      ]);
      
      await client.query('COMMIT');
      
      return {
        sessionId: result.rows[0].id,
        sessionToken: result.rows[0].session_token
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Validate if a session is still active
   */
  static async validateSession(sessionToken, userId) {
    try {
      const result = await pool.query(`
        SELECT id, is_active, user_id 
        FROM sessions 
        WHERE session_token = $1 AND user_id = $2
      `, [sessionToken, userId]);
      
      if (result.rows.length === 0) {
        return { isValid: false, reason: 'Session not found' };
      }
      
      const session = result.rows[0];
      
      if (!session.is_active) {
        return { isValid: false, reason: 'Session invalidated' };
      }
      
      // Update last active time
      await pool.query(`
        UPDATE sessions 
        SET last_active = NOW() 
        WHERE id = $1
      `, [session.id]);
      
      return { isValid: true };
    } catch (error) {
      console.error('Session validation error:', error);
      return { isValid: false, reason: 'Validation error' };
    }
  }
  
  /**
   * Force logout on all other devices
   */
  static async forceLogoutOtherDevices(userId, currentSessionToken) {
    try {
      await pool.query(`
        UPDATE sessions 
        SET is_active = false,
            invalidated_at = NOW(),
            invalidated_by = 'force_logout'
        WHERE user_id = $1 
          AND session_token != $2 
          AND is_active = true
      `, [userId, currentSessionToken]);
      
      return { success: true };
    } catch (error) {
      console.error('Force logout error:', error);
      throw error;
    }
  }
  
  /**
   * Logout and cleanup session
   */
  static async logout(sessionToken) {
    try {
      await pool.query(`
        UPDATE sessions 
        SET is_active = false,
            invalidated_at = NOW(),
            invalidated_by = 'manual_logout'
        WHERE session_token = $1
      `, [sessionToken]);
      
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }
  
  /**
   * Get active sessions for a user
   */
  static async getActiveSessions(userId) {
    try {
      const result = await pool.query(`
        SELECT 
          id,
          device_id,
          device_info,
          created_at,
          last_active
        FROM sessions 
        WHERE user_id = $1 AND is_active = true
        ORDER BY last_active DESC
      `, [userId]);
      
      return result.rows;
    } catch (error) {
      console.error('Get active sessions error:', error);
      throw error;
    }
  }
  
  /**
   * Clean up old inactive sessions (housekeeping)
   */
  static async cleanupOldSessions() {
    try {
      // Delete sessions older than 30 days
      await pool.query(`
        DELETE FROM sessions 
        WHERE (invalidated_at < NOW() - INTERVAL '30 days')
           OR (is_active = false AND last_active < NOW() - INTERVAL '30 days')
      `);
      
      return { success: true };
    } catch (error) {
      console.error('Session cleanup error:', error);
      throw error;
    }
  }
}

module.exports = SessionService;