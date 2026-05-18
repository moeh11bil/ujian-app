-- Add NISN and NO_PESERTA columns for student identification
-- NISN: Nomor Induk Siswa Nasional (used as login username for students)
-- NO_PESERTA: Nomor Peserta Ujian

ALTER TABLE users
ADD COLUMN IF NOT EXISTS nisn VARCHAR(20) NULL
AFTER email;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS no_peserta VARCHAR(30) NULL
AFTER nisn;

-- Make email nullable (students can login with NISN instead)
ALTER TABLE users
MODIFY COLUMN email VARCHAR(100) NULL;

-- Add unique index on nisn for login lookup
ALTER TABLE users
ADD UNIQUE INDEX IF NOT EXISTS idx_users_nisn_unique (nisn);

CREATE INDEX IF NOT EXISTS idx_users_no_peserta
ON users(no_peserta);

-- Auto-generate emails for existing students who have NISN but no email
UPDATE users
SET email = CONCAT(nisn, '@student.sch.id')
WHERE role = 'siswa' AND email IS NULL AND nisn IS NOT NULL;
