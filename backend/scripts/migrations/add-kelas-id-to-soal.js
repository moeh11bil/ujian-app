const db = require('./config/database');

async function addKelasIdToSoal() {
  try {
    // Check if kelas_id column already exists
    const result = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'soal' 
      AND COLUMN_NAME = 'kelas_id'
    `);

    if (result.length > 0) {
      console.log('kelas_id column already exists in soal table');
      return;
    }

    // Add kelas_id column to soal table
    await db.query(`
      ALTER TABLE soal 
      ADD COLUMN kelas_id INT,
      ADD FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE SET NULL
    `);

    console.log('Successfully added kelas_id column to soal table');
  } catch (error) {
    console.error('Error adding kelas_id column to soal table:', error);
  }
}

addKelasIdToSoal().then(() => {
  console.log('Process completed');
  process.exit(0);
});