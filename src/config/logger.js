const winston = require('winston');
const path = require('path');
const env = require('./env');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.dirname(env.LOG_FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'chatbot-backend' },
  transports: [
    new winston.transports.File({ filename: env.LOG_FILE }),
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
    }),
  ],
});

// Add console transport in development
if (env.isDevelopment) {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} ${level}: ${message} ${metaStr}`;
        }),
      ),
    }),
  );
}

module.exports = logger;
