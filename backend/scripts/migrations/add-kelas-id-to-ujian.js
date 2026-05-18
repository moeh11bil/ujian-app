const db = require('../../config/database');

async function addKelasIdColumn() {
  try {
    // Check if kelas_id column already exists
    const result = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'ujian' 
      AND COLUMN_NAME = 'kelas_id'
    `);

    if (result.length > 0) {
      console.log('kelas_id column already exists in ujian table');
      return;
    }

    // Add kelas_id column to ujian table
    await db.query(`
      ALTER TABLE ujian 
      ADD COLUMN kelas_id INT,
      ADD FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE SET NULL
    `);

    console.log('Successfully added kelas_id column to ujian table');
  } catch (error) {
    console.error('Error adding kelas_id column:', error);
  }
}

addKelasIdColumn().then(() => {
  console.log('Process completed');
  process.exit(0);
});