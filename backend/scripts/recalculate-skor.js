const db = require('./config/database');

async function recalculateSkor() {
  try {
    const submissions = await db.query(`
      SELECT h.id, h.ujian_id, h.auto_grade_score, h.total_essay_score,
        (SELECT COUNT(*) FROM soal s WHERE s.ujian_id = h.ujian_id AND s.tipe_soal != 'essay') as non_essay_count
      FROM hasil h
    `);

    console.log(`Found ${submissions.length} submissions to recalculate`);

    for (const s of submissions) {
      const soal = await db.query(
        'SELECT tipe_soal, bobot FROM soal WHERE ujian_id = ?',
        [s.ujian_id]
      );

      const maxAuto = soal.filter(x => x.tipe_soal !== 'essay')
        .reduce((sum, x) => sum + (x.bobot || 1), 0);
      const maxEssay = soal.filter(x => x.tipe_soal === 'essay')
        .reduce((sum, x) => sum + (x.bobot || 1), 0);
      const maxTotal = maxAuto + maxEssay;

      const autoScore = parseFloat(s.auto_grade_score || 0);
      const essayScore = parseFloat(s.total_essay_score || 0);
      const totalScore = autoScore + essayScore;
      const newSkor = maxTotal > 0 ? (totalScore / maxTotal) * 100 : 0;

      await db.query('UPDATE hasil SET skor = ? WHERE id = ?', [newSkor, s.id]);
      console.log(`Submission ${s.id}: old=${autoScore}pts+${essayScore}pts, new=${newSkor.toFixed(1)}% (max=${maxTotal})`);
    }

    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

recalculateSkor();
