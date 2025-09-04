const addSessionManagement = async (pool) => {
  try {
    // Create sessions table for device tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        session_token TEXT UNIQUE NOT NULL,
        device_id TEXT NOT NULL,
        device_info JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        invalidated_at TIMESTAMP,
        invalidated_by TEXT
      )
    `);

    // Add indexes for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_active 
      ON sessions(user_id, is_active)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_token 
      ON sessions(session_token)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_device 
      ON sessions(device_id)
    `);

    // Add role column to users table if it doesn't exist
    await pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='users' AND column_name='role'
        ) THEN
          ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';
        END IF;
      END $$;
    `);

    // Set admin role for the specified email
    await pool.query(`
      UPDATE users 
      SET role = 'admin' 
      WHERE email = 'deepanshuverma966@gmail.com'
    `);

    console.log('Session management tables and admin role created successfully');
  } catch (error) {
    console.error('Error creating session management tables:', error);
    throw error;
  }
};

module.exports = addSessionManagement;