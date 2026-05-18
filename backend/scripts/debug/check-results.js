const db = require('./config/database');

async function checkResults() {
  try {
    const hasil = await db.query(`
      SELECT id, auto_grade_score, total_essay_score, skor, grade, passed
      FROM hasil
    `);
    
    console.log('=== HASIL TABLE ===\n');
    hasil.forEach(h => {
      console.log(`Submission ${h.id}:`);
      console.log(`  auto_grade_score: ${h.auto_grade_score}`);
      console.log(`  total_essay_score: ${h.total_essay_score}`);
      console.log(`  skor (percentage): ${h.skor}%`);
      console.log(`  grade: ${h.grade}`);
      console.log(`  passed: ${h.passed}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.end();
  }
}

checkResults();
