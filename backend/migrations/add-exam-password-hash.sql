-- Add exam_password_hash column for secure login comparison
-- exam_password remains as plaintext for exam card display

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS exam_password_hash VARCHAR(255) NULL 
AFTER exam_password;
