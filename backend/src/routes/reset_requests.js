const express = require('express');
const db = require('../../config/database');
const authenticateToken = require('../../middleware/auth');
const authorizeRole = require('../../middleware/authorize');
const { sendResetRequestStatusEmail } = require('../../config/email');
const logActivity = require('../../middleware/auditLog');
const logger = require('../utils/logger');
const router = express.Router();

// Create a reset request (siswa only)
router.post('/', authenticateToken, authorizeRole(['siswa']), async (req, res) => {
  try {
    const { ujian_id } = req.body;
    const user_id = req.user.id;

    logger.debug({ user_id, ujian_id }, 'Creating reset request');

    // Ensure ujian_id is a number
    const examId = typeof ujian_id === 'string' ? parseInt(ujian_id) : ujian_id;

    // Verify that the user has already taken this exam
    const existingResult = await db.query(
      'SELECT id FROM hasil WHERE user_id = ? AND ujian_id = ?',
      [user_id, examId]
    );

    if (!existingResult.length) {
      return res.status(400).json({
        message: 'Cannot request reset for an exam that has not been taken'
      });
    }

    // Check if there's already a pending request
    const existingRequest = await db.query(
      'SELECT id FROM reset_requests WHERE user_id = ? AND ujian_id = ? AND status = ?',
      [user_id, ujian_id, 'pending']
    );

    if (existingRequest.length) {
      return res.status(400).json({ 
        message: 'A reset request for this exam is already pending' 
      });
    }

    // Check exam schedule
    const [ujian] = await db.query(
      'SELECT waktu_mulai, waktu_selesai FROM ujian WHERE id = ?',
      [examId]
    );

    if (ujian && (ujian.waktu_mulai || ujian.waktu_selesai)) {
      const now = new Date();
      if (
        (ujian.waktu_mulai && new Date(ujian.waktu_mulai) > now) ||
        (ujian.waktu_selesai && new Date(ujian.waktu_selesai) < now)
      ) {
        return res.status(400).json({ 
          message: 'Permintaan reset ditolak: Ujian sedang di luar jadwal' 
        });
      }
    }

    // Create the reset request
    const result = await db.query(
      'INSERT INTO reset_requests (user_id, ujian_id) VALUES (?, ?)',
      [user_id, examId]
    );

    res.status(201).json({
      message: 'Reset request submitted successfully',
      requestId: result.insertId
    });
  } catch (error) {
    logger.error({ err: error }, 'Error creating reset request');
    res.status(500).json({ message: 'Failed to submit reset request', error: error.message });
  }
});

// Get all reset requests (admin/guru only)
router.get('/', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const resetRequests = await db.query(`
      SELECT rr.*, u.nama as user_nama, u.email as user_email, uj.judul as ujian_judul
      FROM reset_requests rr
      JOIN users u ON rr.user_id = u.id
      JOIN ujian uj ON rr.ujian_id = uj.id
      WHERE rr.status = 'pending'
      ORDER BY rr.created_at DESC
    `);
    res.json(resetRequests);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get reset requests', error: error.message });
  }
});

// Get reset requests for a specific user (admin/guru can see all, siswa can see own)
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user is trying to access their own requests or if they're admin/guru
    if (req.user.id != userId && req.user.role !== 'admin' && req.user.role !== 'guru') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const resetRequests = await db.query(`
      SELECT rr.*, u.nama as user_nama, uj.judul as ujian_judul
      FROM reset_requests rr
      JOIN users u ON rr.user_id = u.id
      JOIN ujian uj ON rr.ujian_id = uj.id
      WHERE rr.user_id = ?
      ORDER BY rr.created_at DESC
    `, [userId]);

    res.json(resetRequests);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get user reset requests', error: error.message });
  }
});

// Get reset requests for a specific exam (admin/guru only)
router.get('/ujian/:ujianId', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { ujianId } = req.params;

    const resetRequests = await db.query(`
      SELECT rr.*, u.nama as user_nama, u.email as user_email
      FROM reset_requests rr
      JOIN users u ON rr.user_id = u.id
      WHERE rr.ujian_id = ?
      AND rr.status = 'pending'
      ORDER BY rr.created_at DESC
    `, [ujianId]);

    res.json(resetRequests);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get exam reset requests', error: error.message });
  }
});

// Approve a reset request (admin/guru only)
router.patch('/:requestId/approve', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { requestId } = req.params;

    logger.debug({ requestId }, 'Approving reset request');

    const request = await db.query(
      'SELECT * FROM reset_requests WHERE id = ?',
      [requestId]
    );

    if (!request.length) {
      return res.status(404).json({ message: 'Reset request not found' });
    }

    if (request[0].status !== 'pending') {
      return res.status(400).json({ message: 'Reset request is not pending' });
    }

    await db.query(
      'DELETE FROM hasil WHERE user_id = ? AND ujian_id = ?',
      [request[0].user_id, request[0].ujian_id]
    );

    await db.query(
      'DELETE FROM reset_requests WHERE id = ?',
      [requestId]
    );

    try {
      await logActivity(req.user.id, 'RESET_APPROVED', 'reset_request', requestId, { user_id: request[0].user_id, ujian_id: request[0].ujian_id }, req);
    } catch (logError) {
      logger.error({ err: logError }, 'Failed to log activity');
    }

    const [user] = await db.query('SELECT nama, email FROM users WHERE id = ?', [request[0].user_id]);
    const [ujian] = await db.query('SELECT judul FROM ujian WHERE id = ?', [request[0].ujian_id]);

    if (user.length && ujian.length && user[0].email) {
      try {
        await sendResetRequestStatusEmail(user[0].email, ujian[0].judul, 'approved', user[0].nama);
      } catch (emailError) {
        logger.warn({ err: emailError }, 'Failed to send approval email');
      }
    }

    logger.info({ requestId, userId: request[0].user_id }, 'Reset request approved');
    res.json({
      message: 'Reset request approved and exam result deleted'
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.params.requestId }, 'Error approving reset request');
    res.status(500).json({ message: 'Failed to approve reset request', error: error.message });
  }
});

// Reject a reset request (admin/guru only)
router.patch('/:requestId/reject', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await db.query(
      'SELECT * FROM reset_requests WHERE id = ?',
      [requestId]
    );

    if (!request.length) {
      return res.status(404).json({ message: 'Reset request not found' });
    }

    if (request[0].status !== 'pending') {
      return res.status(400).json({ message: 'Reset request is not pending' });
    }

    await db.query(
      'DELETE FROM reset_requests WHERE id = ?',
      [requestId]
    );

    try {
      await logActivity(req.user.id, 'RESET_REJECTED', 'reset_request', requestId, { user_id: request[0].user_id, ujian_id: request[0].ujian_id }, req);
    } catch (logError) {
      logger.error({ err: logError }, 'Failed to log activity');
    }

    const [user] = await db.query('SELECT nama, email FROM users WHERE id = ?', [request[0].user_id]);
    const [ujian] = await db.query('SELECT judul FROM ujian WHERE id = ?', [request[0].ujian_id]);

    if (user.length && ujian.length && user[0].email) {
      try {
        await sendResetRequestStatusEmail(user[0].email, ujian[0].judul, 'rejected', user[0].nama);
      } catch (emailError) {
        logger.warn({ err: emailError }, 'Failed to send rejection email');
      }
    }

    logger.info({ requestId, userId: request[0].user_id }, 'Reset request rejected');
    res.json({
      message: 'Reset request rejected'
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.params.requestId }, 'Error rejecting reset request');
    res.status(500).json({ message: 'Failed to reject reset request', error: error.message });
  }
});

// Get a specific reset request (admin/guru can see any, siswa can see own)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const resetRequest = await db.query(`
      SELECT rr.*, u.nama as user_nama, uj.judul as ujian_judul
      FROM reset_requests rr
      JOIN users u ON rr.user_id = u.id
      JOIN ujian uj ON rr.ujian_id = uj.id
      WHERE rr.id = ?
    `, [id]);

    if (!resetRequest.length) {
      return res.status(404).json({ message: 'Reset request not found' });
    }

    // Check if user can access this request
    if (req.user.id != resetRequest[0].user_id && req.user.role !== 'admin' && req.user.role !== 'guru') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(resetRequest[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get reset request', error: error.message });
  }
});

module.exports = router;