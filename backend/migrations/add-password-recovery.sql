-- Create password_resets table
CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create audit_logs table for tracking activities
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
);

-- Add refresh_token column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login DATETIME;

-- Add columns for enhanced grading
ALTER TABLE soal ADD COLUMN IF NOT EXISTS bobot INT DEFAULT 1;
ALTER TABLE soal ADD COLUMN IF NOT EXISTS tipe_soal ENUM('pilihan_ganda', 'essay', 'benar_salah', 'multiple_answer') DEFAULT 'pilihan_ganda';
ALTER TABLE soal ADD COLUMN IF NOT EXISTS jawaban_essay TEXT;
ALTER TABLE soal ADD COLUMN IF NOT EXISTS jawaban_benar_salah ENUM('benar', 'salah');
ALTER TABLE soal ADD COLUMN IF NOT EXISTS jawaban_multiple TEXT;

-- Add passing grade to ujian
ALTER TABLE ujian ADD COLUMN IF NOT EXISTS passing_grade DECIMAL(5,2) DEFAULT 70.00;
ALTER TABLE ujian ADD COLUMN IF NOT EXISTS show_results BOOLEAN DEFAULT TRUE;
ALTER TABLE ujian ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT FALSE;
ALTER TABLE ujian ADD COLUMN IF NOT EXISTS shuffle_options BOOLEAN DEFAULT FALSE;

-- Add grade classification to hasil
ALTER TABLE hasil ADD COLUMN IF NOT EXISTS grade VARCHAR(2);
ALTER TABLE hasil ADD COLUMN IF NOT EXISTS passed BOOLEAN;
ALTER TABLE hasil ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE hasil ADD COLUMN IF NOT EXISTS tab_switches INT DEFAULT 0;
ALTER TABLE hasil ADD COLUMN IF NOT EXISTS fullscreen_exits INT DEFAULT 0;

-- Create exam_sessions table for real-time monitoring
CREATE TABLE IF NOT EXISTS exam_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  ujian_id INT NOT NULL,
  started_at DATETIME NOT NULL,
  last_activity DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (ujian_id) REFERENCES ujian(id) ON DELETE CASCADE,
  INDEX idx_active (is_active),
  INDEX idx_ujian (ujian_id)
);
