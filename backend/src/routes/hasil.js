const express = require('express');
const db = require('../../config/database');
const authenticateToken = require('../../middleware/auth');
const authorizeRole = require('../../middleware/authorize');
const { sendExamResultNotification } = require('../../config/email');
const logActivity = require('../../middleware/auditLog');
const logger = require('../utils/logger');
const { checkAnswer } = require('../utils/answerChecker');
const router = express.Router();

// Helper: re-grade a submission against current soal bobot & keys
async function recalculateSubmission(hasilId, ujianId) {
  const [hasil] = await db.query('SELECT * FROM hasil WHERE id = ?', [hasilId]);
  if (!hasil) return null;

  const [ujian] = await db.query('SELECT passing_grade FROM ujian WHERE id = ?', [ujianId]);
  const passedThreshold = ujian ? parseFloat(ujian.passing_grade || 70) : 70;

  const soal = await db.query(
    'SELECT id, tipe_soal, kunci_jawaban, jawaban_benar_salah, jawaban_multiple, bobot FROM soal WHERE ujian_id = ?',
    [ujianId]
  );

  const jawabanSiswa = typeof hasil.jawaban_siswa === 'string'
    ? JSON.parse(hasil.jawaban_siswa)
    : (hasil.jawaban_siswa || {});

  let autoScore = 0;
  let correctCount = 0;
  let maxAuto = 0;
  let maxEssay = 0;

  for (const s of soal) {
    const bobot = parseFloat(s.bobot || 1);
    if (s.tipe_soal === 'essay') {
      maxEssay += bobot;
    } else {
      maxAuto += bobot;
      if (checkAnswer(s, jawabanSiswa[s.id])) {
        autoScore += bobot;
        correctCount++;
      }
    }
  }

  const essayGrading = await db.query(
    `SELECT COALESCE(SUM(given_score), 0) as total,
            COUNT(CASE WHEN given_score > 0 THEN 1 END) as correct_essay_count
     FROM essay_grading WHERE hasil_id = ?`,
    [hasilId]
  );
  const essayScore = parseFloat(essayGrading[0].total);
  correctCount += parseInt(essayGrading[0].correct_essay_count || 0);
  const maxTotal = maxAuto + maxEssay;
  const liveSkor = maxTotal > 0 ? ((autoScore + essayScore) / maxTotal) * 100 : 0;
  const liveGrade = liveSkor >= 90 ? 'A' : liveSkor >= 80 ? 'B' : liveSkor >= 70 ? 'C' : liveSkor >= 60 ? 'D' : 'E';
  const livePassed = liveSkor >= (passedThreshold || 70);

  return { autoScore, essayScore, correctCount, maxAuto, maxEssay, maxTotal, liveSkor, liveGrade, livePassed };
}

// Get all hasil (admin/guru can see all, siswa can see own)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query;
    let params = [];

    if (req.user.role === 'siswa') {
      // Siswa hanya bisa melihat hasil mereka sendiri
      query = `
        SELECT h.*, u.nama as user_nama, uj.judul as ujian_judul, uj.durasi, uj.passing_grade
        FROM hasil h
        JOIN users u ON h.user_id = u.id
        JOIN ujian uj ON h.ujian_id = uj.id
        WHERE h.user_id = ?
        ORDER BY h.created_at DESC
      `;
      params = [req.user.id];
    } else {
      // Admin/guru bisa melihat semua hasil
      query = `
        SELECT h.*, u.nama as user_nama, u.email as user_email, uj.judul as ujian_judul, uj.durasi, uj.passing_grade
        FROM hasil h
        JOIN users u ON h.user_id = u.id
        JOIN ujian uj ON h.ujian_id = uj.id
        ORDER BY h.created_at DESC
      `;
    }

    const hasil = await db.query(query, params);
    
    // Re-grade each submission against current bobot & answer keys
    const resultsWithScores = await Promise.all(hasil.map(async (h) => {
      const calc = await recalculateSubmission(h.id, h.ujian_id);
      return {
        ...h,
        skor: calc.liveSkor,
        grade: calc.liveGrade,
        passed: calc.livePassed,
        jumlah_benar: calc.correctCount,
        max_auto_score: calc.maxAuto,
        max_essay_score: calc.maxEssay,
        max_total_score: calc.maxTotal
      };
    }));

    res.json(resultsWithScores);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get results', error: error.message });
  }
});

// Get hasil by user (admin/guru can see all, siswa can see own)
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user is trying to access their own results or if they're admin/guru
    if (req.user.id != userId && req.user.role !== 'admin' && req.user.role !== 'guru') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const hasil = await db.query(`
      SELECT h.*, u.nama as user_nama, uj.judul as ujian_judul 
      FROM hasil h
      JOIN users u ON h.user_id = u.id
      JOIN ujian uj ON h.ujian_id = uj.id
      WHERE h.user_id = ?
      ORDER BY h.created_at DESC
    `, [userId]);
    
    // Re-grade each submission against current bobot & answer keys
    const resultsWithScores = await Promise.all(hasil.map(async (h) => {
      const calc = await recalculateSubmission(h.id, h.ujian_id);
      return {
        ...h,
        skor: calc.liveSkor,
        grade: calc.liveGrade,
        passed: calc.livePassed,
        jumlah_benar: calc.correctCount,
        max_auto_score: calc.maxAuto,
        max_essay_score: calc.maxEssay,
        max_total_score: calc.maxTotal
      };
    }));

    res.json(resultsWithScores);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get user results', error: error.message });
  }
});

// Get hasil by ujian (admin/guru only)
router.get('/ujian/:ujianId', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { ujianId } = req.params;
    
    const hasil = await db.query(`
      SELECT h.*, u.nama as user_nama, u.email as user_email 
      FROM hasil h 
      JOIN users u ON h.user_id = u.id 
      WHERE h.ujian_id = ?
      ORDER BY h.skor DESC
    `, [ujianId]);
    
    // Re-grade each submission against current bobot & answer keys
    const resultsWithScores = await Promise.all(hasil.map(async (h) => {
      const calc = await recalculateSubmission(h.id, h.ujian_id);
      return {
        ...h,
        skor: calc.liveSkor,
        grade: calc.liveGrade,
        passed: calc.livePassed,
        jumlah_benar: calc.correctCount,
        max_auto_score: calc.maxAuto,
        max_essay_score: calc.maxEssay,
        max_total_score: calc.maxTotal
      };
    }));
    
    res.json(resultsWithScores);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get exam results', error: error.message });
  }
});

// Submit hasil (siswa only)
router.post('/', authenticateToken, authorizeRole(['siswa']), async (req, res) => {
  try {
    const { ujian_id, jawaban_siswa } = req.body;

    logger.debug({ ujian_id, userId: req.user.id }, 'POST /api/hasil called');

    let examId;
    if (typeof ujian_id === 'string') {
      examId = parseInt(ujian_id);
    } else {
      examId = ujian_id;
    }

    if (isNaN(examId)) {
      logger.warn({ ujian_id }, 'Invalid examId submitted');
      return res.status(400).json({ message: 'Invalid exam ID' });
    }

    const ujian = await db.query('SELECT * FROM ujian WHERE id = ?', [examId]);
    if (!ujian || ujian.length === 0) {
      logger.warn({ examId }, 'Exam does not exist');
      return res.status(400).json({ message: 'Exam does not exist' });
    }

    const now = new Date();
    const startTime = new Date(ujian[0].waktu_mulai);
    const endTime = new Date(ujian[0].waktu_selesai);

    if (ujian[0].status !== 'aktif' || now < startTime || now > endTime) {
      logger.warn({ examId, userId: req.user.id, status: ujian[0].status }, 'Exam submission rejected - not active or time passed');
      return res.status(400).json({
        message: 'Exam is not active or time has passed',
        details: {
          isActive: ujian[0].status === 'aktif',
          isWithinTime: now >= startTime && now <= endTime,
          currentTime: now.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString()
        }
      });
    }

    const soal = await db.query('SELECT id, kunci_jawaban, jawaban_benar_salah, jawaban_multiple, tipe_soal, bobot FROM soal WHERE ujian_id = ?', [examId]);

    // Separate auto-gradable (multiple choice) and essay questions
    let autoScore = 0;
    let correctCount = 0;
    let maxAutoScore = 0;
    let totalEssayBobot = 0;
    const essayAnswers = {};

    for (const s of soal) {
      const userAnswer = jawaban_siswa[s.id];

      if (s.tipe_soal === 'essay') {
        // Store essay answer for manual grading
        if (userAnswer) {
          essayAnswers[`essay_${s.id}`] = userAnswer;
        }
        totalEssayBobot += s.bobot || 1;
      } else {
        // Auto-grade multiple choice, benar/salah, multiple answer
        maxAutoScore += s.bobot || 1;
        if (checkAnswer(s, userAnswer)) {
          autoScore += s.bobot || 1;
          correctCount++;
        }
      }
    }

    // Calculate scores
    const totalQuestions = soal.length;
    const essayQuestionsCount = soal.filter(s => s.tipe_soal === 'essay').length;
    
    const totalMaxScore = maxAutoScore + totalEssayBobot;
    
    // Initial percentage score (essay counts as 0 until graded)
    const rawSkor = totalMaxScore > 0 ? (autoScore / totalMaxScore) * 100 : 0;
    const skor = isNaN(rawSkor) ? 0 : rawSkor;
    const cleanAutoScore = isNaN(autoScore) ? 0 : autoScore;
    
    // Determine grade based on percentage
    const grade = skor >= 90 ? 'A' : skor >= 80 ? 'B' : skor >= 70 ? 'C' : skor >= 60 ? 'D' : 'E';
    const passed = skor >= (ujian[0].passing_grade || 70);
    
    // Determine manual_grade_status
    const manualGradeStatus = essayQuestionsCount > 0 ? 'pending' : 'completed';

    // Save the result with essay tracking
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    logger.debug({
      user_id: req.user.id,
      examId,
      skor,
      correctCount,
      totalQuestions,
      autoScore,
      manualGradeStatus,
      essayAnswers: JSON.stringify(essayAnswers)
    }, 'Attempting to insert result into database');

    const result = await db.query(`
      INSERT INTO hasil (
        user_id, ujian_id, skor, jawaban_siswa, jumlah_benar, jumlah_soal, 
        waktu_mulai, waktu_selesai, grade, passed, ip_address,
        auto_grade_score, total_essay_score, manual_grade_status, essay_scores
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.user.id, examId, Math.round(skor * 100) / 100, JSON.stringify(jawaban_siswa), 
      correctCount, totalQuestions, new Date(), new Date(), 
      grade, passed ? 1 : 0, ipAddress,
      Math.round(cleanAutoScore * 100) / 100, 0, manualGradeStatus, JSON.stringify(essayAnswers)
    ]);

    // If there are essay questions, create empty grading records
    if (essayQuestionsCount > 0) {
      const essayQuestions = soal.filter(s => s.tipe_soal === 'essay');
      for (const eq of essayQuestions) {
        await db.query(`
          INSERT INTO essay_grading (hasil_id, soal_id, student_answer, max_score, given_score)
          VALUES (?, ?, ?, ?, 0)
        `, [result.insertId, eq.id, essayAnswers[`essay_${eq.id}`] || '', eq.bobot || 1]);
      }
    }

    await logActivity(req.user.id, 'EXAM_SUBMITTED', 'hasil', result.insertId, { 
      ujian_id: examId, 
      autoScore, 
      essayQuestionsCount,
      totalQuestions,
      manualGradeStatus 
    }, req);

    const users = await db.query('SELECT nama, email FROM users WHERE id = ?', [req.user.id]);
    if (users.length && users[0].email) {
      try {
        await sendExamResultNotification(
          users[0].email, 
          ujian[0].judul, 
          skor,
          autoScore, 
          totalQuestions, 
          users[0].nama,
          essayQuestionsCount > 0 // Indicate pending essay grading
        );
      } catch (emailError) {
        logger.warn({ err: emailError, userId: req.user.id }, 'Failed to send result email');
      }
    }

    res.status(201).json({
      message: essayQuestionsCount > 0 
        ? 'Hasil submitted successfully. Essay questions pending manual grading.' 
        : 'Hasil submitted successfully',
      hasilId: result.insertId,
      skor,
      auto_grade_score: autoScore,
      max_auto_score: maxAutoScore,
      essay_questions_count: essayQuestionsCount,
      total_essay_bobot: totalEssayBobot,
      manual_grade_status: manualGradeStatus,
      grade,
      passed
    });
  } catch (error) {
    logger.error({ err: error, body: req.body }, 'Error submitting hasil');
    res.status(500).json({ message: 'Failed to submit results', error: error.message });
  }
});

// Get specific hasil (admin/guru can see any, siswa can see own)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const hasil = await db.query(`
      SELECT h.*, u.nama as user_nama, uj.judul as ujian_judul
      FROM hasil h
      JOIN users u ON h.user_id = u.id
      JOIN ujian uj ON h.ujian_id = uj.id
      WHERE h.id = ?
    `, [id]);

    if (!hasil.length) {
      return res.status(404).json({ message: 'Result not found' });
    }

    // Check if user can access this result
    if (req.user.id != hasil[0].user_id && req.user.role !== 'admin' && req.user.role !== 'guru') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(hasil[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get result', error: error.message });
  }
});

// Reset exam attempt for a specific user (admin/guru only)
router.delete('/ujian/:ujianId/user/:userId', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { ujianId, userId } = req.params;

    // Verify that the exam and user exist
    const examExists = await db.query('SELECT id FROM ujian WHERE id = ?', [ujianId]);
    if (!examExists.length) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    const userExists = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (!userExists.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete the result record
    const result = await db.query(
      'DELETE FROM hasil WHERE ujian_id = ? AND user_id = ?',
      [ujianId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No exam result found for this user and exam combination' });
    }

    res.json({
      message: 'Exam attempt reset successfully',
      deletedRows: result.affectedRows
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reset exam attempt', error: error.message });
  }
});

module.exports = router;