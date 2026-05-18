const express = require('express');
const db = require('../../config/database');
const authenticateToken = require('../../middleware/auth');
const authorizeRole = require('../../middleware/authorize');
const router = express.Router();

router.post('/start', authenticateToken, authorizeRole(['siswa']), async (req, res) => {
  try {
    const { ujian_id } = req.body;
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const existing = await db.query(
      'SELECT id FROM exam_sessions WHERE user_id = ? AND ujian_id = ? AND is_active = TRUE',
      [req.user.id, ujian_id]
    );

    if (existing && existing.length > 0) {
      await db.query(
        'UPDATE exam_sessions SET last_activity = NOW() WHERE id = ?',
        [existing[0].id]
      );
      return res.json({ sessionId: existing[0].id, message: 'Session resumed' });
    }

    const result = await db.query(
      'INSERT INTO exam_sessions (user_id, ujian_id, started_at, last_activity, ip_address, user_agent) VALUES (?, ?, NOW(), NOW(), ?, ?)',
      [req.user.id, ujian_id, ipAddress, userAgent]
    );

    res.status(201).json({ sessionId: result.insertId, message: 'Session started' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to start session', error: error.message });
  }
});

router.put('/heartbeat/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { tabSwitches, fullscreenExits } = req.body;

    await db.query(
      'UPDATE exam_sessions SET last_activity = NOW() WHERE id = ? AND user_id = ?',
      [sessionId, req.user.id]
    );

    if (tabSwitches !== undefined || fullscreenExits !== undefined) {
      const hasil = await db.query(
        'SELECT id FROM hasil WHERE user_id = ? AND ujian_id = (SELECT ujian_id FROM exam_sessions WHERE id = ?)',
        [req.user.id, sessionId]
      );

      if (hasil.length) {
        const updates = [];
        const params = [];
        
        if (tabSwitches !== undefined) {
          updates.push('tab_switches = ?');
          params.push(tabSwitches);
        }
        if (fullscreenExits !== undefined) {
          updates.push('fullscreen_exits = ?');
          params.push(fullscreenExits);
        }
        
        params.push(hasil[0].id);
        
        await db.query(
          `UPDATE hasil SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
      }
    }

    res.json({ message: 'Heartbeat recorded' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to record heartbeat', error: error.message });
  }
});

router.post('/end/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    await db.query(
      'UPDATE exam_sessions SET is_active = FALSE WHERE id = ? AND user_id = ?',
      [sessionId, req.user.id]
    );

    res.json({ message: 'Session ended' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to end session', error: error.message });
  }
});

router.post('/lock/:sessionId', authenticateToken, authorizeRole(['siswa']), async (req, res) => {
  try {
    const { sessionId } = req.params;

    await db.query(
      'UPDATE exam_sessions SET is_locked = TRUE WHERE id = ? AND user_id = ?',
      [sessionId, req.user.id]
    );

    res.json({ message: 'Session locked' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to lock session: ' + error.message });
  }
});

router.post('/unlock/:sessionId', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { sessionId } = req.params;

    await db.query(
      'UPDATE exam_sessions SET is_locked = FALSE WHERE id = ?',
      [sessionId]
    );

    res.json({ message: 'Session unlocked' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to unlock session', error: error.message });
  }
});

router.get('/status/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const rows = await db.query(
      'SELECT is_locked FROM exam_sessions WHERE id = ? AND user_id = ?',
      [sessionId, req.user.id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json({ is_locked: !!rows[0].is_locked });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get session status', error: error.message });
  }
});

router.get('/active/:ujianId', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { ujianId } = req.params;

    // Get the kelas_id for this exam
    const examInfo = await db.query('SELECT kelas_id FROM ujian WHERE id = ?', [ujianId]);
    
    if (!examInfo || examInfo.length === 0) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    const kelasId = examInfo[0].kelas_id;

    // Single optimized query: get all students + their latest session + result + violations
    const sessions = await db.query(`
      SELECT 
        u.id as user_id,
        u.nama as user_nama,
        u.email as user_email,
        latest_session.id as session_id,
        latest_session.started_at,
        latest_session.last_activity,
        latest_session.is_active,
        latest_session.is_locked,
        latest_session.ip_address,
        latest_session.user_agent,
        h.skor as current_score,
        h.jumlah_benar as correct_answers,
        h.jumlah_soal as total_questions,
        COALESCE(v.violations_count, 0) as violations_count,
        v.violation_types,
        CASE 
          WHEN h.id IS NOT NULL THEN 'submitted'
          WHEN latest_session.id IS NOT NULL AND latest_session.is_active = 1 
               AND TIMESTAMPDIFF(MINUTE, latest_session.last_activity, NOW()) < 5 THEN 'active'
          WHEN latest_session.id IS NOT NULL AND latest_session.is_active = 1 THEN 'idle'
          ELSE 'not_started'
        END as session_status
      FROM users u
      LEFT JOIN (
        -- Get only the LATEST session per user per exam
        SELECT es1.*
        FROM exam_sessions es1
        INNER JOIN (
          SELECT user_id, ujian_id, MAX(started_at) as max_started_at
          FROM exam_sessions
          WHERE ujian_id = ?
          GROUP BY user_id, ujian_id
        ) es2 ON es1.user_id = es2.user_id AND es1.started_at = es2.max_started_at
        WHERE es1.ujian_id = ?
      ) latest_session ON u.id = latest_session.user_id
      LEFT JOIN (
        -- Violation count and details
        SELECT user_id, 
               COUNT(*) as violations_count,
               GROUP_CONCAT(DISTINCT violation_type ORDER BY violation_type SEPARATOR ', ') as violation_types
        FROM exam_violations
        WHERE ujian_id = ?
        GROUP BY user_id
      ) v ON u.id = v.user_id
      LEFT JOIN hasil h ON u.id = h.user_id AND h.ujian_id = ?
        AND h.id = (
          SELECT MAX(id) FROM hasil h2 
          WHERE h2.user_id = u.id AND h2.ujian_id = ?
        )
      WHERE u.role = 'siswa' 
        ${kelasId ? 'AND u.kelas_id = ?' : ''}
      ORDER BY 
        CASE 
          WHEN h.id IS NOT NULL THEN 2
          WHEN latest_session.id IS NOT NULL AND latest_session.is_active = 1 THEN 1
          ELSE 3
        END,
        u.nama ASC
    `, [ujianId, ujianId, ujianId, ujianId, ujianId, ...(kelasId ? [kelasId] : [])]);

    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get active sessions', error: error.message });
  }
});

module.exports = router;
