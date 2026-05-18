const db = require('./config/database');

async function checkTableStructure() {
  try {
    console.log('Checking soal table structure...');
    
    const result = await db.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'soal'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('Columns in soal table:');
    result.forEach(col => {
      console.log(`${col.COLUMN_NAME}: ${col.DATA_TYPE}, nullable: ${col.IS_NULLABLE}, default: ${col.COLUMN_DEFAULT}, comment: ${col.COLUMN_COMMENT}`);
    });
    
  } catch (error) {
    console.error('Error checking table structure:', error);
  } finally {
    await db.end();
  }
}

checkTableStructure();