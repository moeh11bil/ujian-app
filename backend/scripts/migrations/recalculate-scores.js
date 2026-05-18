const db = require('./config/database');

async function recalculateScores() {
  let conn;
  
  try {
    conn = await db.getConnection();
    
    console.log('=== Recalculating All Scores ===\n');
    
    // Get all submissions
    const submissions = await conn.query('SELECT id, ujian_id, jawaban_siswa FROM hasil');
    
    console.log(`Found ${submissions.length} submissions\n`);
    
    let updated = 0;
    
    for (const submission of submissions) {
      const { id, ujian_id, jawaban_siswa } = submission;
      
      // Parse jawaban_siswa
      let jawabanSiswa;
      try {
        if (typeof jawaban_siswa === 'string') {
          jawabanSiswa = JSON.parse(jawaban_siswa || '{}');
        } else {
          jawabanSiswa = jawaban_siswa || {};
        }
      } catch (e) {
        console.error(`Error parsing jawaban_siswa for submission ${id}:`, e);
        continue;
      }
      
      // Get all questions for this exam
      const questions = await conn.query(`
        SELECT 
          id, tipe_soal, kunci_jawaban, jawaban_benar_salah, jawaban_multiple, bobot
        FROM soal
        WHERE ujian_id = ?
      `, [ujian_id]);
      
      let autoScore = 0;
      let maxAutoScore = 0;
      let maxEssayScore = 0;
      
      for (const q of questions) {
        const studentAnswer = jawabanSiswa[q.id?.toString()] || '';
        
        if (q.tipe_soal === 'essay') {
          maxEssayScore += q.bobot || 1;
        } else {
          maxAutoScore += q.bobot || 1;
          
          let isCorrect = false;
          
          if (q.tipe_soal === 'pilihan_ganda') {
            isCorrect = studentAnswer.toUpperCase() === q.kunci_jawaban;
          } else if (q.tipe_soal === 'benar_salah') {
            const studentBS = studentAnswer.toLowerCase() === 'benar' ? 'B' : 
                              studentAnswer.toLowerCase() === 'salah' ? 'S' : 
                              studentAnswer.toUpperCase();
            isCorrect = studentBS === q.jawaban_benar_salah;
          } else if (q.tipe_soal === 'multiple_answer') {
            const correctAnswer = q.jawaban_multiple || q.kunci_jawaban;
            if (correctAnswer) {
              const correct = correctAnswer.split(',').map(s => s.trim()).sort().join('');
              const student = studentAnswer.split(',').map(s => s.trim()).sort().join('');
              isCorrect = correct === student;
            }
          }
          
          if (isCorrect) {
            autoScore += q.bobot || 1;
          }
        }
      }
      
      // Get essay scores from essay_grading
      const essayGrading = await conn.query(`
        SELECT SUM(given_score) as total_essay_score
        FROM essay_grading
        WHERE hasil_id = ?
      `, [id]);
      
      const totalEssayScore = parseFloat(essayGrading[0]?.total_essay_score) || 0;
      
      // Calculate total score and percentage
      const totalMaxScore = maxAutoScore + maxEssayScore;
      const totalScore = autoScore + totalEssayScore;
      const percentage = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;
      
      // Determine grade
      const grade = percentage >= 90 ? 'A' : 
                    percentage >= 80 ? 'B' : 
                    percentage >= 70 ? 'C' : 
                    percentage >= 60 ? 'D' : 'E';
      
      // Determine if passed (assuming passing grade is 70)
      const passed = percentage >= 70;
      
      // Update the submission
      await conn.query(`
        UPDATE hasil
        SET auto_grade_score = ?,
            total_essay_score = ?,
            skor = ?,
            grade = ?,
            passed = ?,
            manual_grade_status = 'completed'
        WHERE id = ?
      `, [autoScore, totalEssayScore, percentage.toFixed(2), grade, passed, id]);
      
      console.log(`Submission ${id}:`);
      console.log(`  Auto: ${autoScore}/${maxAutoScore}`);
      console.log(`  Essay: ${totalEssayScore}/${maxEssayScore}`);
      console.log(`  Total: ${totalScore}/${totalMaxScore} (${percentage.toFixed(2)}%)`);
      console.log(`  Grade: ${grade} (${passed ? 'LULUS' : 'TIDAK LULUS'})`);
      console.log('');
      
      updated++;
    }
    
    console.log(`=== Complete ===`);
    console.log(`Updated ${updated} submissions`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (conn) await conn.release();
    await db.end();
  }
}

recalculateScores();
