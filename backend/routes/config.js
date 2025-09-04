const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Store the password hash - you'll update this with your desired password
// IMPORTANT: Always use environment variable in production!
const FACTORY_RESET_PASSWORD_HASH = process.env.FACTORY_RESET_PASSWORD_HASH;

// Throw error if not configured in production
if (!FACTORY_RESET_PASSWORD_HASH && process.env.NODE_ENV === 'production') {
  console.error('FATAL: FACTORY_RESET_PASSWORD_HASH not configured');
  process.exit(1);
}

/**
 * GET /api/config/factory-reset-password
 * Returns the factory reset password hash
 */
router.get('/factory-reset-password', async (req, res) => {
  try {
    // Check if password is configured
    if (!FACTORY_RESET_PASSWORD_HASH) {
      return res.status(503).json({ 
        error: 'Factory reset not configured',
        message: 'Please contact administrator'
      });
    }
    
    const response = {
      passwordHash: FACTORY_RESET_PASSWORD_HASH,
      updatedAt: new Date().toISOString(),
      minAppVersion: '1.0.0'
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching factory reset password:', error);
    res.status(500).json({ 
      error: 'Failed to fetch configuration',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Utility function to generate password hash (for your reference)
 * Run this locally to generate hash for your desired password
 */
function generatePasswordHash(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Example usage (uncomment to test):
// console.log('Password hash for "YourPasswordHere":', generatePasswordHash('YourPasswordHere'));

module.exports = router;