const express = require('express');
const db = require('../../config/database');
const authenticateToken = require('../../middleware/auth');
const authorizeRole = require('../../middleware/authorize');
const logActivity = require('../../middleware/auditLog');
const logger = require('../utils/logger');
const router = express.Router();

// Get all packages for an exam
router.get('/ujian/:ujianId', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { ujianId } = req.params;
    
    const packages = await db.query(`
      SELECT 
        sp.id,
        sp.ujian_id,
        sp.nama_paket,
        sp.kode_paket,
        sp.deskripsi,
        sp.is_active,
        sp.created_at,
        sp.updated_at,
        COUNT(psm.id) as jumlah_soal,
        (SELECT COUNT(*) FROM user_paket_assignments upa WHERE upa.paket_id = sp.id) as jumlah_siswa
      FROM soal_paket sp
      LEFT JOIN paket_soal_mapping psm ON sp.id = psm.paket_id
      WHERE sp.ujian_id = ?
      GROUP BY sp.id
      ORDER BY sp.kode_paket
    `, [ujianId]);

    res.json(packages);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching packages');
    res.status(500).json({ message: 'Gagal mengambil data paket', error: error.message });
  }
});

// Get single package details with questions
router.get('/:id', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const [paket] = await db.query(`
      SELECT 
        sp.id,
        sp.ujian_id,
        sp.nama_paket,
        sp.kode_paket,
        sp.deskripsi,
        sp.is_active,
        sp.created_at,
        sp.updated_at,
        u.judul as ujian_judul
      FROM soal_paket sp
      JOIN ujian u ON sp.ujian_id = u.id
      WHERE sp.id = ?
    `, [id]);

    if (!paket) {
      return res.status(404).json({ message: 'Paket tidak ditemukan' });
    }

    const questions = await db.query(`
      SELECT
        psm.nomor_urut_paket,
        s.id as soal_id,
        s.teks_soal,
        s.pilihan_a,
        s.pilihan_b,
        s.pilihan_c,
        s.pilihan_d,
        s.pilihan_e,
        s.kunci_jawaban,
        s.tipe_soal,
        s.bobot,
        s.gambar_soal,
        s.gambar_pilihan_a,
        s.gambar_pilihan_b,
        s.gambar_pilihan_c,
        s.gambar_pilihan_d,
        s.gambar_pilihan_e,
        s.jawaban_essay,
        s.jawaban_benar_salah,
        s.jawaban_multiple
      FROM paket_soal_mapping psm
      JOIN soal s ON psm.soaL_id = s.id
      WHERE psm.paket_id = ?
      ORDER BY psm.nomor_urut_paket
    `, [id]);

    paket.soal = questions;
    res.json(paket);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching package details');
    res.status(500).json({ message: 'Gagal mengambil detail paket', error: error.message });
  }
});

// Create new package
router.post('/', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { ujian_id, nama_paket, kode_paket, deskripsi } = req.body;

    if (!ujian_id || !nama_paket || !kode_paket) {
      return res.status(400).json({ message: 'ujian_id, nama_paket, dan kode_paket wajib diisi' });
    }

    // Check if package code already exists for this exam
    const existing = await db.query('SELECT id FROM soal_paket WHERE ujian_id = ? AND kode_paket = ?', [ujian_id, kode_paket]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Kode paket sudah digunakan untuk ujian ini' });
    }

    const result = await db.query(
      'INSERT INTO soal_paket (ujian_id, nama_paket, kode_paket, deskripsi) VALUES (?, ?, ?, ?)',
      [ujian_id, nama_paket, kode_paket, deskripsi || null]
    );

    logger.info({ insertId: result.insertId }, 'Package created');

    res.json({
      message: 'Paket berhasil dibuat',
      id: result.insertId
    });
  } catch (error) {
    logger.error({ err: error }, 'Error creating package');
    if (error.errno === 1062 || error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Kode paket sudah digunakan untuk ujian ini' });
    }
    return res.status(500).json({ message: 'Gagal membuat paket', error: error.message });
  }
});

// Update package
router.put('/:id', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { id } = req.params;
    const { nama_paket, kode_paket, deskripsi, is_active } = req.body;

    // If only is_active is being updated, use a simpler query
    if (req.body.is_active !== undefined && !nama_paket && !kode_paket) {
      const result = await db.query(
        `UPDATE soal_paket SET is_active = ? WHERE id = ?`,
        [is_active ? 1 : 0, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Paket tidak ditemukan' });
      }

      res.json({ message: 'Status paket berhasil diupdate' });
      return;
    }

    // Full update
    if (!nama_paket || !kode_paket) {
      return res.status(400).json({ message: 'nama_paket dan kode_paket wajib diisi' });
    }

    const result = await db.query(
      `UPDATE soal_paket
       SET nama_paket = ?, kode_paket = ?, deskripsi = ?, is_active = ?
       WHERE id = ?`,
      [nama_paket, kode_paket, deskripsi, is_active !== undefined ? is_active : 1, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Paket tidak ditemukan' });
    }

    // Log activity (ignore errors)
    try {
      await logActivity(req.user.id, 'UPDATE_PAKET_SOAL', 'soal_paket', id, { nama_paket, kode_paket }, req);
    } catch (logError) {
      logger.error({ err: logError }, 'Error logging activity');
    }

    res.json({ message: 'Paket berhasil diupdate' });
  } catch (error) {
    logger.error({ err: error }, 'Error updating package');
    res.status(500).json({ message: 'Gagal mengupdate paket', error: error.message });
  }
});

// Delete package
router.delete('/:id', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if package is assigned to any students
    const assignments = await db.query('SELECT COUNT(*) as count FROM user_paket_assignments WHERE paket_id = ?', [id]);
    if (assignments[0].count > 0) {
      return res.status(400).json({ 
        message: `Tidak dapat menghapus paket karena sudah digunakan oleh ${assignments[0].count} siswa` 
      });
    }

    await db.query('DELETE FROM soal_paket WHERE id = ?', [id]);

    await logActivity(req.user.id, 'DELETE_PAKET_SOAL', 'soal_paket', id, null, req);

    res.json({ message: 'Paket berhasil dihapus' });
  } catch (error) {
    logger.error({ err: error }, 'Error deleting package');
    res.status(500).json({ message: 'Gagal menghapus paket', error: error.message });
  }
});

// Generate package with randomized question order
router.post('/:id/generate', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { id } = req.params;
    const { shuffle_options } = req.body; // Optional: also shuffle answer options

    // Get package details
    const [paket] = await db.query('SELECT * FROM soal_paket WHERE id = ?', [id]);
    if (!paket) {
      return res.status(404).json({ message: 'Paket tidak ditemukan' });
    }

    // Get all questions for this exam
    const questions = await db.query('SELECT id FROM soal WHERE ujian_id = ? ORDER BY nomor_urut', [paket.ujian_id]);
    
    if (questions.length === 0) {
      return res.status(400).json({ message: 'Belum ada soal untuk ujian ini' });
    }

    // Shuffle questions
    const shuffledQuestions = [...questions];
    for (let i = shuffledQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledQuestions[i], shuffledQuestions[j]] = [shuffledQuestions[j], shuffledQuestions[i]];
    }

    // Delete existing mappings
    await db.query('DELETE FROM paket_soal_mapping WHERE paket_id = ?', [id]);

    // Insert new mappings with randomized order
    for (let i = 0; i < shuffledQuestions.length; i++) {
      await db.query(
        'INSERT INTO paket_soal_mapping (paket_id, soal_id, nomor_urut_paket) VALUES (?, ?, ?)',
        [id, shuffledQuestions[i].id, i + 1]
      );
    }

    // If shuffle_options is true, also shuffle answer options for each question in this package
    if (shuffle_options) {
      // This would require additional logic to shuffle pilihan_a, pilihan_b, etc.
      // For now, we'll just note that the feature exists
      logger.debug({ id }, 'Shuffle options requested for package');
    }

    await logActivity(req.user.id, 'GENERATE_PAKET_SOAL', 'soal_paket', id, { 
      jumlah_soal: questions.length,
      shuffle_options 
    }, req);

    res.json({ 
      message: 'Paket soal berhasil digenerate',
      jumlah_soal: questions.length
    });
  } catch (error) {
    logger.error({ err: error }, 'Error generating package');
    res.status(500).json({ message: 'Gagal generate paket soal', error: error.message });
  }
});

// Assign package to student
router.post('/assign', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { user_id, ujian_id, paket_id } = req.body;

    if (!user_id || !ujian_id || !paket_id) {
      return res.status(400).json({ message: 'user_id, ujian_id, dan paket_id wajib diisi' });
    }

    // Verify package belongs to the exam
    const [paket] = await db.query('SELECT id FROM soal_paket WHERE id = ? AND ujian_id = ?', [paket_id, ujian_id]);
    if (!paket) {
      return res.status(400).json({ message: 'Paket tidak valid untuk ujian ini' });
    }

    // Check if student already has an assignment
    const existing = await db.query('SELECT id FROM user_paket_assignments WHERE user_id = ? AND ujian_id = ?', [user_id, ujian_id]);
    
    if (existing.length > 0) {
      // Update existing assignment
      await db.query('UPDATE user_paket_assignments SET paket_id = ? WHERE user_id = ? AND ujian_id = ?', [paket_id, user_id, ujian_id]);
    } else {
      // Create new assignment
      await db.query('INSERT INTO user_paket_assignments (user_id, ujian_id, paket_id) VALUES (?, ?, ?)', [user_id, ujian_id, paket_id]);
    }

    await logActivity(req.user.id, 'ASSIGN_PAKET_SOAL', 'user_paket_assignments', null, { user_id, ujian_id, paket_id }, req);

    res.json({ message: 'Paket berhasil diassign ke siswa' });
  } catch (error) {
    logger.error({ err: error }, 'Error assigning package');
    res.status(500).json({ message: 'Gagal assign paket', error: error.message });
  }
});

// Bulk assign packages to students (round-robin or random)
router.post('/assign-bulk', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { ujian_id, assignment_mode } = req.body; // assignment_mode: 'random' or 'round_robin'

    if (!ujian_id) {
      return res.status(400).json({ message: 'ujian_id wajib diisi' });
    }

    // Get exam details to find the class
    const [exam] = await db.query('SELECT kelas_id FROM ujian WHERE id = ?', [ujian_id]);
    if (!exam) {
      return res.status(400).json({ message: 'Ujian tidak ditemukan' });
    }

    // Get all packages for this exam
    const packages = await db.query('SELECT id FROM soal_paket WHERE ujian_id = ? AND is_active = 1', [ujian_id]);
    if (packages.length === 0) {
      return res.status(400).json({ message: 'Belum ada paket aktif untuk ujian ini' });
    }

    // Get students from the exam's class only
    let students;
    if (exam.kelas_id) {
      // Filter by specific class
      students = await db.query('SELECT id, nama FROM users WHERE role = "siswa" AND kelas_id = ?', [exam.kelas_id]);
    } else {
      // No specific class, get all students
      students = await db.query('SELECT id, nama FROM users WHERE role = "siswa"');
    }
    
    if (students.length === 0) {
      return res.status(400).json({ message: 'Belum ada siswa' + (exam.kelas_id ? ' di kelas ini' : '') });
    }

    // Clear existing assignments for this exam first (to avoid duplicates)
    await db.query('DELETE FROM user_paket_assignments WHERE ujian_id = ?', [ujian_id]);

    let assignments = 0;

    // Sort students by name for consistent round-robin
    students.sort((a, b) => a.nama.localeCompare(b.nama));

    for (let i = 0; i < students.length; i++) {
      const student = students[i];

      // Select package based on mode
      let paketIndex;
      if (assignment_mode === 'random') {
        paketIndex = Math.floor(Math.random() * packages.length);
      } else {
        // Round-robin
        paketIndex = i % packages.length;
      }

      await db.query(
        'INSERT INTO user_paket_assignments (user_id, ujian_id, paket_id) VALUES (?, ?, ?)',
        [student.id, ujian_id, packages[paketIndex].id]
      );
      assignments++;
    }

    await logActivity(req.user.id, 'BULK_ASSIGN_PAKET_SOAL', 'user_paket_assignments', null, {
      ujian_id,
      assignment_mode,
      assignments_count: assignments,
      class_id: exam.kelas_id
    }, req);

    res.json({
      message: `Berhasil assign paket ke ${assignments} siswa`,
      assignments
    });
  } catch (error) {
    logger.error({ err: error }, 'Error bulk assigning packages');
    res.status(500).json({ message: 'Gagal assign paket massal', error: error.message });
  }
});

// Get assigned package for current student
router.get('/student/assigned/:ujianId', authenticateToken, async (req, res) => {
  try {
    const { ujianId } = req.params;
    const userId = req.user.id;

    const [assignment] = await db.query(`
      SELECT 
        upa.paket_id,
        sp.nama_paket,
        sp.kode_paket
      FROM user_paket_assignments upa
      JOIN soal_paket sp ON upa.paket_id = sp.id
      WHERE upa.user_id = ? AND upa.ujian_id = ?
    `, [userId, ujianId]);

    if (!assignment) {
      return res.status(404).json({ message: 'Anda belum diassign paket soal' });
    }

    res.json(assignment);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching assigned package');
    res.status(500).json({ message: 'Gagal mengambil paket soal', error: error.message });
  }
});

// Get all student assignments for an exam (for admin/teacher)
router.get('/student/assignments/:ujianId', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { ujianId } = req.params;

    const assignments = await db.query(`
      SELECT
        upa.user_id,
        upa.paket_id,
        u.nama as nama_siswa,
        sp.nama_paket,
        sp.kode_paket
      FROM user_paket_assignments upa
      JOIN users u ON upa.user_id = u.id
      JOIN soal_paket sp ON upa.paket_id = sp.id
      WHERE upa.ujian_id = ?
      ORDER BY u.nama
    `, [ujianId]);

    res.json(assignments);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching student assignments');
    res.status(500).json({ message: 'Gagal mengambil data assign siswa', error: error.message });
  }
});

// Get questions for student's assigned package
router.get('/student/questions/:ujianId', authenticateToken, async (req, res) => {
  try {
    const { ujianId } = req.params;
    const userId = req.user.id;

    const [assignment] = await db.query(`
      SELECT upa.paket_id
      FROM user_paket_assignments upa
      WHERE upa.user_id = ? AND upa.ujian_id = ?
    `, [userId, ujianId]);

    if (!assignment) {
      return res.status(404).json({ message: 'Anda belum diassign paket soal' });
    }

    const questions = await db.query(`
      SELECT 
        psm.nomor_urut_paket as nomor_soal,
        s.id,
        s.teks_soal,
        s.pilihan_a,
        s.pilihan_b,
        s.pilihan_c,
        s.pilihan_d,
        s.pilihan_e,
        s.tipe_soal,
        s.bobot,
        s.gambar_soal,
        s.gambar_pilihan_a,
        s.gambar_pilihan_b,
        s.gambar_pilihan_c,
        s.gambar_pilihan_d,
        s.gambar_pilihan_e
      FROM paket_soal_mapping psm
      JOIN soal s ON psm.soaL_id = s.id
      WHERE psm.paket_id = ?
      ORDER BY psm.nomor_urut_paket
    `, [assignment.paket_id]);

    res.json({
      paket_id: assignment.paket_id,
      questions
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching package questions');
    res.status(500).json({ message: 'Gagal mengambil soal', error: error.message });
  }
});

module.exports = router;
