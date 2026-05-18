const jwt = require('jsonwebtoken');
const logger = require('../src/utils/logger');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.warn({ ip: req.ip }, 'Missing authentication token');
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      logger.warn({ err: err.message, ip: req.ip }, 'Invalid or expired token');
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    logger.debug({ userId: user.id, role: user.role }, 'User authenticated');
    req.user = user;
    next();
  });
};

module.exports = authenticateToken;