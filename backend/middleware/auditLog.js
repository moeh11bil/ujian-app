const db = require('../config/database');
const logger = require('../src/utils/logger');

const logActivity = async (userId, action, entityType = null, entityId = null, details = null, req = null) => {
  try {
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.connection.remoteAddress) : null;
    const userAgent = req ? req.headers['user-agent'] : null;
    
    let detailsStr = null;
    if (details) {
      try {
        detailsStr = JSON.stringify(details);
      } catch (e) {
        logger.warn({ err: e }, 'Error stringifying audit details');
        detailsStr = null;
      }
    }

    await db.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, action, entityType, entityId, ipAddress, userAgent, detailsStr]
    );
  } catch (error) {
    logger.error({ err: error }, 'Error logging audit activity');
    // Don't throw - logging failure should not break the main operation
  }
};

module.exports = logActivity;
