const express = require('express');
const db = require('../../config/database');
const authenticateToken = require('../../middleware/auth');
const authorizeRole = require('../../middleware/authorize');
const { sendEssayGradedNotification, sendExamResultNotification } = require('../../config/email');
const logActivity = require('../../middleware/auditLog');
const logger = require('../utils/logger');
const { checkAnswer } = require('../utils/answerChecker');
const router = express.Router();

// =====================================================
// GRADING QUEUE - Untuk Guru/Admin
// =====================================================

// Get grading queue (essay yang perlu diperiksa)
router.get('/grading-queue', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { status, ujian_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        h.id as hasil_id,
        h.user_id,
        u.nama as student_name,
        u.email as student_email,
        h.ujian_id,
        uj.judul as ujian_judul,
        uj.durasi,
        uj.passing_grade,
        h.auto_grade_score,
        h.total_essay_score,
        h.skor as current_score,
        h.waktu_selesai as submitted_at,
        h.graded_by,
        h.graded_at,
        TIMESTAMPDIFF(MINUTE, h.waktu_selesai, NOW()) as minutes_since_submission,
        (SELECT COUNT(*) FROM soal s WHERE s.ujian_id = h.ujian_id AND s.tipe_soal = 'essay') as total_essay_questions,
        (SELECT COUNT(*) FROM essay_grading eg WHERE eg.hasil_id = h.id) as total_essay_entries,
        (SELECT COUNT(*) FROM essay_grading eg WHERE eg.hasil_id = h.id AND eg.given_score > 0) as graded_essay_count,
        (SELECT COUNT(*) FROM essay_grading eg WHERE eg.hasil_id = h.id AND (eg.given_score IS NULL OR eg.given_score = 0)) as pending_essay_count
      FROM hasil h
      JOIN users u ON h.user_id = u.id
      JOIN ujian uj ON h.ujian_id = uj.id
      WHERE EXISTS (
        SELECT 1 FROM soal s WHERE s.ujian_id = h.ujian_id AND s.tipe_soal = 'essay'
      )
    `;

    const params = [];

    if (ujian_id) {
      query += ' AND h.ujian_id = ?';
      params.push(ujian_id);
    }

    // Build HAVING clause based on actual essay_grading status
    const havingClauses = [];
    if (status === 'pending') {
      havingClauses.push('(pending_essay_count > 0 AND graded_essay_count = 0) OR (total_essay_questions > 0 AND total_essay_entries = 0)');
    } else if (status === 'partial') {
      havingClauses.push('graded_essay_count > 0 AND pending_essay_count > 0');
    } else if (status === 'completed') {
      havingClauses.push('pending_essay_count = 0 AND graded_essay_count > 0');
    } else {
      // Default: show pending, partial, and freshly reset submissions
      havingClauses.push('(pending_essay_count > 0 OR graded_essay_count > 0 OR (total_essay_questions > 0 AND total_essay_entries = 0))');
    }

    if (havingClauses.length > 0) {
      query += ' HAVING ' + havingClauses.join(' AND ');
    }

    query += ' ORDER BY h.waktu_selesai ASC';
    
    // Add LIMIT and OFFSET for pagination
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const queue = await db.query(query, params);

    // Get total count - need to recalculate with proper WHERE
    let countQuery = `
      SELECT COUNT(DISTINCT h.id) as total
      FROM hasil h
      JOIN users u ON h.user_id = u.id
      JOIN ujian uj ON h.ujian_id = uj.id
      WHERE EXISTS (
        SELECT 1 FROM soal s WHERE s.ujian_id = h.ujian_id AND s.tipe_soal = 'essay'
      )
    `;
    const countParams = [];
    
    if (ujian_id) {
      countQuery += ' AND h.ujian_id = ?';
      countParams.push(ujian_id);
    }
    
    const countResult = await db.query(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    // Add manual_grade_status to each item
    const enrichedQueue = queue.map(item => ({
      ...item,
      manual_grade_status: item.pending_essay_count > 0 
        ? (item.graded_essay_count > 0 ? 'partial' : 'pending') 
        : 'completed'
    }));

    res.json({
      data: enrichedQueue,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get grading queue', error: error.message });
  }
});

// Get grading statistics for dashboard
router.get('/grading-stats', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    // Get stats based on actual essay_grading table
    const stats = await db.query(`
      SELECT
        COUNT(DISTINCT h.id) as total_pending,
        SUM(CASE 
          WHEN (SELECT COUNT(*) FROM essay_grading eg WHERE eg.hasil_id = h.id AND (eg.given_score IS NULL OR eg.given_score = 0)) > 0
          AND (SELECT COUNT(*) FROM essay_grading eg WHERE eg.hasil_id = h.id AND eg.given_score > 0) = 0
          THEN 1 ELSE 0 END) as pending,
        SUM(CASE 
          WHEN (SELECT COUNT(*) FROM essay_grading eg WHERE eg.hasil_id = h.id AND eg.given_score > 0) > 0
          AND (SELECT COUNT(*) FROM essay_grading eg WHERE eg.hasil_id = h.id AND (eg.given_score IS NULL OR eg.given_score = 0)) > 0
          THEN 1 ELSE 0 END) as partial,
        SUM(CASE WHEN h.graded_by = ? THEN 1 ELSE 0 END) as assigned_to_me
      FROM hasil h
      WHERE EXISTS (
        SELECT 1 FROM soal s WHERE s.ujian_id = h.ujian_id AND s.tipe_soal = 'essay'
      )
      AND (
        (SELECT COUNT(*) FROM essay_grading eg WHERE eg.hasil_id = h.id AND (eg.given_score IS NULL OR eg.given_score = 0)) > 0
        OR (SELECT COUNT(*) FROM essay_grading eg WHERE eg.hasil_id = h.id AND eg.given_score > 0) > 0
      )
    `, [req.user.id]);

    const recent = await db.query(`
      SELECT
        h.id,
        u.nama as student_name,
        uj.judul as ujian_judul,
        CASE 
          WHEN (SELECT COUNT(*) FROM essay_grading eg WHERE eg.hasil_id = h.id AND (eg.given_score IS NULL OR eg.given_score = 0)) > 0
          AND (SELECT COUNT(*) FROM essay_grading eg WHERE eg.hasil_id = h.id AND eg.given_score > 0) = 0
          THEN 'pending'
          WHEN (SELECT COUNT(*) FROM essay_grading eg WHERE eg.hasil_id = h.id AND eg.given_score > 0) > 0
          AND (SELECT COUNT(*) FROM essay_grading eg WHERE eg.hasil_id = h.id AND (eg.given_score IS NULL OR eg.given_score = 0)) > 0
          THEN 'partial'
          ELSE 'completed'
        END as manual_grade_status,
        h.waktu_selesai as submitted_at
      FROM hasil h
      JOIN users u ON h.user_id = u.id
      JOIN ujian uj ON h.ujian_id = uj.id
      WHERE EXISTS (
        SELECT 1 FROM soal s WHERE s.ujian_id = h.ujian_id AND s.tipe_soal = 'essay'
      )
      ORDER BY h.waktu_selesai DESC
      LIMIT 5
    `);

    res.json({
      total_pending: stats[0]?.total_pending || 0,
      pending: stats[0]?.pending || 0,
      partial: stats[0]?.partial || 0,
      completed: stats[0]?.total_pending - (stats[0]?.pending || 0) - (stats[0]?.partial || 0),
      assigned_to_me: stats[0]?.assigned_to_me || 0,
      recent_submissions: recent
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get grading stats', error: error.message });
  }
});

// =====================================================
// ESSAY GRADING - Core Functionality
// =====================================================

// Get exam submissions that need essay grading
router.get('/exam/:ujianId/submissions', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { ujianId } = req.params;
    const { status } = req.query;

    let query = `
      SELECT
        h.id as hasil_id,
        h.user_id,
        u.nama as student_name,
        u.email as student_email,
        h.auto_grade_score,
        h.total_essay_score,
        h.skor as current_score,
        h.waktu_selesai as submitted_at,
        h.graded_by,
        grader.nama as grader_name,
        h.graded_at,
        (SELECT COUNT(*) FROM soal s WHERE s.ujian_id = h.ujian_id AND s.tipe_soal = 'essay') as total_essays,
        (SELECT COUNT(*) FROM essay_grading eg WHERE eg.hasil_id = h.id) as total_essay_entries,
        (SELECT COUNT(*) FROM essay_grading eg WHERE eg.hasil_id = h.id AND eg.given_score > 0) as graded_count,
        (SELECT COUNT(*) FROM essay_grading eg WHERE eg.hasil_id = h.id AND (eg.given_score IS NULL OR eg.given_score = 0)) as pending_count
      FROM hasil h
      JOIN users u ON h.user_id = u.id
      LEFT JOIN users grader ON h.graded_by = grader.id
      WHERE h.ujian_id = ? AND EXISTS (
        SELECT 1 FROM soal s WHERE s.ujian_id = h.ujian_id AND s.tipe_soal = 'essay'
      )
    `;

    const params = [ujianId];

    query += ` HAVING 
      CASE 
        WHEN ? = 'pending' THEN pending_count > 0
        WHEN ? = 'partial' THEN graded_count > 0 AND pending_count > 0
        WHEN ? = 'completed' THEN pending_count = 0 AND graded_count > 0
        ELSE TRUE
      END
    `;
    params.push(status || 'all', status || 'all', status || 'all');

    query += ' ORDER BY h.waktu_selesai DESC';

    const submissions = await db.query(query, params);
    
    // Add manual_grade_status based on essay_grading table
    const enrichedSubmissions = submissions.map(s => ({
      ...s,
      manual_grade_status: s.pending_count > 0 ? (s.graded_count > 0 ? 'partial' : 'pending') : 'completed'
    }));
    
    res.json(enrichedSubmissions);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get submissions', error: error.message });
  }
});

// Get student's essay answers for grading
router.get('/submission/:hasilId/essays', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { hasilId } = req.params;

    // Verify the submission exists and user has access
    const hasil = await db.query(`
      SELECT h.*, u.nama as student_name, u.email as student_email, uj.judul as ujian_judul
      FROM hasil h
      JOIN users u ON h.user_id = u.id
      JOIN ujian uj ON h.ujian_id = uj.id
      WHERE h.id = ?
    `, [hasilId]);

    if (!hasil.length) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Get all essay questions for this exam
    const essays = await db.query(`
      SELECT
        s.id as soal_id,
        s.teks_soal,
        s.jawaban_essay as contoh_jawaban,
        s.bobot,
        s.nomor_urut,
        eg.id as grading_id,
        eg.student_answer,
        eg.given_score,
        eg.notes as grading_notes,
        eg.graded_by,
        eg.graded_at,
        grader.nama as grader_name
      FROM soal s
      LEFT JOIN essay_grading eg ON s.id = eg.soal_id AND eg.hasil_id = ?
      LEFT JOIN users grader ON eg.graded_by = grader.id
      WHERE s.ujian_id = (SELECT ujian_id FROM hasil WHERE id = ?)
        AND s.tipe_soal = 'essay'
      ORDER BY s.nomor_urut
    `, [hasilId, hasilId]);

    // Get student's answers from jawaban_siswa JSON
    const submissionData = hasil[0];
    let jawabanSiswa;

    try {
      // jawaban_siswa might already be parsed by MariaDB driver
      if (typeof submissionData.jawaban_siswa === 'string') {
        jawabanSiswa = JSON.parse(submissionData.jawaban_siswa || '{}');
      } else {
        jawabanSiswa = submissionData.jawaban_siswa || {};
      }
    } catch (e) {
      logger.error({ err: e }, 'Error parsing jawaban_siswa');
      jawabanSiswa = {};
    }

    // Merge essay questions with student answers
    const essaysWithAnswers = essays.map(essay => ({
      ...essay,
      student_answer: essay.student_answer || jawabanSiswa[`essay_${essay.soal_id}`] || jawabanSiswa[essay.soal_id?.toString()] || 'Tidak ada jawaban',
      is_graded: !!essay.grading_id
    }));

    res.json({
      submission: {
        hasil_id: submissionData.id,
        student_name: submissionData.student_name,
        student_email: submissionData.student_email,
        ujian_judul: submissionData.ujian_judul,
        auto_grade_score: parseFloat(submissionData.auto_grade_score || 0),
        total_essay_score: parseFloat(submissionData.total_essay_score || 0),
        current_score: parseFloat(submissionData.auto_grade_score || 0) + parseFloat(submissionData.total_essay_score || 0),
        manual_grade_status: submissionData.manual_grade_status,
        submitted_at: submissionData.waktu_selesai
      },
      essays: essaysWithAnswers
    });
  } catch (error) {
    logger.error({ err: error }, 'Error getting essays');
    res.status(500).json({ message: 'Failed to get essays', error: error.message });
  }
});

// Get ALL questions (including essay) for comprehensive grading
router.get('/submission/:hasilId/all-questions', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { hasilId } = req.params;

    // Verify the submission exists and user has access
    const hasil = await db.query(`
      SELECT h.*, u.nama as student_name, u.email as student_email, uj.judul as ujian_judul
      FROM hasil h
      JOIN users u ON h.user_id = u.id
      JOIN ujian uj ON h.ujian_id = uj.id
      WHERE h.id = ?
    `, [hasilId]);

    if (!hasil.length) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const submissionData = hasil[0];

    // Get ALL questions for this exam
    const questions = await db.query(`
      SELECT
        s.id as soal_id,
        s.teks_soal,
        s.tipe_soal,
        s.pilihan_a,
        s.pilihan_b,
        s.pilihan_c,
        s.pilihan_d,
        s.pilihan_e,
        s.jawaban_benar_salah,
        s.kunci_jawaban,
        s.jawaban_multiple,
        s.jawaban_essay as contoh_jawaban,
        s.bobot,
        s.nomor_urut,
        s.gambar_soal,
        s.gambar_pilihan_a,
        s.gambar_pilihan_b,
        s.gambar_pilihan_c,
        s.gambar_pilihan_d,
        s.gambar_pilihan_e
      FROM soal s
      WHERE s.ujian_id = (SELECT ujian_id FROM hasil WHERE id = ?)
      ORDER BY s.nomor_urut
    `, [hasilId, hasilId]);

    // Get student's answers from jawaban_siswa JSON
    let jawabanSiswa;
    try {
      if (typeof submissionData.jawaban_siswa === 'string') {
        jawabanSiswa = JSON.parse(submissionData.jawaban_siswa || '{}');
      } else {
        jawabanSiswa = submissionData.jawaban_siswa || {};
      }
    } catch (e) {
      logger.error({ err: e }, 'Error parsing jawaban_siswa');
      jawabanSiswa = {};
    }

    // Get essay grading data
    const essayGrading = await db.query(`
      SELECT soal_id, given_score, notes as grading_notes, student_answer
      FROM essay_grading
      WHERE hasil_id = ?
    `, [hasilId]);

    const essayGradingMap = essayGrading.reduce((acc, eg) => {
      acc[eg.soal_id] = eg;
      return acc;
    }, {});

    // Merge questions with student answers and grading info
    const questionsWithAnswers = questions.map(q => {
      const studentAnswer = jawabanSiswa[q.soal_id?.toString()] || '';
      const isCorrect = checkAnswer(q, studentAnswer);
      const essayData = q.tipe_soal === 'essay' ? essayGradingMap[q.soal_id] : null;

      return {
        ...q,
        student_answer: studentAnswer,
        is_correct: isCorrect,
        auto_score: isCorrect && q.tipe_soal !== 'essay' ? parseFloat(q.bobot || 1) : 0,
        given_score: essayData?.given_score || null,
        grading_notes: essayData?.grading_notes || null,
        is_graded: q.tipe_soal === 'essay' ? !!essayData : true
      };
    });

    // Calculate scores using parseFloat to handle DECIMAL strings
    const maxAutoScore = questions
      .filter(q => q.tipe_soal !== 'essay')
      .reduce((sum, q) => sum + parseFloat(q.bobot || 1), 0);
    const maxEssayScore = questions
      .filter(q => q.tipe_soal === 'essay')
      .reduce((sum, q) => sum + parseFloat(q.bobot || 1), 0);

    const currentAutoScore = questionsWithAnswers
      .filter(q => q.tipe_soal !== 'essay')
      .reduce((sum, q) => sum + q.auto_score, 0);

    const currentEssayScore = questionsWithAnswers
      .filter(q => q.tipe_soal === 'essay' && q.given_score !== null)
      .reduce((sum, q) => sum + parseFloat(q.given_score || 0), 0);

    const maxTotal = maxAutoScore + maxEssayScore;
    const liveSkor = maxTotal > 0 ? ((currentAutoScore + currentEssayScore) / maxTotal) * 100 : 0;
    const liveGrade = liveSkor >= 90 ? 'A' : liveSkor >= 80 ? 'B' : liveSkor >= 70 ? 'C' : liveSkor >= 60 ? 'D' : 'E';
    const livePassed = liveSkor >= parseFloat(submissionData.passing_grade || 70);

    res.json({
      submission: {
        hasil_id: submissionData.id,
        student_name: submissionData.student_name,
        student_email: submissionData.student_email,
        ujian_judul: submissionData.ujian_judul,
        auto_grade_score: currentAutoScore,
        total_essay_score: currentEssayScore,
        current_score: currentAutoScore + currentEssayScore,
        skor: liveSkor,
        grade: liveGrade,
        passed: livePassed,
        manual_grade_status: submissionData.manual_grade_status,
        submitted_at: submissionData.waktu_selesai,
        max_auto_score: maxAutoScore,
        max_essay_score: maxEssayScore,
        max_total_score: maxTotal,
        current_auto_score: currentAutoScore,
        current_essay_score: currentEssayScore
      },
      questions: questionsWithAnswers
    });
  } catch (error) {
    logger.error({ err: error }, 'Error getting all questions');
    res.status(500).json({ message: 'Failed to get questions', error: error.message });
  }
});

// Submit grade for an essay
router.post('/submission/:hasilId/essay/:soalId/grade', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  logger.debug({ params: req.params, userId: req.user?.id }, 'ESSAY GRADE ENDPOINT CALLED');
  
  try {
    const { hasilId, soalId } = req.params;
    const { given_score, notes, student_answer } = req.body;

    // Verify submission exists
    const hasil = await db.query('SELECT * FROM hasil WHERE id = ?', [hasilId]);
    if (!hasil.length) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Verify soal exists and is an essay
    const soal = await db.query('SELECT * FROM soal WHERE id = ? AND tipe_soal = ?', [soalId, 'essay']);
    if (!soal.length) {
      return res.status(404).json({ message: 'Essay question not found' });
    }

    // Validate score
    const score = parseFloat(given_score);
    if (isNaN(score) || score < 0 || score > soal[0].bobot) {
      return res.status(400).json({
        message: `Nilai harus antara 0 dan ${soal[0].bobot}`
      });
    }

    // Check if already graded
    const existing = await db.query('SELECT id FROM essay_grading WHERE hasil_id = ? AND soal_id = ?', [hasilId, soalId]);

    if (existing.length) {
      await db.query(`
        UPDATE essay_grading
        SET given_score = ?, notes = ?, student_answer = ?, graded_by = ?, graded_at = NOW()
        WHERE hasil_id = ? AND soal_id = ?
      `, [score, notes, student_answer, req.user.id, hasilId, soalId]);
    } else {
      await db.query(`
        INSERT INTO essay_grading (hasil_id, soal_id, student_answer, max_score, given_score, notes, graded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [hasilId, soalId, student_answer, soal[0].bobot, score, notes, req.user.id]);
    }

    // Update total essay score (live calculation in GET endpoints handles skor)
    const essayTotals = await db.query(
      'SELECT COALESCE(SUM(given_score), 0) as total, COUNT(*) as graded FROM essay_grading WHERE hasil_id = ?',
      [hasilId]
    );
    const allEssayCount = await db.query(
      'SELECT COUNT(*) as count FROM soal WHERE ujian_id = ? AND tipe_soal = ?',
      [hasil[0].ujian_id, 'essay']
    );
    const status = essayTotals[0].graded >= allEssayCount[0].count ? 'completed' : 'partial';

    await db.query(
      'UPDATE hasil SET total_essay_score = ?, manual_grade_status = ? WHERE id = ?',
      [essayTotals[0].total, status, hasilId]
    );

    // Log activity
    await logActivity(req.user.id, 'ESSAY_GRADED', 'essay_grading', null, {
      hasil_id: hasilId,
      soal_id: soalId,
      score,
      student_id: hasil[0].user_id
    }, req);

    res.json({
      message: 'Grade submitted successfully',
      grading_id: existing.length ? existing[0].id : null,
      score,
      max_score: soal[0].bobot
    });
  } catch (error) {
    logger.error({ err: error }, 'Error in essay grade endpoint');
    res.status(500).json({ message: 'Failed to submit grade', error: error.message });
  }
});

// Update grade for an essay
router.put('/grading/:gradingId', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { gradingId } = req.params;
    const { given_score, notes } = req.body;

    // Verify grading exists
    const grading = await db.query('SELECT * FROM essay_grading WHERE id = ?', [gradingId]);
    if (!grading.length) {
      return res.status(404).json({ message: 'Grading record not found' });
    }

    // Validate score
    const score = parseFloat(given_score);
    if (isNaN(score) || score < 0 || score > grading[0].max_score) {
      return res.status(400).json({ 
        message: `Nilai harus antara 0 dan ${grading[0].max_score}` 
      });
    }

    await db.query(`
      UPDATE essay_grading 
      SET given_score = ?, notes = ?, graded_at = NOW()
      WHERE id = ?
    `, [score, notes, gradingId]);

    // Recalculate total essay score
    const essayTotals = await db.query(
      'SELECT COALESCE(SUM(given_score), 0) as total FROM essay_grading WHERE hasil_id = (SELECT hasil_id FROM essay_grading WHERE id = ?)',
      [gradingId]
    );
    const hasilId = grading[0].hasil_id;
    await db.query(
      'UPDATE hasil SET total_essay_score = ? WHERE id = ?',
      [essayTotals[0].total, hasilId]
    );

    await logActivity(req.user.id, 'ESSAY_GRADE_UPDATED', 'essay_grading', gradingId, {
      given_score: score,
      notes
    }, req);

    res.json({ message: 'Grade updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update grade', error: error.message });
  }
});

// Delete grade for an essay
router.delete('/grading/:gradingId', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { gradingId } = req.params;

    const grading = await db.query('SELECT * FROM essay_grading WHERE id = ?', [gradingId]);
    if (!grading.length) {
      return res.status(404).json({ message: 'Grading record not found' });
    }

    await db.query('DELETE FROM essay_grading WHERE id = ?', [gradingId]);

    // Update hasil status and recalculate
    const hasilId = grading[0].hasil_id;
    const essayTotals = await db.query(
      'SELECT COALESCE(SUM(given_score), 0) as total, COUNT(*) as count FROM essay_grading WHERE hasil_id = ?',
      [hasilId]
    );

    if (essayTotals[0].count === 0) {
      await db.query(
        "UPDATE hasil SET manual_grade_status = 'pending', total_essay_score = 0 WHERE id = ?",
        [hasilId]
      );
    } else {
      await db.query(
        "UPDATE hasil SET total_essay_score = ?, manual_grade_status = CASE WHEN manual_grade_status = 'pending' THEN 'partial' ELSE manual_grade_status END WHERE id = ?",
        [essayTotals[0].total, hasilId]
      );
    }

    await logActivity(req.user.id, 'ESSAY_GRADE_DELETED', 'essay_grading', gradingId, {
      hasil_id: hasilId
    }, req);

    res.json({ message: 'Grade deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete grade', error: error.message });
  }
});

// Bulk submit grades for all essays in a submission
router.post('/submission/:hasilId/grade-all', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  logger.debug({ params: req.params, userId: req.user?.id, gradeCount: req.body?.grades?.length }, 'GRADE-ALL ENDPOINT CALLED');
  
  try {
    const { hasilId } = req.params;
    const { grades } = req.body; // Array of {soal_id, given_score, notes, student_answer}

    if (!Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json({ message: 'Grades array is required' });
    }

    // Verify submission exists
    const hasil = await db.query('SELECT * FROM hasil WHERE id = ?', [hasilId]);
    if (!hasil.length) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Get all essay questions for validation
    const essays = await db.query(
      'SELECT id, bobot, teks_soal FROM soal WHERE ujian_id = (SELECT ujian_id FROM hasil WHERE id = ?) AND tipe_soal = ?',
      [hasilId, 'essay']
    );

    logger.debug({ count: essays.length }, 'Essay questions retrieved');

    const essayMap = essays.reduce((acc, e) => {
      acc[e.id] = e;
      return acc;
    }, {});

    for (const grade of grades) {
      const essay = essayMap[grade.soal_id];
      if (!essay) {
        return res.status(400).json({ message: `Soal ${grade.soal_id} tidak ditemukan` });
      }
      const score = parseFloat(grade.given_score);
      if (isNaN(score) || score < 0 || score > essay.bobot) {
        return res.status(400).json({
          message: `Nilai untuk soal ${grade.soal_id} harus antara 0 dan ${essay.bobot}`
        });
      }
    }

    // Use transaction for bulk insert/update
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      for (const grade of grades) {
        const existing = await connection.query(
          'SELECT id FROM essay_grading WHERE hasil_id = ? AND soal_id = ?',
          [hasilId, grade.soal_id]
        );

        if (existing.length) {
          await connection.query(`
            UPDATE essay_grading
            SET given_score = ?, notes = ?, student_answer = ?, graded_by = ?, graded_at = NOW()
            WHERE hasil_id = ? AND soal_id = ?
          `, [grade.given_score, grade.notes || null, grade.student_answer || null, req.user.id, hasilId, grade.soal_id]);
        } else {
          const essay = essayMap[grade.soal_id];
          await connection.query(`
            INSERT INTO essay_grading (hasil_id, soal_id, student_answer, max_score, given_score, notes, graded_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [hasilId, grade.soal_id, grade.student_answer || null, essay.bobot, grade.given_score, grade.notes || null, req.user.id]);
        }
      }

      await connection.commit();
      await connection.release();

      // Update total essay score from essay_grading (no stored procedure needed)
      const essayTotals = await db.query(
        'SELECT COALESCE(SUM(given_score), 0) as total FROM essay_grading WHERE hasil_id = ?',
        [hasilId]
      );
      const totalEssayScore = parseFloat(essayTotals[0].total);

      // Check if all essays are graded
      const allEssays = await db.query(
        'SELECT COUNT(*) as count FROM soal WHERE ujian_id = (SELECT ujian_id FROM hasil WHERE id = ?) AND tipe_soal = ?',
        [hasilId, 'essay']
      );
      const gradedEssays = await db.query(
        'SELECT COUNT(*) as count FROM essay_grading WHERE hasil_id = ? AND given_score IS NOT NULL',
        [hasilId]
      );

      const status = gradedEssays[0].count >= allEssays[0].count ? 'completed' : 'partial';

      await db.query(
        'UPDATE hasil SET total_essay_score = ?, manual_grade_status = ? WHERE id = ?',
        [totalEssayScore, status, hasilId]
      );

      // Log activity
      await logActivity(req.user.id, 'ESSAY_BULK_GRADED', 'hasil', hasilId, {
        graded_count: grades.length
      }, req);

      // Send notification to student with final score
      const studentData = await db.query(
        'SELECT u.email, u.nama FROM users u JOIN hasil h ON u.id = h.user_id WHERE h.id = ?',
        [hasilId]
      );

      if (studentData.length && studentData[0].email) {
        const examData = await db.query('SELECT judul FROM ujian WHERE id = (SELECT ujian_id FROM hasil WHERE id = ?)', [hasilId]);
        const hasilData = await db.query('SELECT skor, total_essay_score FROM hasil WHERE id = ?', [hasilId]);

        try {
          // Wait a bit for trigger to calculate final score
          await new Promise(resolve => setTimeout(resolve, 500));

          const updatedHasil = await db.query('SELECT skor, total_essay_score FROM hasil WHERE id = ?', [hasilId]);

          await sendEssayGradedNotification(
            studentData[0].email,
            examData[0].judul,
            updatedHasil[0]?.skor || 0,
            updatedHasil[0]?.total_essay_score || 0,
            studentData[0].nama
          );
        } catch (emailError) {
          logger.warn({ err: emailError }, 'Failed to send notification email');
        }
      }

      res.json({
        message: 'All grades submitted successfully',
        graded_count: grades.length
      });
    } catch (error) {
      try { await connection.rollback(); } catch (e) { /* ignore rollback errors */ }
      await connection.release();
      logger.error({ err: error }, 'Database error in grade-all');
      throw error;
    }
  } catch (error) {
    logger.error({ err: error }, 'Error in grade-all endpoint');
    res.status(500).json({ message: 'Failed to submit bulk grades', error: error.message });
  }
});

// Get grading history for a teacher
router.get('/my-grading-history', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const history = await db.query(`
      SELECT 
        eg.id,
        eg.hasil_id,
        eg.soal_id,
        eg.given_score,
        eg.max_score,
        eg.notes,
        eg.graded_at,
        student.nama as student_name,
        uj.judul as ujian_judul,
        s.teks_soal
      FROM essay_grading eg
      JOIN hasil h ON eg.hasil_id = h.id
      JOIN users student ON h.user_id = student.id
      JOIN users grader ON eg.graded_by = grader.id
      JOIN ujian uj ON h.ujian_id = uj.id
      JOIN soal s ON eg.soal_id = s.id
      WHERE eg.graded_by = ?
      ORDER BY eg.graded_at DESC
      LIMIT ? OFFSET ?
    `, [req.user.id, parseInt(limit), parseInt(offset)]);

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM essay_grading WHERE graded_by = ?',
      [req.user.id]
    );

    res.json({
      data: history,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0]?.total || 0,
        totalPages: Math.ceil((countResult[0]?.total || 0) / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get grading history', error: error.message });
  }
});

// =====================================================
// STUDENT DETAIL & RESET
// =====================================================

// Get student submission detail for a specific exam
router.get('/student/:userId/exam/:ujianId', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { userId, ujianId } = req.params;

    // Get hasil
    const hasil = await db.query(`
      SELECT h.*, u.nama as student_name, u.email as student_email, uj.judul as ujian_judul
      FROM hasil h
      JOIN users u ON h.user_id = u.id
      JOIN ujian uj ON h.ujian_id = uj.id
      WHERE h.user_id = ? AND h.ujian_id = ?
      ORDER BY h.created_at DESC
      LIMIT 1
    `, [userId, ujianId]);

    if (!hasil.length) {
      return res.status(404).json({ message: 'No submission found for this student and exam' });
    }

    // Get max scores
    const soal = await db.query(
      'SELECT id, tipe_soal, kunci_jawaban, jawaban_benar_salah, jawaban_multiple, bobot FROM soal WHERE ujian_id = ?',
      [ujianId]
    );

    const jawabanSiswa = typeof hasil[0].jawaban_siswa === 'string'
      ? JSON.parse(hasil[0].jawaban_siswa)
      : (hasil[0].jawaban_siswa || {});

    let autoScore = 0, correctCount = 0, maxAutoScore = 0, maxEssayScore = 0;
    for (const q of soal) {
      const bobot = parseFloat(q.bobot || 1);
      if (q.tipe_soal === 'essay') { maxEssayScore += bobot; }
      else {
        maxAutoScore += bobot;
        if (checkAnswer(q, jawabanSiswa[q.id])) { autoScore += bobot; correctCount++; }
      }
    }
    const maxTotal = maxAutoScore + maxEssayScore;

    const eg = await db.query('SELECT COALESCE(SUM(given_score), 0) as total FROM essay_grading WHERE hasil_id = ?', [hasil[0].id]);
    const essayScore = parseFloat(eg[0].total);
    const liveSkor = maxTotal > 0 ? ((autoScore + essayScore) / maxTotal) * 100 : parseFloat(hasil[0].skor || 0);
    const liveGrade = liveSkor >= 90 ? 'A' : liveSkor >= 80 ? 'B' : liveSkor >= 70 ? 'C' : liveSkor >= 60 ? 'D' : 'E';
    const livePassed = liveSkor >= parseFloat(hasil[0].passing_grade || 70);

    // Get essay grading details
    const essayGrading = await db.query(`
      SELECT 
        eg.*,
        s.teks_soal,
        s.bobot as soal_bobot,
        s.nomor_urut,
        grader.nama as grader_name
      FROM essay_grading eg
      JOIN soal s ON eg.soal_id = s.id
      LEFT JOIN users grader ON eg.graded_by = grader.id
      WHERE eg.hasil_id = ?
      ORDER BY s.nomor_urut
    `, [hasil[0].id]);

    res.json({
      submission: {
        ...hasil[0],
        skor: liveSkor,
        grade: liveGrade,
        passed: livePassed,
        max_auto_score: maxAutoScore,
        max_essay_score: maxEssayScore,
        max_total_score: maxTotal
      },
      essay_grading: essayGrading
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get student submission detail', error: error.message });
  }
});

// Reset essay grades for a submission (keep auto-graded scores)
router.post('/submission/:hasilId/reset-essay', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { hasilId } = req.params;

    // Verify submission exists
    const hasil = await db.query('SELECT * FROM hasil WHERE id = ?', [hasilId]);
    if (!hasil.length) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Delete all essay grading records
    await db.query('DELETE FROM essay_grading WHERE hasil_id = ?', [hasilId]);

    // Update hasil record
    await db.query(`
      UPDATE hasil 
      SET 
        total_essay_score = 0,
        manual_grade_status = 'pending',
        graded_by = NULL,
        graded_at = NULL,
        examiner_notes = NULL
      WHERE id = ?
    `, [hasilId]);

    await logActivity(req.user.id, 'ESSAY_GRADES_RESET', 'hasil', hasilId, {
      previous_score: hasil[0].skor
    }, req);

    res.json({ message: 'Essay grades reset successfully. Student submission is now pending re-grading.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reset essay grades', error: error.message });
  }
});

// Reset entire exam attempt for a student (delete all results)
router.delete('/submission/:hasilId/reset-all', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { hasilId } = req.params;

    // Verify submission exists
    const hasil = await db.query('SELECT * FROM hasil WHERE id = ?', [hasilId]);
    if (!hasil.length) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Delete essay grading records first
    await db.query('DELETE FROM essay_grading WHERE hasil_id = ?', [hasilId]);

    // Delete the hasil record
    await db.query('DELETE FROM hasil WHERE id = ?', [hasilId]);

    await logActivity(req.user.id, 'EXAM_ATTEMPT_RESET', 'hasil', hasilId, {
      student_id: hasil[0].user_id,
      ujian_id: hasil[0].ujian_id,
      previous_score: hasil[0].skor
    }, req);

    res.json({ message: 'Exam attempt reset successfully. Student can now retake the exam.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reset exam attempt', error: error.message });
  }
});

// Get all submissions for a specific student
router.get('/student/:userId/submissions', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { userId } = req.params;

    const submissions = await db.query(`
      SELECT 
        h.*,
        u.nama as student_name,
        u.email as student_email,
        uj.judul as ujian_judul,
        uj.durasi,
        uj.passing_grade,
        (SELECT COUNT(*) FROM soal s WHERE s.ujian_id = h.ujian_id AND s.tipe_soal = 'essay') as total_essay_questions,
        (SELECT COUNT(*) FROM essay_grading eg WHERE eg.hasil_id = h.id AND eg.given_score IS NOT NULL AND eg.given_score >= 0) as essay_graded_count
      FROM hasil h
      JOIN users u ON h.user_id = u.id
      JOIN ujian uj ON h.ujian_id = uj.id
      WHERE h.user_id = ?
      ORDER BY h.created_at DESC
    `, [userId]);

    // Re-grade each submission against current bobot & answer keys
    const submissionsWithScores = await Promise.all(submissions.map(async (s) => {
      const soal = await db.query(
        'SELECT id, tipe_soal, kunci_jawaban, jawaban_benar_salah, jawaban_multiple, bobot FROM soal WHERE ujian_id = ?',
        [s.ujian_id]
      );

      const jawabanSiswa = typeof s.jawaban_siswa === 'string'
        ? JSON.parse(s.jawaban_siswa)
        : (s.jawaban_siswa || {});

      let autoScore = 0, correctCount = 0, maxAuto = 0, maxEssay = 0;
      for (const q of soal) {
        const bobot = parseFloat(q.bobot || 1);
        if (q.tipe_soal === 'essay') { maxEssay += bobot; }
        else {
          maxAuto += bobot;
          if (checkAnswer(q, jawabanSiswa[q.id])) { autoScore += bobot; correctCount++; }
        }
      }

      const eg = await db.query(
        `SELECT COALESCE(SUM(given_score), 0) as total,
                COUNT(CASE WHEN given_score > 0 THEN 1 END) as correct_essay_count
         FROM essay_grading WHERE hasil_id = ?`,
        [s.id]
      );
      const essayScore = parseFloat(eg[0].total);
      correctCount += parseInt(eg[0].correct_essay_count || 0);
      const maxTotal = maxAuto + maxEssay;
      const liveSkor = maxTotal > 0 ? ((autoScore + essayScore) / maxTotal) * 100 : parseFloat(s.skor || 0);
      const liveGrade = liveSkor >= 90 ? 'A' : liveSkor >= 80 ? 'B' : liveSkor >= 70 ? 'C' : liveSkor >= 60 ? 'D' : 'E';
      const livePassed = liveSkor >= parseFloat(s.passing_grade || 70);

      return {
        ...s,
        skor: liveSkor,
        grade: liveGrade,
        passed: livePassed,
        jumlah_benar: correctCount,
        max_auto_score: maxAuto,
        max_essay_score: maxEssay,
        max_total_score: maxTotal
      };
    }));

    res.json(submissionsWithScores);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get student submissions', error: error.message });
  }
});

// =====================================================
// BULK RESET
// =====================================================

// Bulk reset all submissions for a specific exam
router.post('/bulk-reset/exam/:ujianId', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { ujianId } = req.params;
    const { reset_type = 'all' } = req.body; // 'all' or 'essay_only'

    // Verify exam exists
    const exam = await db.query('SELECT id, judul FROM ujian WHERE id = ?', [ujianId]);
    if (!exam.length) {
      return res.status(404).json({ message: 'Ujian tidak ditemukan' });
    }

    // Get all submissions for this exam
    const submissions = await db.query('SELECT id, user_id FROM hasil WHERE ujian_id = ?', [ujianId]);
    
    if (submissions.length === 0) {
      return res.status(400).json({ message: 'Tidak ada hasil ujian untuk di-reset' });
    }

    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      let resetCount = 0;
      for (const submission of submissions) {
        // Delete essay grading records
        await connection.query('DELETE FROM essay_grading WHERE hasil_id = ?', [submission.id]);
        resetCount++;

        if (reset_type === 'all') {
          // Delete entire submission
          await connection.query('DELETE FROM hasil WHERE id = ?', [submission.id]);
        } else if (reset_type === 'essay_only') {
          // Reset essay only, keep auto-graded scores
          await connection.query(`
            UPDATE hasil 
            SET 
              total_essay_score = 0,
              manual_grade_status = 'pending',
              graded_by = NULL,
              graded_at = NULL,
              examiner_notes = NULL
            WHERE id = ?
          `, [submission.id]);
        }
      }

      await connection.commit();
      await connection.release();

      await logActivity(req.user.id, 'BULK_RESET_EXAM', 'ujian', ujianId, {
        ujian_id: ujianId,
        reset_type,
        submissions_count: submissions.length,
        reset_count: resetCount
      }, req);

      res.json({
        message: reset_type === 'all' 
          ? `Berhasil mereset ${resetCount} hasil ujian. Siswa dapat mengerjakan ulang.`
          : `Berhasil mereset ${resetCount} nilai essay. Submission kembali ke status pending.`,
        reset_count: resetCount,
        reset_type
      });
    } catch (error) {
      try { await connection.rollback(); } catch (e) { /* ignore rollback errors */ }
      await connection.release();
      throw error;
    }
  } catch (error) {
    res.status(500).json({ message: 'Failed to bulk reset', error: error.message });
  }
});

// Bulk reset selected submissions
router.post('/bulk-reset/submissions', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { hasil_ids, reset_type = 'all' } = req.body;

    if (!Array.isArray(hasil_ids) || hasil_ids.length === 0) {
      return res.status(400).json({ message: 'hasil_ids harus berupa array tidak kosong' });
    }

    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      let resetCount = 0;
      for (const hasilId of hasil_ids) {
        // Verify submission exists
        const submission = await connection.query('SELECT * FROM hasil WHERE id = ?', [hasilId]);
        if (!submission.length) continue;

        // Delete essay grading records
        await connection.query('DELETE FROM essay_grading WHERE hasil_id = ?', [hasilId]);
        resetCount++;

        if (reset_type === 'all') {
          // Delete entire submission
          await connection.query('DELETE FROM hasil WHERE id = ?', [hasilId]);
        } else if (reset_type === 'essay_only') {
          // Reset essay only
          await connection.query(`
            UPDATE hasil 
            SET 
              total_essay_score = 0,
              manual_grade_status = 'pending',
              graded_by = NULL,
              graded_at = NULL,
              examiner_notes = NULL
            WHERE id = ?
          `, [hasilId]);
        }
      }

      await connection.commit();
      await connection.release();

      await logActivity(req.user.id, 'BULK_RESET_SUBMISSIONS', 'hasil', null, {
        reset_type,
        hasil_ids,
        reset_count: resetCount
      }, req);

      res.json({
        message: `Berhasil mereset ${resetCount} hasil ujian`,
        reset_count: resetCount,
        reset_type
      });
    } catch (error) {
      try { await connection.rollback(); } catch (e) { /* ignore rollback errors */ }
      await connection.release();
      throw error;
    }
  } catch (error) {
    res.status(500).json({ message: 'Failed to bulk reset', error: error.message });
  }
});

module.exports = router;
