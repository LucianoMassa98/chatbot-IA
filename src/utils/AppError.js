class AppError extends Error {
  constructor(message, statusCode = 400, isBuffer = false) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.isBuffer = isBuffer;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
