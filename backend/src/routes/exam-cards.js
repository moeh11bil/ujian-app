/**
 * Exam Card Routes
 * 
 * Routes for generating and downloading exam cards (PDF)
 * - Individual student exam card
 * - Bulk exam cards for all students in a class
 * - Export student data with passwords (Excel)
 */

const express = require('express');
const db = require('../../config/database');
const authenticateToken = require('../../middleware/auth');
const authorizeRole = require('../../middleware/authorize');
const { generateExamCardsPDF } = require('../../utils/examCardPDF');
const xlsx = require('xlsx');
const logActivity = require('../../middleware/auditLog');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/exam-cards/student/:studentId
 * Generate individual exam card for a student
 * Access: Admin, Guru, or the student themselves
 */
router.get('/student/:studentId', authenticateToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { include_password = 'true' } = req.query;
    const includePassword = include_password === 'true';

    // Check authorization: admin/guru or the student themselves
    if (req.user.role === 'siswa' && req.user.id !== parseInt(studentId)) {
      return res.status(403).json({ message: 'Anda hanya bisa mengakses kartu ujian sendiri' });
    }

    if (!['admin', 'guru', 'siswa'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    // Get student data with class info
    const studentsResult = await db.query(
      `SELECT u.id, u.nama, u.email, u.nisn, u.no_peserta, u.password, u.exam_password, k.nama_kelas
       FROM users u
       LEFT JOIN kelas k ON u.kelas_id = k.id
       WHERE u.id = ? AND u.role = 'siswa'`,
      [studentId]
    );
    const students = Array.isArray(studentsResult) ? studentsResult : (studentsResult || []);

    if (!students || students.length === 0) {
      return res.status(404).json({ message: 'Siswa tidak ditemukan' });
    }

    const student = students[0];

    // Get available exams for this student's class
    const examsResult = await db.query(
      `SELECT id, judul, durasi, waktu_mulai, waktu_selesai, passing_grade
       FROM ujian
       WHERE status = 'aktif' 
         AND (kelas_id IS NULL OR kelas_id = ?)
       ORDER BY waktu_mulai ASC`,
      [student.kelas_id]
    );
    const exams = Array.isArray(examsResult) ? examsResult : (examsResult || []);

    // Prepare student data for PDF - use exam_password (plain text) if available
    const studentData = {
      ...student,
      password_display: includePassword ? (student.exam_password || 'Hubungi admin') : ''
    };

    // Generate PDF
    const doc = generateExamCardsPDF([studentData], exams, {
      includePassword: includePassword,
      schoolName: process.env.SCHOOL_NAME || 'Sistem Ujian Online',
      academicYear: process.env.ACADEMIC_YEAR || '2024/2025',
      bulk: false
    });

    // Set response headers
    const filename = `Kartu_Ujian_${student.nama.replace(/\s+/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

    // Log activity BEFORE streaming (so it doesn't fail after response ends)
    logActivity(req.user.id, 'DOWNLOAD_EXAM_CARD', 'exam_card', studentId, 
      { student_name: student.nama, include_password: includePassword }, req);

    // Stream PDF to response
    doc.pipe(res);
    doc.end();

  } catch (error) {
    logger.error({ err: error }, 'Error generating exam card');
    res.status(500).json({ 
      message: 'Gagal membuat kartu ujian', 
      error: error.message 
    });
  }
});

/**
 * GET /api/exam-cards/class/:kelasId
 * Generate bulk exam cards for all students in a class
 * Access: Admin, Guru only
 */
router.get('/class/:kelasId', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { kelasId } = req.params;
    const { include_password = 'false' } = req.query;
    const includePassword = include_password === 'true';

    // Verify class exists
    const kelasResult = await db.query('SELECT id, nama_kelas FROM kelas WHERE id = ?', [kelasId]);
    const kelas = Array.isArray(kelasResult) ? kelasResult : [kelasResult];
    if (!kelas || kelas.length === 0) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan' });
    }

    // Get all students in this class
    const studentsResult = await db.query(
      `SELECT u.id, u.nama, u.email, u.nisn, u.no_peserta, u.exam_password, k.nama_kelas
       FROM users u
       LEFT JOIN kelas k ON u.kelas_id = k.id
       WHERE u.kelas_id = ? AND u.role = 'siswa'
       ORDER BY u.nama ASC`,
      [kelasId]
    );
    const students = Array.isArray(studentsResult) ? studentsResult : (studentsResult || []);

    if (!students || students.length === 0) {
      return res.status(404).json({ message: 'Tidak ada siswa di kelas ini' });
    }

    // Get available exams for this class
    const examsResult = await db.query(
      `SELECT id, judul, durasi, waktu_mulai, waktu_selesai, passing_grade
       FROM ujian
       WHERE status = 'aktif' 
         AND (kelas_id IS NULL OR kelas_id = ?)
       ORDER BY waktu_mulai ASC`,
      [kelasId]
    );
    const exams = Array.isArray(examsResult) ? examsResult : (examsResult || []);

    // Prepare students data for PDF - use exam_password (plain text)
    const studentsData = students.map(student => ({
      ...student,
      password_display: includePassword ? (student.exam_password || 'Hubungi admin') : ''
    }));

    // Generate PDF
    const doc = generateExamCardsPDF(studentsData, exams, {
      includePassword: includePassword,
      schoolName: process.env.SCHOOL_NAME || 'Sistem Ujian Online',
      academicYear: process.env.ACADEMIC_YEAR || '2024/2025',
      bulk: true
    });

    // Set response headers
    const className = kelas[0].nama_kelas.replace(/\s+/g, '_');
    const filename = `Kartu_Ujian_Kelas_${className}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

    // Log activity BEFORE streaming
    logActivity(req.user.id, 'DOWNLOAD_BULK_EXAM_CARDS', 'exam_card', kelasId, 
      { class_name: kelas[0].nama_kelas, student_count: students.length, include_password: includePassword }, req);

    // Stream PDF to response
    doc.pipe(res);
    doc.end();

  } catch (error) {
    logger.error({ err: error }, 'Error generating bulk exam cards');
    res.status(500).json({ 
      message: 'Gagal membuat kartu ujian massal', 
      error: error.message 
    });
  }
});

/**
 * GET /api/exam-cards/all
 * Generate exam cards for ALL students (across all classes)
 * Access: Admin only
 */
router.get('/all', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { include_password = 'false' } = req.query;
    const includePassword = include_password === 'true';

    // Get all students with class info
    const studentsResult = await db.query(
      `SELECT u.id, u.nama, u.email, u.nisn, u.no_peserta, u.exam_password, k.nama_kelas
       FROM users u
       LEFT JOIN kelas k ON u.kelas_id = k.id
       WHERE u.role = 'siswa'
       ORDER BY k.nama_kelas ASC, u.nama ASC`
    );
    // Log for debugging
    logger.info('Students fetch result count:', Array.isArray(studentsResult) ? studentsResult.length : 'unknown');
    
    const students = Array.isArray(studentsResult) ? studentsResult : (studentsResult || []);

    if (!students || students.length === 0) {
      return res.status(404).json({ message: 'Tidak ada data siswa' });
    }

    // Get all active exams
    const examsResult = await db.query(
      `SELECT id, judul, durasi, waktu_mulai, waktu_selesai, passing_grade
       FROM ujian
       WHERE status = 'aktif'
       ORDER BY waktu_mulai ASC`
    );
    const exams = Array.isArray(examsResult) ? examsResult : (examsResult || []);

    // Prepare students data - use exam_password (plain text)
    const studentsData = students.map(student => ({
      ...student,
      password_display: includePassword ? (student.exam_password || 'Hubungi admin') : ''
    }));

    // Generate PDF
    const doc = generateExamCardsPDF(studentsData, exams, {
      includePassword: includePassword,
      schoolName: process.env.SCHOOL_NAME || 'Sistem Ujian Online',
      academicYear: process.env.ACADEMIC_YEAR || '2024/2025',
      bulk: true
    });

    // Set response headers
    const filename = `Kartu_Ujian_Semua_Siswa.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

    // Log activity BEFORE streaming
    logActivity(req.user.id, 'DOWNLOAD_ALL_EXAM_CARDS', 'exam_card', null, 
      { student_count: students.length, include_password: includePassword }, req);

    // Stream PDF to response
    doc.pipe(res);
    doc.end();

  } catch (error) {
    logger.error({ err: error }, 'Error generating all exam cards');
    res.status(500).json({ 
      message: 'Gagal membuat kartu ujian semua siswa', 
      error: error.message 
    });
  }
});

/**
 * GET /api/exam-cards/export-students-with-passwords
 * Export student data with passwords to Excel
 * Access: Admin only
 */
router.get('/export-students-with-passwords', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    // Get all students with passwords
    const studentsResult = await db.query(
      `SELECT u.id, u.nama, u.email, u.nisn, u.no_peserta, u.password, u.exam_password, k.nama_kelas, u.created_at
       FROM users u
       LEFT JOIN kelas k ON u.kelas_id = k.id
       WHERE u.role = 'siswa'
       ORDER BY k.nama_kelas ASC, u.nama ASC`
    );
    const students = Array.isArray(studentsResult) ? studentsResult : (studentsResult || []);

    if (!students || students.length === 0) {
      return res.status(404).json({ message: 'Tidak ada data siswa' });
    }

    // Prepare data for Excel - use exam_password (plain text)
    const excelData = students.map((student, index) => ({
      'No': index + 1,
      'NIS': student.id.toString().padStart(6, '0'),
      'NISN': student.nisn || '-',
      'No. Peserta': student.no_peserta || '-',
      'Nama Lengkap': student.nama,
      'Email': student.email,
      'Password Ujian': student.exam_password || 'Hubungi admin',
      'Password Login (Hash)': '(Tersimpan terenkripsi)',
      'Kelas': student.nama_kelas || '-',
      'Tanggal Dibuat': new Date(student.created_at).toLocaleDateString('id-ID')
    }));

    // Create workbook and worksheet
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(excelData);

    // Set column widths
    ws['!cols'] = [
      { wch: 5 },  // No
      { wch: 10 }, // NIS
      { wch: 15 }, // NISN
      { wch: 18 }, // No. Peserta
      { wch: 30 }, // Nama
      { wch: 35 }, // Email
      { wch: 20 }, // Password
      { wch: 15 }, // Kelas
      { wch: 15 }  // Tanggal
    ];

    xlsx.utils.book_append_sheet(wb, ws, 'Data Siswa');

    // Generate Excel file
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Set response headers
    const filename = `Data_Siswa_Dengan_Password_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

    // Log activity BEFORE sending
    logActivity(req.user.id, 'EXPORT_STUDENTS_WITH_PASSWORDS', 'student_export', null, 
      { student_count: students.length }, req);

    res.send(buffer);

  } catch (error) {
    logger.error({ err: error }, 'Error exporting students with passwords');
    res.status(500).json({ 
      message: 'Gagal mengekspor data siswa', 
      error: error.message 
    });
  }
});

/**
 * GET /api/exam-cards/:kelasId/info
 * Get exam card generation info for a class (student count, available exams)
 * Access: Admin, Guru
 */
router.get('/:kelasId/info', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { kelasId } = req.params;

    // Get class info
    const kelasResult = await db.query('SELECT id, nama_kelas FROM kelas WHERE id = ?', [kelasId]);
    const kelas = Array.isArray(kelasResult) ? kelasResult : [kelasResult];
    
    if (!kelas || kelas.length === 0) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan' });
    }

    // Count students
    const studentCountResult = await db.query(
      'SELECT COUNT(*) as studentCount FROM users WHERE kelas_id = ? AND role = \'siswa\'',
      [kelasId]
    );
    const studentCount = Array.isArray(studentCountResult) 
      ? (studentCountResult[0]?.studentCount || studentCountResult[0]?.['COUNT(*)'] || 0)
      : (studentCountResult?.studentCount || studentCountResult?.['COUNT(*)'] || 0);

    // Get active exams
    const examsResult = await db.query(
      `SELECT id, judul, durasi, waktu_mulai, waktu_selesai
       FROM ujian
       WHERE status = 'aktif'
         AND (kelas_id IS NULL OR kelas_id = ?)
       ORDER BY waktu_mulai ASC`,
      [kelasId]
    );
    const exams = Array.isArray(examsResult) ? examsResult : (examsResult || []);

    res.json({
      kelas: kelas[0],
      studentCount,
      examCount: exams.length,
      exams: exams.map(exam => ({
        id: exam.id,
        judul: exam.judul,
        durasi: exam.durasi,
        periode: `${new Date(exam.waktu_mulai).toLocaleDateString('id-ID')} - ${new Date(exam.waktu_selesai).toLocaleDateString('id-ID')}`
      }))
    });

  } catch (error) {
    logger.error({ err: error }, 'Error getting exam card info');
    res.status(500).json({
      message: 'Gagal mengambil informasi kartu ujian',
      error: error.message
    });
  }
});

module.exports = router;
