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
const crmRoutes = require('./routes/crmRoutes');
const mercadoPagoRoutes = require('./routes/mercadoPagoRoutes');

// Import flows
const salesFlow = require('./services/flows/salesFlow');
const supportFlow = require('./services/flows/supportFlow');
const registroClienteFlow = require('./services/flows/registroClienteFlow');
const menuFlow = require('./services/flows/menuFlow');
const subscriptionFlow = require('./services/flows/subscriptionFlow');
const pedidoFlow = require('./services/flows/pedidoFlow');

/**
 * Initialize Express app
 */
const app = express();

/**
 * Security middleware
 */
app.use(helmet());
app.use(cors({
  origin: [
    env.CRM_FRONTEND_URL || 'http://localhost:5173',
    process.env.CORS_ORIGIN || '*',
  ],
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
app.use('/webhook', mercadoPagoRoutes);
app.use('/api', crmRoutes);

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
  // Legacy / backward compat
  flowService.registerFlow(salesFlow.name, salesFlow);
  flowService.registerFlow(supportFlow.name, supportFlow);
  flowService.registerFlow(registroClienteFlow.name, registroClienteFlow);
  // Yemas del Sol flows
  flowService.registerFlow(menuFlow.name, menuFlow);
  flowService.registerFlow(subscriptionFlow.name, subscriptionFlow);
  flowService.registerFlow(pedidoFlow.name, pedidoFlow);
  logger.info('Conversation flows initialized');
};

/**
 * Initialize database
 */
const initializeDatabase = async () => {
  try {
    await models.sequelize.authenticate();
    logger.info('Database connection established successfully');

    // Ensure the ENUM type includes all Yemas del Sol flow values
    const yemaFlows = ['registro_cliente', 'menu', 'compra', 'suscripcion', 'pedidos', 'cambiar_direccion', 'reprogramar'];
    for (const val of yemaFlows) {
      await models.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = '${val}'
              AND enumtypid = (
                SELECT oid FROM pg_type WHERE typname = 'enum_sessions_current_flow'
              )
          ) THEN
            ALTER TYPE "enum_sessions_current_flow" ADD VALUE '${val}';
          END IF;
        END
        $$;
      `);
    }
    logger.info('ENUM enum_sessions_current_flow verified/updated');

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
