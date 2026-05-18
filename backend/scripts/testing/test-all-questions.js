const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { id: 1, nama: 'Test', email: 'test@test.com', role: 'guru' },
  'ujian_app_secret_key'
);

console.log('Testing all-questions API...\n');
console.log('Token:', token);

fetch('http://localhost:3000/api/essay-grading/submission/8/all-questions', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => {
  console.log('\nResponse status:', res.status);
  return res.json();
})
.then(data => {
  console.log('\n=== RESPONSE ===');
  console.log('Submission:', JSON.stringify(data.submission, null, 2));
  console.log('\nQuestions count:', data.questions.length);
  data.questions.forEach(q => {
    console.log(`\n- Soal ${q.soal_id} (${q.tipe_soal}):`);
    console.log(`  Student answer: ${q.student_answer?.substring(0, 50) || 'N/A'}...`);
    console.log(`  Is correct: ${q.is_correct}`);
    console.log(`  Auto score: ${q.auto_score}`);
    console.log(`  Given score: ${q.given_score}`);
    console.log(`  Is graded: ${q.is_graded}`);
  });
})
.catch(err => {
  console.error('Error:', err.message);
});
