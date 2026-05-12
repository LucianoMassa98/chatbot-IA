require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Database
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: process.env.DB_PORT || 5432,
  DB_USER: process.env.DB_USER || 'chatbot_user',
  DB_PASS: process.env.DB_PASS || 'password',
  DB_NAME: process.env.DB_NAME || 'chatbot_db',
  
  // Meta Configuration
  META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN || 'verify_token_secret',
  META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN || '',
  
  // Session Configuration
  SESSION_TIMEOUT: parseInt(process.env.SESSION_TIMEOUT || '3600', 10),
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || './logs/app.log',
  
  // AI Configuration
  AI_ENABLED: process.env.AI_ENABLED === 'true',
  AI_API_KEY: process.env.AI_API_KEY || '',
  AI_API_URL: process.env.AI_API_URL || '',
  
  // Validation
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
};
