const db = require('./config/database');

async function checkSoal() {
  try {
    const soal = await db.query(`
      SELECT id, tipe_soal, kunci_jawaban, jawaban_benar_salah, jawaban_multiple, teks_soal
      FROM soal
      WHERE ujian_id = (SELECT ujian_id FROM hasil WHERE id = 8)
      ORDER BY id
    `);
    
    console.log('=== SOAL DATA ===');
    soal.forEach(s => {
      console.log(`\nSoal ${s.id} (${s.tipe_soal}):`);
      console.log(`  - kunci_jawaban: "${s.kunci_jawaban}"`);
      console.log(`  - jawaban_benar_salah: "${s.jawaban_benar_salah}"`);
      console.log(`  - jawaban_multiple: "${s.jawaban_multiple}"`);
      console.log(`  - teks_soal: ${s.teks_soal?.substring(0, 50)}...`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.end();
  }
}

checkSoal();
