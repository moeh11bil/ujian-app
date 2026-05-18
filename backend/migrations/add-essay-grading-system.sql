-- Migration: Add Essay Grading System
-- Created: 2026-02-19
-- Description: Adds support for manual essay grading with tracking and scoring

-- =====================================================
-- STEP 1: Add columns to hasil table for essay tracking
-- =====================================================

-- Add column to store individual essay scores as JSON
ALTER TABLE hasil 
ADD COLUMN IF NOT EXISTS essay_scores JSON COMMENT 'Nilai per soal essay: {soal_id: score}',
ADD COLUMN IF NOT EXISTS total_essay_score DECIMAL(10,2) DEFAULT 0 COMMENT 'Total nilai essay',
ADD COLUMN IF NOT EXISTS auto_grade_score DECIMAL(10,2) DEFAULT 0 COMMENT 'Nilai otomatis (pilihan ganda)',
ADD COLUMN IF NOT EXISTS manual_grade_status ENUM('pending', 'partial', 'completed') DEFAULT 'pending' COMMENT 'Status pemeriksaan essay',
ADD COLUMN IF NOT EXISTS graded_by INT COMMENT 'ID guru yang memeriksa',
ADD COLUMN IF NOT EXISTS graded_at TIMESTAMP NULL COMMENT 'Waktu selesai pemeriksaan',
ADD COLUMN IF NOT EXISTS examiner_notes TEXT COMMENT 'Catatan umum pemeriksa';

-- Add foreign key for graded_by
ALTER TABLE hasil 
ADD CONSTRAINT fk_hasil_graded_by 
FOREIGN KEY IF NOT EXISTS (graded_by) REFERENCES users(id) ON DELETE SET NULL;

-- =====================================================
-- STEP 2: Create essay_grading table for detailed tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS essay_grading (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hasil_id INT NOT NULL,
  soal_id INT NOT NULL,
  student_answer TEXT NOT NULL COMMENT 'Jawaban siswa',
  max_score INT NOT NULL COMMENT 'Bobot maksimum soal',
  given_score DECIMAL(10,2) NOT NULL COMMENT 'Nilai yang diberikan',
  notes TEXT COMMENT 'Catatan pemeriksa untuk soal ini',
  graded_by INT NOT NULL,
  graded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (hasil_id) REFERENCES hasil(id) ON DELETE CASCADE,
  FOREIGN KEY (soal_id) REFERENCES soal(id) ON DELETE CASCADE,
  FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE CASCADE,
  
  UNIQUE KEY unique_hasil_soal (hasil_id, soal_id),
  INDEX idx_hasil_id (hasil_id),
  INDEX idx_soal_id (soal_id),
  INDEX idx_graded_by (graded_by),
  INDEX idx_status_grading (hasil_id, graded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- STEP 3: Add index for performance
-- =====================================================

-- Index for faster queries on manual_grade_status
CREATE INDEX IF NOT EXISTS idx_hasil_manual_grade_status ON hasil(manual_grade_status);
CREATE INDEX IF NOT EXISTS idx_hasil_graded_at ON hasil(graded_at);

-- =====================================================
-- STEP 4: Update existing records (if any)
-- =====================================================

-- Set default values for existing records
UPDATE hasil 
SET manual_grade_status = 'completed',
    auto_grade_score = skor,
    total_essay_score = 0,
    graded_at = created_at
WHERE manual_grade_status IS NULL OR manual_grade_status = 'pending';

-- =====================================================
-- STEP 5: Create view for grading queue
-- =====================================================

CREATE OR REPLACE VIEW v_grading_queue AS
SELECT 
  h.id as hasil_id,
  h.user_id,
  u.nama as student_name,
  u.email as student_email,
  h.ujian_id,
  uj.judul as ujian_judul,
  uj.durasi,
  h.auto_grade_score,
  h.total_essay_score,
  h.skor as current_score,
  h.manual_grade_status,
  h.waktu_selesai as submitted_at,
  h.graded_by,
  h.graded_at,
  TIMESTAMPDIFF(MINUTE, h.waktu_selesai, NOW()) as minutes_since_submission,
  (SELECT COUNT(*) FROM soal s WHERE s.ujian_id = h.ujian_id AND s.tipe_soal = 'essay') as total_essay_questions,
  (SELECT COUNT(*) FROM essay_grading eg WHERE eg.hasil_id = h.id) as graded_essay_count
FROM hasil h
JOIN users u ON h.user_id = u.id
JOIN ujian uj ON h.ujian_id = uj.id
WHERE h.manual_grade_status IN ('pending', 'partial')
ORDER BY h.waktu_selesai ASC;

-- =====================================================
-- STEP 6: Create stored procedure to calculate final score
-- =====================================================

DELIMITER $$

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
  DECLARE v_passing_grade INT DEFAULT 70;
  
  -- Get max possible scores for this exam
  SELECT 
    COALESCE(SUM(CASE WHEN s.tipe_soal != 'essay' THEN s.bobot ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN s.tipe_soal = 'essay' THEN s.bobot ELSE 0 END), 0),
    uj.passing_grade
  INTO v_max_auto_score, v_max_essay_score, v_passing_grade
  FROM soal s
  JOIN ujian u ON s.ujian_id = u.id
  JOIN hasil h ON h.ujian_id = u.id
  WHERE h.id = p_hasil_id
  GROUP BY h.id, uj.passing_grade;
  
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
  SET v_passed = v_final_percentage >= COALESCE(v_passing_grade, 70);
  
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
  
END$$

DELIMITER ;

-- =====================================================
-- STEP 7: Add trigger to update status when essay is graded
-- =====================================================

DELIMITER $$

CREATE TRIGGER trg_update_grading_status
AFTER INSERT ON essay_grading
FOR EACH ROW
BEGIN
  DECLARE v_total_essays INT;
  DECLARE v_graded_count INT;
  DECLARE v_hasil_id INT;
  
  SET v_hasil_id = NEW.hasil_id;
  
  -- Get total essay questions for this exam
  SELECT COUNT(*) INTO v_total_essays
  FROM soal
  WHERE ujian_id = (SELECT ujian_id FROM hasil WHERE id = v_hasil_id)
    AND tipe_soal = 'essay';
  
  -- Get count of graded essays
  SELECT COUNT(*) INTO v_graded_count
  FROM essay_grading
  WHERE hasil_id = v_hasil_id;
  
  -- Update manual_grade_status
  IF v_graded_count = 0 THEN
    UPDATE hasil SET manual_grade_status = 'pending' WHERE id = v_hasil_id;
  ELSEIF v_graded_count < v_total_essays THEN
    UPDATE hasil SET manual_grade_status = 'partial' WHERE id = v_hasil_id;
  ELSE
    -- All essays graded, calculate final score
    CALL sp_calculate_final_score(v_hasil_id);
  END IF;
END$$

DELIMITER ;

-- =====================================================
-- Migration Complete
-- =====================================================

SELECT 'Essay grading system migration completed successfully!' as status;
