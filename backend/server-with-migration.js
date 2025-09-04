const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { runMigrations } = require('./migrate');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const subscriptionRoutes = require('./routes/subscriptions-v2');
const subscriptionSimpleRoutes = require('./routes/subscriptions-simple');
const usageRoutes = require('./routes/usage');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration - allow GitHub Pages and local development
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://deepanshuvermaa.github.io',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5500',
      'null'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins for now
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files for admin panel
const path = require('path');
app.use('/admin', express.static(path.join(__dirname, 'public')));

// Health check endpoint - must be before other routes
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Also add a simple health check at root
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'QuickBill API Server',
    status: 'running',
    version: '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/subscriptions-simple', subscriptionSimpleRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/subscriptions', require('./routes/admin-subscription-management'));
app.use('/api/subscription-verify', require('./routes/subscription-verify'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server with migration
async function startServer() {
  try {
    // Start server first to handle health checks
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    });

    // Then run migrations in background
    console.log('🔄 Running database migrations...');
    runMigrations()
      .then(() => {
        console.log('✅ Database migrations completed!');
      })
      .catch((error) => {
        console.error('⚠️  Migration error (non-fatal):', error);
        // Don't exit - let the server continue running
      });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

startServer();