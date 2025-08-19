// Commission Junction (CJ) API Configuration
// Copy this file to config.js and fill in your actual credentials
// NEVER commit the actual config.js file to version control

export const config = {
  // Get these from your CJ.com publisher dashboard
  CJ_DEV_KEY: 'your_cj_developer_key_here',
  CJ_WEBSITE_ID: 'your_cj_website_id_here',
  
  // API Configuration
  NODE_ENV: 'development',
  PORT: 3000,
  
  // CJ API endpoints
  CJ_API_BASE: 'https://product-search.api.cj.com/v2',
  
  // Default search parameters
  DEFAULT_SEARCH: 'perfume fragrance cologne',
  DEFAULT_LIMIT: 50,
  DEFAULT_PAGE: 1,
  
  // Security Configuration
  SECURITY: {
    // Rate limiting (requests per 15 minutes)
    RATE_LIMIT_MAX_REQUESTS: 100,
    RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
    
    // Request size limits
    MAX_REQUEST_SIZE: 1024 * 1024, // 1MB
    
    // CORS settings
    ENABLE_CORS: true,
    ALLOWED_ORIGINS: ['*'], // Restrict to specific domains in production
    
    // Rate limiting toggle
    ENABLE_RATE_LIMITING: true,
    
    // Logging sensitivity
    LOG_SENSITIVE_DATA: false // Set to true only in development
  },
  
  // Logging Configuration
  LOGGING: {
    LEVEL: 'info', // debug, info, warn, error
    ENABLE_REQUEST_LOGGING: true,
    ENABLE_ERROR_LOGGING: true,
    ENABLE_PERFORMANCE_LOGGING: false
  },
  
  // Performance Configuration
  PERFORMANCE: {
    REQUEST_TIMEOUT: 30000, // 30 seconds
    MAX_CONCURRENT_REQUESTS: 10,
    CACHE_TTL: 300000 // 5 minutes
  }
};

// Environment-specific overrides
if (process.env.NODE_ENV === 'production') {
  config.SECURITY.ALLOWED_ORIGINS = [
    'https://yourdomain.com',
    'https://www.yourdomain.com'
  ];
  config.SECURITY.LOG_SENSITIVE_DATA = false;
  config.LOGGING.LEVEL = 'warn';
  config.PERFORMANCE.CACHE_TTL = 600000; // 10 minutes in production
}
