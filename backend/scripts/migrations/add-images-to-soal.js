const db = require('../../config/database');

async function addImageColumns() {
  try {
    // Add gambar_soal column
    await db.query(`
      ALTER TABLE soal 
      ADD COLUMN gambar_soal VARCHAR(255) NULL AFTER teks_soal
    `);
    console.log('✓ Added gambar_soal column');

    // Add gambar_pilihan_a column
    await db.query(`
      ALTER TABLE soal 
      ADD COLUMN gambar_pilihan_a VARCHAR(255) NULL AFTER pilihan_a
    `);
    console.log('✓ Added gambar_pilihan_a column');

    // Add gambar_pilihan_b column
    await db.query(`
      ALTER TABLE soal 
      ADD COLUMN gambar_pilihan_b VARCHAR(255) NULL AFTER pilihan_b
    `);
    console.log('✓ Added gambar_pilihan_b column');

    // Add gambar_pilihan_c column
    await db.query(`
      ALTER TABLE soal 
      ADD COLUMN gambar_pilihan_c VARCHAR(255) NULL AFTER pilihan_c
    `);
    console.log('✓ Added gambar_pilihan_c column');

    // Add gambar_pilihan_d column
    await db.query(`
      ALTER TABLE soal 
      ADD COLUMN gambar_pilihan_d VARCHAR(255) NULL AFTER pilihan_d
    `);
    console.log('✓ Added gambar_pilihan_d column');

    // Add gambar_pilihan_e column
    await db.query(`
      ALTER TABLE soal 
      ADD COLUMN gambar_pilihan_e VARCHAR(255) NULL AFTER pilihan_e
    `);
    console.log('✓ Added gambar_pilihan_e column');

    console.log('\n✅ All image columns added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding columns:', error.message);
    // Check if columns already exist
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️  Columns may already exist. This is fine.');
      process.exit(0);
    }
    process.exit(1);
  }
}

addImageColumns();
