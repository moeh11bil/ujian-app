const db = require('./config/database');

async function checkTableStructure() {
  try {
    console.log('Checking ujian table structure...');

    const result = await db.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ujian'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('Columns in ujian table:');
    result.forEach(col => {
      console.log(`${col.COLUMN_NAME}: ${col.DATA_TYPE}, nullable: ${col.IS_NULLABLE}, default: ${col.COLUMN_DEFAULT}, comment: ${col.COLUMN_COMMENT}`);
    });

    // Check if passing_grade exists
    const hasPassingGrade = result.some(col => col.COLUMN_NAME === 'passing_grade');
    if (!hasPassingGrade) {
      console.log('\n⚠️  passing_grade column is MISSING!');
      console.log('Adding passing_grade column...');
      
      await db.query(`
        ALTER TABLE ujian
        ADD COLUMN IF NOT EXISTS passing_grade DECIMAL(5,2) DEFAULT 70.00
        COMMENT 'Minimum passing grade percentage'
      `);
      
      console.log('✓ passing_grade column added successfully!');
    } else {
      console.log('\n✓ passing_grade column exists');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.end();
  }
}

checkTableStructure();
