const express = require('express');
const db = require('../../config/database');
const authenticateToken = require('../../middleware/auth');
const authorizeRole = require('../../middleware/authorize');
const logger = require('../utils/logger');
const router = express.Router();

// Record a violation
router.post('/', authenticateToken, authorizeRole(['siswa']), async (req, res) => {
  try {
    const { ujian_id, type } = req.body;
    await db.query(
      'INSERT INTO exam_violations (user_id, ujian_id, violation_type) VALUES (?, ?, ?)',
      [req.user.id, ujian_id, type]
    );
    res.status(201).json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error logging violation');
    res.status(500).json({ message: 'Failed to log violation' });
  }
});

// Get violations for an exam
router.get('/ujian/:ujianId', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const violations = await db.query(`
      SELECT v.*, u.nama as student_name 
      FROM exam_violations v
      JOIN users u ON v.user_id = u.id
      WHERE v.ujian_id = ?
      ORDER BY v.created_at DESC
    `, [req.params.ujianId]);
    res.json(violations);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch violations' });
  }
});

module.exports = router;
