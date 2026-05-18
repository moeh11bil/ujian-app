const db = require('./config/database');

async function updateSchema() {
  try {
    console.log('Updating database schema...');

    // Create kelas table
    await db.query(`
      CREATE TABLE IF NOT EXISTS kelas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_kelas VARCHAR(100) NOT NULL UNIQUE,
        deskripsi TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('Created kelas table');

    // Add kelas_id column to users table if it doesn't exist
    try {
      await db.query('ALTER TABLE users ADD COLUMN kelas_id INT NULL AFTER role');
      console.log('Added kelas_id column to users table');
    } catch (err) {
      // Column might already exist, which is fine
      if (err.code !== 'ER_DUP_FIELDNAME') {
        console.log('kelas_id column may already exist (this is OK)');
      }
    }

    // Add nisn column to users table if it doesn't exist
    try {
      await db.query('ALTER TABLE users ADD COLUMN nisn VARCHAR(20) NULL AFTER email');
      console.log('Added nisn column to users table');
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') {
        console.log('nisn column may already exist (this is OK)');
      }
    }

    // Add no_peserta column to users table if it doesn't exist
    try {
      await db.query('ALTER TABLE users ADD COLUMN no_peserta VARCHAR(30) NULL AFTER nisn');
      console.log('Added no_peserta column to users table');
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') {
        console.log('no_peserta column may already exist (this is OK)');
      }
    }

    // Make email nullable (students login with NISN)
    try {
      await db.query('ALTER TABLE users MODIFY COLUMN email VARCHAR(100) NULL');
      console.log('Modified email column to nullable');
    } catch (err) {
      console.log('Could not modify email column (this is OK)');
    }

    // Add unique index on nisn
    try {
      await db.query('ALTER TABLE users ADD UNIQUE INDEX idx_users_nisn_unique (nisn)');
      console.log('Added unique index on nisn');
    } catch (err) {
      console.log('Unique index on nisn may already exist (this is OK)');
    }

    // Add foreign key constraint
    try {
      await db.query('ALTER TABLE users ADD FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE SET NULL');
      console.log('Added foreign key constraint for kelas_id');
    } catch (err) {
      // Foreign key might already exist, which is fine
      console.log('Foreign key constraint may already exist (this is OK)');
    }

    console.log('Database schema updated successfully!');
  } catch (error) {
    console.error('Error updating database schema:', error);
  }
}

updateSchema();