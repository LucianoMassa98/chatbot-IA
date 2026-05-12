const AppError = require('../utils/AppError');

/**
 * Validate request against schema
 */
const validate = (schema, property = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[property], {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    return next(new AppError(`Validation Error: ${JSON.stringify(details)}`, 400));
  }

  // Replace request property with validated value
  req[property] = value;
  next();
};

module.exports = { validate };
