const express = require('express');
const db = require('../../config/database');
const authenticateToken = require('../../middleware/auth');
const authorizeRole = require('../../middleware/authorize');
const logger = require('../utils/logger');
const router = express.Router();

router.get('/', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    // Total Students
    const totalStudentsResult = await db.query('SELECT COUNT(*) as count FROM users WHERE role = "siswa"');
    const totalStudents = totalStudentsResult[0]?.count || 0;

    // Total Admins and Teachers
    const totalAdminsAndGurusResult = await db.query('SELECT COUNT(*) as count FROM users WHERE role IN ("admin", "guru")');
    const totalAdminsAndGurus = totalAdminsAndGurusResult[0]?.count || 0;

    // Total Classes
    const totalKelasResult = await db.query('SELECT COUNT(*) as count FROM kelas');
    const totalKelas = totalKelasResult[0]?.count || 0;

    // Total Exams
    const totalUjianResult = await db.query('SELECT COUNT(*) as count FROM ujian');
    const totalUjian = totalUjianResult[0]?.count || 0;

    // Total Questions
    const totalSoalResult = await db.query('SELECT COUNT(*) as count FROM soal');
    const totalSoal = totalSoalResult[0]?.count || 0;

    // Average Score
    const averageScoreResult = await db.query('SELECT AVG(skor) as avg_skor FROM hasil');
    const averageScore = averageScoreResult[0]?.avg_skor || 0;

    // Most Popular Exam
    const mostPopularUjianResult = await db.query(`
      SELECT uj.id, uj.judul, COUNT(h.id) as submission_count
      FROM ujian uj
      LEFT JOIN hasil h ON uj.id = h.ujian_id
      GROUP BY uj.id, uj.judul
      ORDER BY submission_count DESC
      LIMIT 1
    `);
    const mostPopularUjian = mostPopularUjianResult[0] || null;

    // Most Active Student
    const mostActiveStudentResult = await db.query(`
      SELECT u.id, u.nama, COUNT(h.id) as exam_count
      FROM users u
      LEFT JOIN hasil h ON u.id = h.user_id
      WHERE u.role = 'siswa'
      GROUP BY u.id, u.nama
      ORDER BY exam_count DESC
      LIMIT 1
    `);
    const mostActiveStudent = mostActiveStudentResult[0] || null;

    // Recent Results
    const recentResults = await db.query(`
      SELECT h.*, u.nama as user_nama, uj.judul as ujian_judul
      FROM hasil h
      JOIN users u ON h.user_id = u.id
      JOIN ujian uj ON h.ujian_id = uj.id
      ORDER BY h.created_at DESC
      LIMIT 5
    `);

    res.json({
      totalStudents: parseInt(totalStudents),
      totalAdminsAndGurus: parseInt(totalAdminsAndGurus),
      totalKelas: parseInt(totalKelas),
      totalUjian: parseInt(totalUjian),
      totalSoal: parseInt(totalSoal),
      averageScore: parseFloat(averageScore) || 0,
      mostPopularUjian: mostPopularUjian,
      mostActiveStudent: mostActiveStudent,
      recentResults
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching dashboard statistics');
    res.status(500).json({ message: 'Failed to get dashboard statistics', error: error.message });
  }
});

module.exports = router;