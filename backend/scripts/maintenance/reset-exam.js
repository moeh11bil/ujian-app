const mariadb = require('mariadb');
require('dotenv').config();

async function resetExamTable() {
  let conn;

  try {
    conn = await mariadb.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123',
      database: process.env.DB_NAME || 'ujian_db',
    });

    console.log('Connected to MariaDB database');

    // Delete all exams
    await conn.query('DELETE FROM ujian');
    console.log('All exams deleted');

    // Insert a new exam with proper times
    const result = await conn.query(`
      INSERT INTO ujian (judul, durasi, waktu_mulai, waktu_selesai, status)
      VALUES ('Matematika kelas 10', 60, NOW(), DATE_ADD(NOW(), INTERVAL 60 MINUTE), 'aktif')
    `);

    console.log('New exam inserted with id:', result.insertId);

  } catch (error) {
    console.error('Error resetting exam table:', error);
  } finally {
    if (conn) await conn.end();
  }
}

resetExamTable();