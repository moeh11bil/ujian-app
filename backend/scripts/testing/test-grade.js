const db = require('./config/database');

async function testGradeEndpoint() {
  let connection;
  
  try {
    console.log('Testing grade-all endpoint logic...\n');
    
    const hasilId = 8;
    
    // Verify submission exists
    const hasil = await db.query('SELECT * FROM hasil WHERE id = ?', [hasilId]);
    console.log('Hasil:', hasil.length ? 'Found' : 'Not found');
    if (hasil.length) {
      console.log('  - ujian_id:', hasil[0].ujian_id);
      console.log('  - user_id:', hasil[0].user_id);
    }
    
    // Get all essay questions for validation
    const essays = await db.query(
      'SELECT id, bobot, teks_soal FROM soal WHERE ujian_id = (SELECT ujian_id FROM hasil WHERE id = ?) AND tipe_soal = ?',
      [hasilId, 'essay']
    );
    
    console.log('\nEssay questions found:', essays.length);
    essays.forEach(e => {
      console.log(`  - Soal ${e.id}: bobot=${e.bobot}`);
    });
    
    const essayMap = essays.reduce((acc, e) => {
      acc[e.id] = e;
      return acc;
    }, {});
    
    // Test grades data (simulating what frontend sends)
    const grades = [
      { soal_id: 22, given_score: 5, notes: 'Test', student_answer: 'Test answer' }
    ];
    
    console.log('\nValidating grades...');
    for (const grade of grades) {
      const essay = essayMap[grade.soal_id];
      if (!essay) {
        console.log(`  ERROR: Soal ${grade.soal_id} tidak ditemukan`);
        return;
      }
      const score = parseFloat(grade.given_score);
      if (isNaN(score) || score < 0 || score > essay.bobot) {
        console.log(`  ERROR: Nilai untuk soal ${grade.soal_id} harus antara 0 dan ${essay.bobot}`);
        return;
      }
      console.log(`  OK: Soal ${grade.soal_id}, score=${score}, max=${essay.bobot}`);
    }
    
    // Test insert
    console.log('\nTesting database insert...');
    connection = await db.getConnection();
    await connection.beginTransaction();
    
    const grade = grades[0];
    const existing = await connection.query(
      'SELECT id FROM essay_grading WHERE hasil_id = ? AND soal_id = ?',
      [hasilId, grade.soal_id]
    );
    
    console.log('Existing record:', existing.length ? 'Found' : 'Not found');
    
    if (existing.length) {
      console.log('Updating existing record...');
      await connection.query(`
        UPDATE essay_grading
        SET given_score = ?, notes = ?, student_answer = ?, graded_by = ?, graded_at = NOW()
        WHERE hasil_id = ? AND soal_id = ?
      `, [grade.given_score, grade.notes, grade.student_answer, 1, hasilId, grade.soal_id]);
    } else {
      console.log('Inserting new record...');
      const essay = essayMap[grade.soal_id];
      await connection.query(`
        INSERT INTO essay_grading (hasil_id, soal_id, student_answer, max_score, given_score, notes, graded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [hasilId, grade.soal_id, grade.student_answer, essay.bobot, grade.given_score, grade.notes, 1]);
    }
    
    await connection.commit();
    console.log('SUCCESS: Database operation completed!');
    
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('ERROR:', error.message);
    console.error('Full error:', error);
  } finally {
    if (connection) {
      await connection.release();
    }
    await db.end();
  }
}

testGradeEndpoint();
