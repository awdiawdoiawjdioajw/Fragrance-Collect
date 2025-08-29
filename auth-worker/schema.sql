-- Database schema for Fragrance-Collect Authentication
-- Users table for authentication and login
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    picture TEXT,
    password_hash TEXT, -- For email/password authentication
    salt TEXT,          -- Salt for password hashing
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table for managing login sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Fragrance preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    scent_categories TEXT, -- JSON array: ['woody', 'floral']
    intensity TEXT, -- 'light', 'moderate', 'strong'
    season TEXT, -- 'spring', 'summer', 'fall', 'winter'
    occasion TEXT, -- 'casual', 'formal'
    budget_range TEXT, -- e.g., '50-100'
    sensitivities TEXT, -- User-defined text
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- User favorites table
DROP TABLE IF EXISTS user_favorites;
CREATE TABLE IF NOT EXISTS user_favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    fragrance_id TEXT NOT NULL, -- Corresponds to a product ID from the CJ API
    name TEXT NOT NULL,
    advertiserName TEXT,
    description TEXT,
    imageUrl TEXT,
    productUrl TEXT,
    price REAL,
    currency TEXT,
    shipping_availability TEXT,
    user_notes TEXT,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, fragrance_id)
);

-- Indexes for new tables
DROP INDEX IF EXISTS idx_user_favorites_user_id;
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_added_at ON user_favorites(added_at);