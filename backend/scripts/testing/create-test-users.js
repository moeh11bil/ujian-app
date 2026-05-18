const mariadb = require('mariadb');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createTestUsers() {
  let conn;

  try {
    conn = await mariadb.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123',
      database: process.env.DB_NAME || 'ujian_db',
    });

    console.log('Connected to MariaDB database');

    // Hash the passwords
    const adminPassword = await bcrypt.hash('admin123', 10);
    const teacherPassword = await bcrypt.hash('teacher123', 10);
    const studentPassword = await bcrypt.hash('student123', 10);

    // Insert test users if they don't exist
    const adminResult = await conn.query(`
      INSERT IGNORE INTO users (nama, email, password, role) 
      VALUES ('Admin Utama', 'admin@example.com', ?, 'admin')
    `, [adminPassword]);
    
    const teacherResult = await conn.query(`
      INSERT IGNORE INTO users (nama, email, password, role) 
      VALUES ('Guru Pengajar', 'guru@example.com', ?, 'guru')
    `, [teacherPassword]);
    
    const studentResult = await conn.query(`
      INSERT IGNORE INTO users (nama, email, password, role) 
      VALUES ('Siswa Teladan', 'siswa@example.com', ?, 'siswa')
    `, [studentPassword]);

    console.log('Test users created successfully!');
    console.log('- Admin: admin@example.com / admin123');
    console.log('- Guru: guru@example.com / teacher123');
    console.log('- Siswa: siswa@example.com / student123');

    // Insert or update test exam
    const examResult = await conn.query(`
      INSERT INTO ujian (judul, durasi, waktu_mulai, waktu_selesai, status)
      VALUES ('Matematika kelas 10', 60, NOW(), DATE_ADD(NOW(), INTERVAL 60 MINUTE), 'aktif')
      ON DUPLICATE KEY UPDATE
        judul = VALUES(judul),
        durasi = VALUES(durasi),
        waktu_mulai = VALUES(waktu_mulai),
        waktu_selesai = VALUES(waktu_selesai),
        status = VALUES(status)
    `);

    console.log('Test exam created/updated successfully!');

  } catch (error) {
    console.error('Error creating test users:', error);
  } finally {
    if (conn) await conn.end();
  }
}

createTestUsers();