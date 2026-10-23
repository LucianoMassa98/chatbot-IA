const { app, initializeDatabase, initializeFlows } = require('./app');
const logger = require('./config/logger');
const env = require('./config/env'); // role-based flows added
const scheduler = require('./services/schedulerService');

/**
 * Start server
 */
const startServer = async () => {
  try {
    // Initialize database
    await initializeDatabase();

    // Initialize flows
    initializeFlows();

    // Start background scheduler (renewal reminders + weekly delivery generation)
    scheduler.start();

    // Start HTTP server
    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Server is running on port ${env.PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
      logger.info(`Health check: http://localhost:${env.PORT}/health`);
    });

    // Auto-reconnect WhatsApp Web if an active session exists
    const baileysService = require('./services/baileysService');
    if (baileysService.getStatus().hasSavedSession) {
      logger.info('Saved WhatsApp Web session found. Reconnecting in background...');
      baileysService.startSession(false).catch((err) => {
        logger.warn(`WhatsApp Web auto-reconnect failed: ${err.message}`);
      });
    }

    /**
     * Handle unhandled promise rejections gracefully
     */
    process.on('unhandledRejection', (err) => {
      logger.error(`Unhandled Rejection: ${err?.message || err}`);
      if (err?.stack) {
        logger.debug(err.stack);
      }
    });

    /**
     * Handle SIGTERM
     */
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      scheduler.stop();
      server.close(() => {
        logger.info('HTTP server closed');
      });
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

// Start the server
startServer();
