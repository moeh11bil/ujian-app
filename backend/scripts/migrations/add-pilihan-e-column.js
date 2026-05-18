const db = require('../../config/database');

async function addPilihanEColumn() {
  try {
    console.log('Connecting to database...');
    
    // Check if pilihan_e column already exists
    const result = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'soal' 
      AND COLUMN_NAME = 'pilihan_e'
    `);
    
    if (result.length > 0) {
      console.log('pilihan_e column already exists in the soal table');
      return;
    }
    
    // Add the pilihan_e column to the soal table
    await db.query(`
      ALTER TABLE soal 
      ADD COLUMN pilihan_e TEXT
    `);
    
    console.log('Successfully added pilihan_e column to the soal table');
    
    // Update the kunci_jawaban comment to reflect the new options
    await db.query(`
      ALTER TABLE soal 
      MODIFY COLUMN kunci_jawaban CHAR(1) NOT NULL COMMENT 'A, B, C, D, atau E'
    `);
    
    console.log('Successfully updated kunci_jawaban column comment');
  } catch (error) {
    console.error('Error adding pilihan_e column:', error);
  } finally {
    // Close the database connection pool
    await db.end();
  }
}

addPilihanEColumn();