const { validationResult } = require('express-validator');
const { ValidationError } = require('../errors/AppError');

const validate = (validations) => {
  return async (req, res, next) => {
    for (let validation of validations) {
      const result = await validation.run(req);
      if (result.errors.length > 0) {
        break;
      }
    }

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const formattedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg
    }));

    next(new ValidationError('Validation failed', formattedErrors));
  };
};

module.exports = validate;