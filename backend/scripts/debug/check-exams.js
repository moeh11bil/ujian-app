require('dotenv').config();
const db = require('./config/database');

async function checkExams() {
  try {
    console.log('Checking exams in the database...');
    
    const exams = await db.query('SELECT * FROM ujian');
    
    console.log('Available exams:');
    exams.forEach(exam => {
      console.log(`ID: ${exam.id}, Title: ${exam.judul}, Status: ${exam.status}`);
    });
    
  } catch (error) {
    console.error('Error checking exams:', error);
  } finally {
    await db.end();
  }
}

checkExams();