const mariadb = require('mariadb');
const logger = require('../src/utils/logger');

const isProduction = process.env.NODE_ENV === 'production';

const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123',
  database: process.env.DB_NAME || 'ujian_db',
  connectionLimit: parseInt(process.env.DB_POOL_LIMIT) || (isProduction ? 20 : 5),
  acquireTimeout: isProduction ? 30000 : 10000,
  timeout: 30000,
  idleTimeout: 600000,
  resetAfterUse: true,
  bigNumberStrings: true,
  supportBigNumbers: true
});

pool.on('acquire', () => {
  logger.debug(`Connection acquired. Pool size: ${pool.totalConnections()}, active: ${pool.activeConnections()}`);
});

pool.on('enqueue', () => {
  logger.warn(`Connection queued. Pool size: ${pool.totalConnections()}, active: ${pool.activeConnections()}`);
});

module.exports = pool;