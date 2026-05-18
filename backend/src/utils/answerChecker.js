function checkAnswer(question, userAnswer) {
  if (!userAnswer) return false;

  if (question.tipe_soal === 'pilihan_ganda') {
    return userAnswer.toUpperCase() === (question.kunci_jawaban || '').toUpperCase();
  } else if (question.tipe_soal === 'benar_salah') {
    const studentBS = userAnswer.toLowerCase() === 'benar' ? 'B' :
                      userAnswer.toLowerCase() === 'salah' ? 'S' :
                      userAnswer.toUpperCase();
    return studentBS === (question.jawaban_benar_salah || '');
  } else if (question.tipe_soal === 'multiple_answer') {
    const correctAnswer = question.jawaban_multiple || question.kunci_jawaban;
    if (!correctAnswer) return false;
    const correct = correctAnswer.split(',').map(a => a.trim()).sort().join('');
    const student = userAnswer.split(',').map(a => a.trim()).sort().join('');
    return correct === student;
  }
  return false;
}

module.exports = { checkAnswer };
