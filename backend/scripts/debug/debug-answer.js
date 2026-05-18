const db = require('./config/database');

async function debugAnswer() {
  try {
    const hasilId = 8;
    
    // Get submission
    const hasil = await db.query('SELECT * FROM hasil WHERE id = ?', [hasilId]);
    const submissionData = hasil[0];
    
    console.log('=== SUBMISSION DATA ===');
    console.log('jawaban_siswa:', submissionData.jawaban_siswa);
    
    let jawabanSiswa;
    if (typeof submissionData.jawaban_siswa === 'string') {
      jawabanSiswa = JSON.parse(submissionData.jawaban_siswa || '{}');
    } else {
      jawabanSiswa = submissionData.jawaban_siswa || {};
    }
    
    console.log('\nParsed jawaban_siswa:', JSON.stringify(jawabanSiswa, null, 2));
    
    // Get questions
    const questions = await db.query(`
      SELECT
        s.id as soal_id,
        s.tipe_soal,
        s.jawaban_benar_salah,
        s.kunci_jawaban,
        s.bobot
      FROM soal s
      WHERE s.ujian_id = (SELECT ujian_id FROM hasil WHERE id = ?)
      ORDER BY s.nomor_urut
    `, [hasilId]);
    
    console.log('\n=== QUESTIONS ===');
    questions.forEach(q => {
      const studentAnswer = jawabanSiswa[q.soal_id?.toString()] || '';
      console.log(`\nSoal ${q.soal_id} (${q.tipe_soal}):`);
      console.log(`  - kunci_jawaban: "${q.kunci_jawaban}"`);
      console.log(`  - jawaban_benar_salah: "${q.jawaban_benar_salah}"`);
      console.log(`  - student_answer: "${studentAnswer}"`);
      
      // Test checkAnswer logic
      let isCorrect = false;
      if (q.tipe_soal === 'pilihan_ganda') {
        isCorrect = studentAnswer.toUpperCase() === q.kunci_jawaban;
      } else if (q.tipe_soal === 'benar_salah') {
        isCorrect = studentAnswer.toUpperCase() === q.jawaban_benar_salah;
      } else if (q.tipe_soal === 'multiple_answer') {
        const correct = q.kunci_jawaban?.split(',').sort().join('');
        const student = studentAnswer.split(',').sort().join('');
        isCorrect = correct === student;
      }
      
      console.log(`  - is_correct: ${isCorrect}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.end();
  }
}

debugAnswer();
