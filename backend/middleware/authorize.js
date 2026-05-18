const logger = require('../src/utils/logger');

const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      logger.warn({ ip: req.ip }, 'Authorization attempt without authentication');
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn({ userId: req.user.id, role: req.user.role, allowedRoles }, 'Access denied: insufficient permissions');
      return res.status(403).json({ message: 'Access denied: insufficient permissions' });
    }
    
    next();
  };
};

module.exports = authorizeRole;