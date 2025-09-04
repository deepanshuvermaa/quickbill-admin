const jwt = require('jsonwebtoken');

// Authenticate token middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error('JWT verification error:', err.message);
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Debug logging
    console.log('JWT decoded:', decoded);
    
    // Handle both userId and id in token
    req.userId = decoded.userId || decoded.id || decoded.sub;
    req.user = decoded;
    
    console.log('Set req.userId to:', req.userId);
    next();
  });
};

// Generate tokens
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );
};

module.exports = {
  authenticateToken,
  generateToken,
  generateRefreshToken
};