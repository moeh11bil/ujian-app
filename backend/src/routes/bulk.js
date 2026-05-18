const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const db = require('../../config/database');
const authenticateToken = require('../../middleware/auth');
const authorizeRole = require('../../middleware/authorize');
const logActivity = require('../../middleware/auditLog');
const logger = require('../utils/logger');
const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads/temp');
if (!fsSync.existsSync(uploadDir)) {
  fsSync.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `upload-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /xlsx|xls|csv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      return cb(null, true);
    } else {
      cb(new Error('Hanya file Excel/CSV yang diperbolehkan'));
    }
  }
});

router.post('/import-users', authenticateToken, authorizeRole(['admin', 'guru']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File tidak ditemukan' });
    }

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const row of data) {
      try {
        const { nama, email, password, role, kelas_id, nisn, no_peserta } = row;

        const userRole = role || 'siswa'; // Default to 'siswa' if not provided

        if (!nama || !password) {
          results.failed++;
          results.errors.push({ row, error: 'Data tidak lengkap (nama dan password wajib)' });
          continue;
        }

        if (!['admin', 'guru', 'siswa'].includes(userRole)) {
          results.failed++;
          results.errors.push({ row, error: 'Role tidak valid' });
          continue;
        }

        // NISN required for students (used as login)
        if (userRole === 'siswa' && (!nisn || nisn.toString().trim() === '')) {
          results.failed++;
          results.errors.push({ row, error: 'NISN wajib diisi untuk siswa' });
          continue;
        }

        // Auto-generate email for students if not provided
        let userEmail = email;
        if (userRole === 'siswa' && (!userEmail || userEmail.toString().trim() === '')) {
          userEmail = `${nisn}@student.sch.id`;
        }

        if (userRole !== 'siswa' && (!userEmail || userEmail.toString().trim() === '')) {
          results.failed++;
          results.errors.push({ row, error: 'Email wajib diisi untuk admin/guru' });
          continue;
        }

        // Check NISN uniqueness
        if (nisn) {
          const existingNisn = await db.query('SELECT id FROM users WHERE nisn = ?', [nisn.toString().trim()]);
          if (existingNisn.length) {
            results.failed++;
            results.errors.push({ row, error: `NISN ${nisn} sudah terdaftar` });
            continue;
          }
        }

        // Check email uniqueness (only if email differs from auto-generated)
        if (userEmail) {
          const existingEmail = await db.query('SELECT id FROM users WHERE email = ?', [userEmail]);
          if (existingEmail.length) {
            results.failed++;
            results.errors.push({ row, error: `Email ${userEmail} sudah terdaftar` });
            continue;
          }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
          'INSERT INTO users (nama, email, nisn, no_peserta, password, role, kelas_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [nama, userEmail, nisn ? nisn.toString().trim() : null, no_peserta ? no_peserta.toString().trim() : null, hashedPassword, userRole, kelas_id || null]
        );

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({ row, error: error.message });
      }
    }

    try { await fs.unlink(req.file.path); } catch (e) { /* ignore */ }

    await logActivity(req.user.id, 'BULK_IMPORT_USERS', 'user', null, { success: results.success, failed: results.failed }, req);

    res.json({
      message: 'Import selesai',
      results
    });
  } catch (error) {
    if (req.file) {
      try { await fs.unlink(req.file.path); } catch (e) { /* ignore */ }
    }
    res.status(500).json({ message: 'Gagal import users', error: error.message });
  }
});

router.post('/import-questions', authenticateToken, authorizeRole(['admin', 'guru']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File tidak ditemukan' });
    }

    const { ujian_id, kelas_id } = req.body;

    if (!ujian_id) {
      try { await fs.unlink(req.file.path); } catch (e) { /* ignore */ }
      return res.status(400).json({ message: 'ujian_id diperlukan' });
    }

    if (!kelas_id) {
      try { await fs.unlink(req.file.path); } catch (e) { /* ignore */ }
      return res.status(400).json({ message: 'kelas_id diperlukan' });
    }

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    // Get the current max nomor_urut for this exam
    const [maxNomorResult] = await db.query(
      'SELECT MAX(nomor_urut) as max_nomor FROM soal WHERE ujian_id = ?',
      [ujian_id]
    );
    let startNomor = maxNomorResult.max_nomor ? parseInt(maxNomorResult.max_nomor) + 1 : 1;

    for (const row of data) {
      try {
        const { 
          nomor_urut, teks_soal, tipe_soal, 
          pilihan_a, pilihan_b, pilihan_c, pilihan_d, pilihan_e,
          kunci_jawaban, bobot,
          jawaban_essay, jawaban_benar_salah, jawaban_multiple 
        } = row;

        logger.debug({ row }, 'Processing row for import');

        if (!teks_soal) {
          results.failed++;
          results.errors.push({ row, error: 'teks_soal wajib diisi' });
          continue;
        }

        const questionType = tipe_soal ? tipe_soal.toLowerCase().trim() : 'pilihan_ganda';
        const validTypes = ['pilihan_ganda', 'essay', 'benar_salah', 'multiple_answer'];
        
        logger.debug({ questionType }, 'Question type detected');
        
        if (!validTypes.includes(questionType)) {
          results.failed++;
          results.errors.push({ row, error: `Tipe soal tidak valid: ${tipe_soal}` });
          continue;
        }

        // Validation per question type
        if (questionType === 'pilihan_ganda') {
          if (!pilihan_a || !pilihan_b || !pilihan_c || !pilihan_d || !kunci_jawaban) {
            results.failed++;
            results.errors.push({ row, error: 'Pilihan ganda memerlukan pilihan_a, pilihan_b, pilihan_c, pilihan_d, dan kunci_jawaban' });
            continue;
          }
          const validAnswers = ['A', 'B', 'C', 'D', 'E'];
          if (!validAnswers.includes(kunci_jawaban.toUpperCase().trim())) {
            results.failed++;
            results.errors.push({ row, error: 'Kunci jawaban harus A, B, C, D, atau E' });
            continue;
          }
        } else if (questionType === 'essay') {
          if (!jawaban_essay || jawaban_essay.toString().trim() === '') {
            results.failed++;
            results.errors.push({ row, error: 'Essay memerlukan jawaban_essay (contoh jawaban)' });
            continue;
          }
        } else if (questionType === 'benar_salah') {
          if (!jawaban_benar_salah || jawaban_benar_salah.toString().trim() === '') {
            results.failed++;
            results.errors.push({ row, error: 'Benar/Salah memerlukan jawaban_benar_salah (B atau S)' });
            continue;
          }
          const validBS = ['B', 'S'];
          if (!validBS.includes(jawaban_benar_salah.toString().toUpperCase().trim())) {
            results.failed++;
            results.errors.push({ row, error: 'jawaban_benar_salah harus B (Benar) atau S (Salah)' });
            continue;
          }
        } else if (questionType === 'multiple_answer') {
          if (!pilihan_a || !pilihan_b || !pilihan_c || !pilihan_d || !jawaban_multiple) {
            results.failed++;
            results.errors.push({ row, error: 'Multiple answer memerlukan pilihan_a, pilihan_b, pilihan_c, pilihan_d, dan jawaban_multiple' });
            continue;
          }
          // Validate jawaban_multiple format (comma-separated, e.g., "A,B,C")
          const answers = jawaban_multiple.toString().toUpperCase().trim().split(',').map(a => a.trim());
          const validAnswers = ['A', 'B', 'C', 'D', 'E'];
          const invalidAnswers = answers.filter(a => !validAnswers.includes(a));
          if (invalidAnswers.length > 0 || answers.length === 0) {
            results.failed++;
            results.errors.push({ row, error: 'jawaban_multiple harus format CSV: A,B atau A,B,C (maksimal A-E)' });
            continue;
          }
        }

        const insertResult = await db.query(
          `INSERT INTO soal (ujian_id, kelas_id, teks_soal, pilihan_a, pilihan_b, pilihan_c, pilihan_d, pilihan_e, kunci_jawaban, nomor_urut, bobot, tipe_soal, jawaban_essay, jawaban_benar_salah, jawaban_multiple) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ujian_id, 
            kelas_id, 
            teks_soal, 
            pilihan_a || null, 
            pilihan_b || null, 
            pilihan_c || null, 
            pilihan_d || null, 
            pilihan_e || null, 
            kunci_jawaban ? kunci_jawaban.toUpperCase().trim() : null, 
            nomor_urut || startNomor, 
            bobot || 1,
            questionType,
            jawaban_essay || null,
            jawaban_benar_salah ? jawaban_benar_salah.toString().toUpperCase().trim() : null,
            jawaban_multiple ? jawaban_multiple.toString().toUpperCase().trim() : null
          ]
        );
        
        logger.debug({ insertId: insertResult?.insertId }, 'Question inserted');

        startNomor++;
        results.success++;
      } catch (error) {
        logger.error({ err: error, row }, 'Error processing row');
        results.failed++;
        results.errors.push({ row, error: error.message });
      }
    }
    
    logger.info({ success: results.success, failed: results.failed }, 'Import results');

    try { await fs.unlink(req.file.path); } catch (e) { /* ignore */ }

    await logActivity(req.user.id, 'BULK_IMPORT_QUESTIONS', 'soal', ujian_id, { success: results.success, failed: results.failed }, req);

    res.json({
      message: 'Import selesai',
      results
    });
  } catch (error) {
    if (req.file) {
      try { await fs.unlink(req.file.path); } catch (e) { /* ignore */ }
    }
    res.status(500).json({ message: 'Gagal import soal', error: error.message });
  }
});

router.get('/export-users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const users = await db.query(`
      SELECT u.id, u.nisn, u.nama, u.email, u.no_peserta, u.role, k.nama_kelas, u.created_at
      FROM users u
      LEFT JOIN kelas k ON u.kelas_id = k.id
      ORDER BY u.role ASC, u.nama ASC
    `);

    const worksheet = xlsx.utils.json_to_sheet(users);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Users');

    const fileName = `users-export-${Date.now()}.xlsx`;
    const filePath = path.join(uploadDir, fileName);
    xlsx.writeFile(workbook, filePath);

    res.download(filePath, fileName, (err) => {
      fs.unlink(filePath).catch(() => {});
      if (err) {
        logger.warn({ err }, 'Error downloading file');
      }
    });

    await logActivity(req.user.id, 'EXPORT_USERS', 'user', null, null, req);
  } catch (error) {
    res.status(500).json({ message: 'Gagal export users', error: error.message });
  }
});

router.get('/export-students', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const students = await db.query(`
      SELECT u.nisn, u.nama, u.no_peserta, k.nama_kelas, u.email, u.created_at
      FROM users u
      LEFT JOIN kelas k ON u.kelas_id = k.id
      WHERE u.role = 'siswa'
      ORDER BY u.nama ASC
    `);

    const worksheet = xlsx.utils.json_to_sheet(students);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Students');

    const fileName = `students-export-${Date.now()}.xlsx`;
    const filePath = path.join(uploadDir, fileName);
    xlsx.writeFile(workbook, filePath);

    res.download(filePath, fileName, (err) => {
      fs.unlink(filePath).catch(() => {});
      if (err) {
        logger.warn({ err }, 'Error downloading file');
      }
    });

    await logActivity(req.user.id, 'EXPORT_STUDENTS', 'user', null, null, req);
  } catch (error) {
    logger.error({ err: error }, 'Export students error');
    res.status(500).json({ message: 'Gagal export students', error: error.message });
  }
});

router.get('/export-results/:ujianId', authenticateToken, authorizeRole(['admin', 'guru']), async (req, res) => {
  try {
    const { ujianId } = req.params;

    const results = await db.query(`
      SELECT h.id, u.nama, u.email, k.nama_kelas, uj.judul as ujian, 
             h.skor, h.grade, h.passed, h.jumlah_benar, h.jumlah_soal,
             h.waktu_mulai, h.waktu_selesai, h.tab_switches, h.fullscreen_exits
      FROM hasil h
      JOIN users u ON h.user_id = u.id
      JOIN ujian uj ON h.ujian_id = uj.id
      LEFT JOIN kelas k ON u.kelas_id = k.id
      WHERE h.ujian_id = ?
      ORDER BY h.skor DESC
    `, [ujianId]);

    const worksheet = xlsx.utils.json_to_sheet(results);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Results');

    const fileName = `results-export-${ujianId}-${Date.now()}.xlsx`;
    const filePath = path.join(uploadDir, fileName);
    xlsx.writeFile(workbook, filePath);

    res.download(filePath, fileName, (err) => {
      fs.unlink(filePath).catch(() => {});
      if (err) {
        logger.warn({ err }, 'Error downloading file');
      }
    });

    await logActivity(req.user.id, 'EXPORT_RESULTS', 'hasil', ujianId, null, req);
  } catch (error) {
    res.status(500).json({ message: 'Gagal export results', error: error.message });
  }
});

router.get('/template/users', authenticateToken, authorizeRole(['admin', 'guru']), (req, res) => {
  try {
    const template = [
      {
        nisn: '1234567890',
        nama: 'Contoh Nama',
        password: 'password123',
        role: 'siswa',
        kelas_id: '1',
        no_peserta: 'P-2024-0001',
        email: ''
      },
      {
        nisn: '0098765432',
        nama: 'Contoh Siswa Lain',
        password: 'rahasia123',
        role: 'siswa',
        kelas_id: '2',
        no_peserta: 'P-2024-0002',
        email: ''
      }
    ];

    // Set column order: NISN first, then nama, password, role, kelas_id, no_peserta, email
    const worksheet = xlsx.utils.json_to_sheet(template, {
      header: ['nisn', 'nama', 'password', 'role', 'kelas_id', 'no_peserta', 'email']
    });
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Users Template');

    const fileName = `template-users.xlsx`;
    const filePath = path.join(uploadDir, fileName);
    xlsx.writeFile(workbook, filePath);

    res.download(filePath, fileName, (err) => {
      fs.unlink(filePath).catch(() => {});
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal download template', error: error.message });
  }
});

router.get('/template/questions', authenticateToken, authorizeRole(['admin', 'guru']), (req, res) => {
  try {
    const template = [
      {
        nomor_urut: 1,
        teks_soal: 'Contoh pertanyaan pilihan ganda?',
        tipe_soal: 'pilihan_ganda',
        pilihan_a: 'Pilihan A',
        pilihan_b: 'Pilihan B',
        pilihan_c: 'Pilihan C',
        pilihan_d: 'Pilihan D',
        pilihan_e: 'Pilihan E',
        kunci_jawaban: 'A',
        bobot: 1,
        jawaban_essay: '',
        jawaban_benar_salah: '',
        jawaban_multiple: ''
      },
      {
        nomor_urut: 2,
        teks_soal: 'Contoh soal essay? Jelaskan pendapat Anda.',
        tipe_soal: 'essay',
        pilihan_a: '',
        pilihan_b: '',
        pilihan_c: '',
        pilihan_d: '',
        pilihan_e: '',
        kunci_jawaban: '',
        bobot: 1,
        jawaban_essay: 'Contoh jawaban essay yang diharapkan',
        jawaban_benar_salah: '',
        jawaban_multiple: ''
      },
      {
        nomor_urut: 3,
        teks_soal: 'Pernyataan: Indonesia merdeka tahun 1945',
        tipe_soal: 'benar_salah',
        pilihan_a: '',
        pilihan_b: '',
        pilihan_c: '',
        pilihan_d: '',
        pilihan_e: '',
        kunci_jawaban: '',
        bobot: 1,
        jawaban_essay: '',
        jawaban_benar_salah: 'B', // B = Benar, S = Salah
        jawaban_multiple: ''
      },
      {
        nomor_urut: 4,
        teks_soal: 'Pilih semua jawaban yang benar (multi jawaban)',
        tipe_soal: 'multiple_answer',
        pilihan_a: 'Pilihan A',
        pilihan_b: 'Pilihan B',
        pilihan_c: 'Pilihan C',
        pilihan_d: 'Pilihan D',
        pilihan_e: 'Pilihan E',
        kunci_jawaban: '',
        bobot: 1,
        jawaban_essay: '',
        jawaban_benar_salah: '',
        jawaban_multiple: 'A,B,C' // Format: pisahkan dengan koma, contoh: A,B atau A,B,C
      }
    ];

    const worksheet = xlsx.utils.json_to_sheet(template, {
      header: ['nomor_urut', 'teks_soal', 'tipe_soal', 'pilihan_a', 'pilihan_b', 'pilihan_c', 'pilihan_d', 'pilihan_e', 'kunci_jawaban', 'bobot', 'jawaban_essay', 'jawaban_benar_salah', 'jawaban_multiple']
    });
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 12 }, // nomor_urut
      { wch: 50 }, // teks_soal
      { wch: 15 }, // tipe_soal
      { wch: 30 }, // pilihan_a
      { wch: 30 }, // pilihan_b
      { wch: 30 }, // pilihan_c
      { wch: 30 }, // pilihan_d
      { wch: 30 }, // pilihan_e
      { wch: 15 }, // kunci_jawaban
      { wch: 10 }, // bobot
      { wch: 50 }, // jawaban_essay
      { wch: 15 }, // jawaban_benar_salah
      { wch: 20 }  // jawaban_multiple
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Questions Template');

    const fileName = `template-questions.xlsx`;
    const filePath = path.join(uploadDir, fileName);
    xlsx.writeFile(workbook, filePath);

    res.download(filePath, fileName, (err) => {
      fs.unlink(filePath).catch(() => {});
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal download template', error: error.message });
  }
});

module.exports = router;
