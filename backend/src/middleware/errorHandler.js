const { AppError } = require('../errors/AppError');
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;

  // Log error for debugging
  logger.error({
    err: {
      message: err.message,
      stack: err.stack,
      code: err.code,
      name: err.name
    },
    method: req.method,
    url: req.originalUrl
  }, 'Error handled');

  // MariaDB / Database errors
  if (err.code === 'ER_DUP_ENTRY') {
    error = new AppError('Data sudah ada (duplikat)', 409, 'DUPLICATE_ENTRY');
  } else if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    error = new AppError('Data tidak bisa dihapus karena masih digunakan', 400, 'REFERENCE_ERROR');
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    error = new AppError('Data referensi tidak ditemukan', 400, 'REFERENCE_NOT_FOUND');
  } else if (err.code === 'ECONNREFUSED') {
    error = new AppError('Gagal terhubung ke database', 500, 'DATABASE_CONNECTION_ERROR');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Token tidak valid', 401, 'INVALID_TOKEN');
  } else if (err.name === 'TokenExpiredError') {
    error = new AppError('Sesi telah berakhir, silakan login kembali', 401, 'TOKEN_EXPIRED');
  }

  // Timeout error
  if (err.code === 'ETIMEDOUT' || err.name === 'TimeoutError') {
    error = new AppError('Permintaan melebihi batas waktu (timeout)', 408, 'REQUEST_TIMEOUT');
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Terjadi kesalahan pada server';
  const code = error.code || 'INTERNAL_ERROR';

  const response = {
    success: false,
    error: {
      code,
      message
    }
  };

  if (process.env.NODE_ENV === 'development') {
    response.error.stack = error.stack;
    response.error.details = err.message;
  }

  if (error.errors) {
    response.error.errors = error.errors;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;