const mariadb = require('mariadb');
require('dotenv').config();

async function createActiveExam() {
  let conn;

  try {
    conn = await mariadb.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123',
      database: process.env.DB_NAME || 'ujian_db',
    });

    console.log('Connected to MariaDB database');

    // Create an exam that is active right now
    const now = new Date();
    const startTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago
    const endTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

    // Format waktu untuk database
    const formatDateTime = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');

      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    const startTimeStr = formatDateTime(startTime);
    const endTimeStr = formatDateTime(endTime);

    console.log('Creating active exam with start time:', startTimeStr, 'and end time:', endTimeStr);

    // Insert the new exam
    const result = await conn.query(`
      INSERT INTO ujian (judul, durasi, waktu_mulai, waktu_selesai, status)
      VALUES (?, ?, ?, ?, ?)
    `, ['Ujian Aktif Sekarang', 60, startTimeStr, endTimeStr, 'aktif']);

    const examId = result.insertId;
    console.log('New active exam created with id:', examId);

    // Add sample questions for this exam
    await conn.query(`
      INSERT INTO soal (ujian_id, teks_soal, pilihan_a, pilihan_b, pilihan_c, pilihan_d, kunci_jawaban, nomor_urut)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [examId, 'Apa ibukota Indonesia?', 'Jakarta', 'Bandung', 'Surabaya', 'Medan', 'A', 1]);

    await conn.query(`
      INSERT INTO soal (ujian_id, teks_soal, pilihan_a, pilihan_b, pilihan_c, pilihan_d, kunci_jawaban, nomor_urut)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [examId, 'Berapa hasil dari 2 + 2?', '3', '4', '5', '6', 'B', 2]);

    console.log('Sample questions added for exam id:', examId);

  } catch (error) {
    console.error('Error creating active exam:', error);
  } finally {
    if (conn) await conn.end();
  }
}

createActiveExam();