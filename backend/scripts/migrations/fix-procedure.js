const db = require('../../config/database');

async function fixProcedure() {
  let conn;
  
  try {
    conn = await db.getConnection();
    
    console.log('Dropping old procedure...');
    await conn.query('DROP PROCEDURE IF EXISTS sp_calculate_final_score');
    
    console.log('Creating new procedure...');
    await conn.query(`
      CREATE PROCEDURE sp_calculate_final_score(IN p_hasil_id INT)
      BEGIN
        DECLARE v_auto_score DECIMAL(10,2);
        DECLARE v_essay_score DECIMAL(10,2);
        DECLARE v_total_score DECIMAL(10,2);
        DECLARE v_max_auto_score INT DEFAULT 0;
        DECLARE v_max_essay_score INT DEFAULT 0;
        DECLARE v_total_max_score INT DEFAULT 0;
        DECLARE v_final_percentage DECIMAL(10,2);
        DECLARE v_grade VARCHAR(2);
        DECLARE v_passed BOOLEAN;
        DECLARE v_passing_grade DECIMAL(5,2) DEFAULT 70;
        
        -- Get max possible scores and passing grade for this exam
        SELECT 
          COALESCE(SUM(CASE WHEN s.tipe_soal != 'essay' THEN s.bobot ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN s.tipe_soal = 'essay' THEN s.bobot ELSE 0 END), 0),
          COALESCE(u.passing_grade, 70)
        INTO v_max_auto_score, v_max_essay_score, v_passing_grade
        FROM soal s
        JOIN ujian u ON s.ujian_id = u.id
        WHERE s.ujian_id = (SELECT ujian_id FROM hasil WHERE id = p_hasil_id)
        GROUP BY s.ujian_id;
        
        SET v_total_max_score = v_max_auto_score + v_max_essay_score;
        
        -- Get auto grade score
        SELECT COALESCE(auto_grade_score, 0)
        INTO v_auto_score
        FROM hasil
        WHERE id = p_hasil_id;
        
        -- Get total essay score from grading
        SELECT COALESCE(SUM(given_score), 0)
        INTO v_essay_score
        FROM essay_grading
        WHERE hasil_id = p_hasil_id;
        
        -- Calculate total score and percentage
        SET v_total_score = v_auto_score + v_essay_score;
        
        -- Calculate final percentage (0-100 scale)
        IF v_total_max_score > 0 THEN
          SET v_final_percentage = (v_total_score / v_total_max_score) * 100;
        ELSE
          SET v_final_percentage = 0;
        END IF;
        
        -- Determine grade
        SET v_grade = CASE
          WHEN v_final_percentage >= 90 THEN 'A'
          WHEN v_final_percentage >= 80 THEN 'B'
          WHEN v_final_percentage >= 70 THEN 'C'
          WHEN v_final_percentage >= 60 THEN 'D'
          ELSE 'E'
        END;
        
        -- Determine if passed
        SET v_passed = v_final_percentage >= v_passing_grade;
        
        -- Update the hasil record
        UPDATE hasil h
        SET
          h.total_essay_score = v_essay_score,
          h.skor = ROUND(v_final_percentage, 2),
          h.grade = v_grade,
          h.passed = v_passed,
          h.manual_grade_status = 'completed',
          h.graded_at = NOW()
        WHERE h.id = p_hasil_id;
        
      END
    `);
    
    console.log('✓ Procedure recreated successfully!');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  } finally {
    if (conn) await conn.release();
    await db.end();
  }
}

fixProcedure();
