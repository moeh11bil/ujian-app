const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { id: 1, nama: 'Test', email: 'test@test.com', role: 'guru' },
  'ujian_app_secret_key'
);

const testData = {
  grades: [
    {
      soal_id: 22,
      given_score: 2,
      notes: 'Test grading',
      student_answer: 'Test answer from student'
    }
  ]
};

console.log('Testing grade-all API...\n');
console.log('Token:', token);
console.log('Data:', JSON.stringify(testData, null, 2));

fetch('http://localhost:3000/api/essay-grading/submission/8/grade-all', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(testData)
})
.then(res => {
  console.log('\nResponse status:', res.status);
  return res.json();
})
.then(data => {
  console.log('Response data:', JSON.stringify(data, null, 2));
})
.catch(err => {
  console.error('Error:', err.message);
});
