-- Add exam_password column for exam card login
-- This is a separate plain text password used ONLY for exam access
-- Main password remains hashed for security

-- Add column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS exam_password VARCHAR(100) NULL 
AFTER password;

-- Update existing students with random 6-digit passwords
UPDATE users 
SET exam_password = CONCAT('EXAM', LPAD(FLOOR(RAND() * 9999), 4, '0'))
WHERE role = 'siswa' AND exam_password IS NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_exam_password 
ON users(exam_password);
