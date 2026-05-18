require('dotenv').config();
const db = require('./config/database');

async function testInsert() {
  try {
    console.log('Testing INSERT operation...');
    
    // Test data similar to what would come from the frontend
    const testData = {
      ujian_id: 1, // Use an existing exam ID
      teks_soal: 'Test question?',
      pilihan_a: 'Option A',
      pilihan_b: 'Option B',
      pilihan_c: 'Option C',
      pilihan_d: 'Option D',
      pilihan_e: 'Option E',
      kunci_jawaban: 'A',
      nomor_urut: 1
    };
    
    console.log('Inserting test data:', testData);
    
    const result = await db.query(
      'INSERT INTO soal (ujian_id, teks_soal, pilihan_a, pilihan_b, pilihan_c, pilihan_d, pilihan_e, kunci_jawaban, nomor_urut) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        testData.ujian_id, 
        testData.teks_soal, 
        testData.pilihan_a, 
        testData.pilihan_b, 
        testData.pilihan_c, 
        testData.pilihan_d, 
        testData.pilihan_e, 
        testData.kunci_jawaban.toUpperCase(), 
        testData.nomor_urut || 0
      ]
    );
    
    console.log('Insert successful! Result:', result);
    
  } catch (error) {
    console.error('Error during test insert:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
  } finally {
    await db.end();
  }
}

testInsert();