const bcrypt = require('bcryptjs');
const db = require('../../config/database');
const logger = require('../../src/utils/logger');

async function backfillExamPasswordHash() {
  try {
    const users = await db.query(
      "SELECT id, exam_password FROM users WHERE exam_password IS NOT NULL AND (exam_password_hash IS NULL OR exam_password_hash = '')"
    );

    logger.info({ count: users.length }, 'Found users needing exam_password_hash backfill');

    let updated = 0;
    for (const user of users) {
      const hash = await bcrypt.hash(user.exam_password, 10);
      await db.query('UPDATE users SET exam_password_hash = ? WHERE id = ?', [hash, user.id]);
      updated++;
    }

    logger.info({ updated }, 'Exam password hash backfill complete');
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'Failed to backfill exam_password_hash');
    process.exit(1);
  }
}

backfillExamPasswordHash();
