const express = require('express');
const db = require('../../config/database');
const authenticateToken = require('../../middleware/auth');
const authorizeRole = require('../../middleware/authorize');
const { paginate, paginateResponse } = require('../../middleware/pagination');
const logger = require('../utils/logger');
const router = express.Router();

// Get all ujian (all roles can access)
router.get('/', authenticateToken, paginate, async (req, res) => {
  try {
    let query;
    let params = [];
    const { page, limit, offset } = req.pagination || {};

    if (req.user.role === 'siswa') {
      logger.debug({ kelasId: req.user.kelas_id }, 'Fetching active exams for student');
      if (req.user.kelas_id) {
        query = 'SELECT u.*, k.nama_kelas FROM ujian u LEFT JOIN kelas k ON u.kelas_id = k.id WHERE u.status = "aktif" AND (u.kelas_id IS NULL OR u.kelas_id = ?) ORDER BY u.waktu_mulai DESC';
        params = [req.user.kelas_id];
      } else {
        query = 'SELECT u.*, k.nama_kelas FROM ujian u LEFT JOIN kelas k ON u.kelas_id = k.id WHERE u.status = "aktif" AND u.kelas_id IS NULL ORDER BY u.waktu_mulai DESC';
      }
    } else {
      query = 'SELECT u.*, k.nama_kelas FROM ujian u LEFT JOIN kelas k ON u.kelas_id = k.id ORDER BY u.created_at DESC';
    }

    if (req.pagination) {
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    }

    const ujian = await db.query(query, params);

    if (req.pagination) {
      let countQuery = 'SELECT COUNT(*) as total FROM ujian u';
      const countParams = [];
      if (req.user.role === 'siswa') {
        if (req.user.kelas_id) {
          countQuery += ' WHERE u.status = "aktif" AND (u.kelas_id IS NULL OR u.kelas_id = ?)';
          countParams.push(req.user.kelas_id);
        } else {
          countQuery += ' WHERE u.status = "aktif" AND u.kelas_id IS NULL';
        }
      }
      const [{ total }] = await db.query(countQuery, countParams);
      res.json(paginateResponse(ujian, total, page, limit));
    } else {
      res.json(ujian);
    }
  } catch (error) {
    logger.error({ err: error }, 'Error fetching ujian list');
    res.status(500).json({ message: 'Failed to get ujian', error: error.message });
  }
});

// Get ujian by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    logger.debug({ id, type: typeof id }, 'Fetching ujian by ID');

    const ujianId = parseInt(id);

    let ujianResult;
    
    if (req.user.role === 'siswa') {
      // Siswa hanya bisa mengakses ujian aktif dari kelas mereka
      if (req.user.kelas_id) {
        ujianResult = await db.query(
          'SELECT u.*, k.nama_kelas FROM ujian u LEFT JOIN kelas k ON u.kelas_id = k.id WHERE u.id = ? AND u.status = "aktif" AND (u.kelas_id IS NULL OR u.kelas_id = ?)',
          [ujianId, req.user.kelas_id]
        );
      } else {
        // Jika siswa tidak memiliki kelas, hanya bisa mengakses ujian umum
        ujianResult = await db.query(
          'SELECT u.*, k.nama_kelas FROM ujian u LEFT JOIN kelas k ON u.kelas_id = k.id WHERE u.id = ? AND u.status = "aktif" AND u.kelas_id IS NULL',
          [ujianId]
        );
      }
    } else {
      // Admin dan guru bisa mengakses semua ujian
      ujianResult = await db.query(
        'SELECT u.*, k.nama_kelas FROM ujian u LEFT JOIN kelas k ON u.kelas_id = k.id WHERE u.id = ?',
        [ujianId]
      );
    }

    const ujian = Array.isArray(ujianResult) && ujianResult.length > 0 ? ujianResult[0] : null;

    if (!ujian) {
      logger.warn({ id }, 'Ujian not found');
      return res.status(404).json({ message: 'Ujian not found' });
    }

    if (req.user.role === 'siswa' && ujian.status !== 'aktif') {
      logger.warn({ userId: req.user.id, ujianId: id }, 'Student attempted to access inactive exam');
      return res.status(403).json({ message: 'Cannot access inactive exam' });
    }

    if (req.user.role === 'siswa') {
      const existingResult = await db.query(
        'SELECT id FROM hasil WHERE user_id = ? AND ujian_id = ?',
        [req.user.id, ujianId]
      );

      if (existingResult.length > 0) {
        logger.info({ userId: req.user.id, ujianId }, 'Student already submitted results for this exam');
        return res.status(403).json({
          message: 'You have already submitted results for this exam. Contact admin to reset if needed.'
        });
      }
    }

    res.json(ujian);
  } catch (error) {
    logger.error({ err: error }, 'Error in ujian by ID endpoint');
    res.status(500).json({ message: 'Failed to get ujian', error: error.message });
  }
});

// Create ujian (admin/guru only)
router.post('/', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { judul, durasi, waktu_mulai, waktu_selesai, status, kelas_id } = req.body;

    // Validate status
    const validStatus = ['aktif', 'nonaktif'];
    if (status && !validStatus.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Validate kelas_id if provided
    if (kelas_id !== undefined && kelas_id !== null) {
      const [kelasExists] = await db.query('SELECT id FROM kelas WHERE id = ?', [kelas_id]);
      if (!kelasExists || kelasExists.length === 0) {
        return res.status(400).json({ message: 'Invalid kelas_id' });
      }
    }

    const result = await db.query(
      'INSERT INTO ujian (judul, durasi, waktu_mulai, waktu_selesai, status, kelas_id) VALUES (?, ?, ?, ?, ?, ?)',
      [judul, durasi, waktu_mulai || null, waktu_selesai || null, status || 'nonaktif', kelas_id || null]
    );

    res.status(201).json({ message: 'Ujian created successfully', ujianId: result.insertId });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create ujian', error: error.message });
  }
});

// Update ujian (admin/guru only)
router.put('/:id', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { id } = req.params;
    const { judul, durasi, waktu_mulai, waktu_selesai, status, kelas_id } = req.body;

    logger.debug({ id, body: req.body }, 'PUT /ujian/:id called');

    // Validate status
    const validStatus = ['aktif', 'nonaktif'];
    if (status && !validStatus.includes(status)) {
      return res.status(400).json({ message: 'Invalid status: ' + status });
    }

    // Handle empty kelas_id as null
    let kelasIdNum = null;
    if (kelas_id !== undefined && kelas_id !== null && kelas_id !== '') {
      kelasIdNum = parseInt(kelas_id);
      if (isNaN(kelasIdNum)) {
        return res.status(400).json({ message: 'Invalid kelas_id format' });
      }
    }

    // Build dynamic query based on provided fields
    const updates = [];
    const params = [];

    if (judul !== undefined) {
      updates.push('judul = ?');
      params.push(judul);
    }
    if (durasi !== undefined) {
      updates.push('durasi = ?');
      params.push(durasi);
    }
    if (waktu_mulai !== undefined) {
      updates.push('waktu_mulai = ?');
      params.push(waktu_mulai);
    }
    if (waktu_selesai !== undefined) {
      updates.push('waktu_selesai = ?');
      params.push(waktu_selesai);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (kelas_id !== undefined) {
      updates.push('kelas_id = ?');
      params.push(kelasIdNum);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    params.push(id);

    logger.debug({ updates: updates.length, params: params.length }, 'Executing ujian update query');
    await db.query(
      `UPDATE ujian SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ message: 'Ujian updated successfully' });
  } catch (error) {
    logger.error({ err: error }, 'Error updating ujian');
    res.status(500).json({ message: 'Failed to update ujian', error: error.message });
  }
});

// Delete ujian (admin/guru only)
router.delete('/:id', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { id } = req.params;

    // Delete related records first
    await db.query('DELETE FROM hasil WHERE ujian_id = ?', [id]);
    await db.query('DELETE FROM soal WHERE ujian_id = ?', [id]);

    await db.query('DELETE FROM ujian WHERE id = ?', [id]);

    res.json({ message: 'Ujian deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete ujian', error: error.message });
  }
});

// Get ujian by kelas_id (admin/guru only)
router.get('/kelas/:kelasId', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { kelasId } = req.params;

    // Verify that the class exists
    const [kelasExists] = await db.query('SELECT id FROM kelas WHERE id = ?', [kelasId]);
    if (!kelasExists || kelasExists.length === 0) {
      return res.status(400).json({ message: 'Invalid kelas_id' });
    }

    const ujian = await db.query(
      'SELECT u.*, k.nama_kelas FROM ujian u LEFT JOIN kelas k ON u.kelas_id = k.id WHERE u.kelas_id = ? ORDER BY u.created_at DESC',
      [kelasId]
    );

    res.json(ujian);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get ujian by kelas', error: error.message });
  }
});

// Get currently active exams (admin/guru only)
// Returns exams that are:
// 1. status = 'aktif'
// 2. Current time is between waktu_mulai and waktu_selesai (if those fields are set)
router.get('/active/now', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const ujian = await db.query(`
      SELECT u.*, k.nama_kelas 
      FROM ujian u 
      LEFT JOIN kelas k ON u.kelas_id = k.id 
      WHERE u.status = 'aktif' 
        AND (
          u.waktu_mulai IS NULL OR 
          u.waktu_mulai <= NOW()
        )
        AND (
          u.waktu_selesai IS NULL OR 
          u.waktu_selesai >= NOW()
        )
      ORDER BY u.waktu_mulai DESC, u.created_at DESC
    `);

    res.json(ujian);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get active exams', error: error.message });
  }
});

module.exports = router;