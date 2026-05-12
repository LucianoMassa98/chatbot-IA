const logger = require('../config/logger');
const AppError = require('../utils/AppError');

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || 'Internal Server Error';

  // Wrong MongoDB/Sequelize ID error
  if (err.name === 'SequelizeUniqueConstraintError') {
    const message = `Duplicate field value entered`;
    err = new AppError(message, 400);
  }

  // Sequelize Validation Error
  if (err.name === 'SequelizeValidationError') {
    const message = err.errors.map((e) => e.message).join(', ');
    err = new AppError(message, 400);
  }

  // JWT Error
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    err = new AppError(message, 401);
  }

  // JWT Expire Error
  if (err.name === 'TokenExpiredError') {
    const message = 'Token has expired';
    err = new AppError(message, 401);
  }

  // Log the error
  logger.error({
    message: err.message,
    statusCode: err.statusCode,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Send response
  res.status(err.statusCode).json({
    success: false,
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * Catch errors in async route handlers
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { errorHandler, catchAsync };
