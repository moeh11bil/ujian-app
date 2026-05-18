-- Create soal_paket table for managing question packages
CREATE TABLE IF NOT EXISTS soal_paket (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ujian_id INT NOT NULL,
  nama_paket VARCHAR(100) NOT NULL COMMENT 'Nama paket, e.g., Paket A, Paket B',
  kode_paket VARCHAR(10) NOT NULL COMMENT 'Kode unik paket, e.g., A, B, C',
  deskripsi TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (ujian_id) REFERENCES ujian(id) ON DELETE CASCADE,
  UNIQUE KEY unique_ujian_kode_paket (ujian_id, kode_paket),
  INDEX idx_ujian (ujian_id),
  INDEX idx_active (is_active)
);

-- Create paket_soal_mapping table to map questions to packages with randomized order
CREATE TABLE IF NOT EXISTS paket_soal_mapping (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paket_id INT NOT NULL,
  soal_id INT NOT NULL,
  nomor_urut_paket INT NOT NULL COMMENT 'Nomor urut soal dalam paket',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (paket_id) REFERENCES soal_paket(id) ON DELETE CASCADE,
  FOREIGN KEY (soal_id) REFERENCES soal(id) ON DELETE CASCADE,
  UNIQUE KEY unique_paket_soal (paket_id, soal_id),
  INDEX idx_paket (paket_id),
  INDEX idx_soal (soal_id)
);

-- Create user_paket_assignments table to assign packages to students
CREATE TABLE IF NOT EXISTS user_paket_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  ujian_id INT NOT NULL,
  paket_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (ujian_id) REFERENCES ujian(id) ON DELETE CASCADE,
  FOREIGN KEY (paket_id) REFERENCES soal_paket(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_ujian (user_id, ujian_id),
  INDEX idx_user (user_id),
  INDEX idx_ujian (ujian_id),
  INDEX idx_paket (paket_id)
);

-- Add kolom paket_id ke tabel hasil untuk tracking paket yang digunakan
ALTER TABLE hasil ADD COLUMN IF NOT EXISTS paket_id INT;
ALTER TABLE hasil ADD CONSTRAINT fk_hasil_paket FOREIGN KEY (paket_id) REFERENCES soal_paket(id) ON DELETE SET NULL;
