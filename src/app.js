const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const logger = require('./config/logger');
const env = require('./config/env');
const { errorHandler, catchAsync } = require('./middleware/errorHandler');
const flowService = require('./services/flowService');
const models = require('./models');

// Import routes
const webhookRoutes = require('./routes/webhookRoutes');

// Import flows
const salesFlow = require('./services/flows/salesFlow');
const supportFlow = require('./services/flows/supportFlow');

/**
 * Initialize Express app
 */
const app = express();

/**
 * Security middleware
 */
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

/**
 * Body parsing middleware
 */
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));

/**
 * Logging middleware
 */
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

/**
 * API Routes
 */
app.use('/webhook', webhookRoutes);

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Multichannel Chatbot Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      webhook: '/webhook/meta',
    },
  });
});

/**
 * 404 Handler
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

/**
 * Error handling middleware (must be last)
 */
app.use(errorHandler);

/**
 * Initialize flows
 */
const initializeFlows = () => {
  flowService.registerFlow(salesFlow.name, salesFlow);
  flowService.registerFlow(supportFlow.name, supportFlow);
  logger.info('Conversation flows initialized');
};

/**
 * Initialize database
 */
const initializeDatabase = async () => {
  try {
    await models.sequelize.authenticate();
    logger.info('Database connection established successfully');

    // Sync models (use force: true only in development)
    if (env.isDevelopment) {
      await models.sequelize.sync();
      logger.info('Database models synchronized');
    }
  } catch (error) {
    logger.error(`Database initialization failed: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Export app and initialization functions
 */
module.exports = {
  app,
  initializeDatabase,
  initializeFlows,
};
