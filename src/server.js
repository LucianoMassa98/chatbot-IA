const { app, initializeDatabase, initializeFlows } = require('./app');
const logger = require('./config/logger');
const env = require('./config/env'); // role-based flows added

/**
 * Start server
 */
const startServer = async () => {
  try {
    // Initialize database
    await initializeDatabase();

    // Initialize flows
    initializeFlows();

    // Start HTTP server
    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Server is running on port ${env.PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
      logger.info(`Health check: http://localhost:${env.PORT}/health`);
    });

    /**
     * Handle unhandled promise rejections
     */
    process.on('unhandledRejection', (err) => {
      logger.error(`Unhandled Rejection: ${err.message}`);
      // Close server & exit process
      server.close(() => {
        process.exit(1);
      });
    });

    /**
     * Handle SIGTERM
     */
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server');
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
