-- Database Schema for Online Exam Application

-- Classes table
CREATE TABLE IF NOT EXISTS kelas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama_kelas VARCHAR(100) NOT NULL UNIQUE,
  deskripsi TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NULL,
  nisn VARCHAR(20) UNIQUE NULL,
  no_peserta VARCHAR(30) NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'guru', 'siswa') DEFAULT 'siswa',
  kelas_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE SET NULL
);

-- Ujian table
CREATE TABLE IF NOT EXISTS ujian (
  id INT AUTO_INCREMENT PRIMARY KEY,
  judul VARCHAR(255) NOT NULL,
  durasi INT NOT NULL COMMENT 'Durasi dalam menit',
  waktu_mulai DATETIME,
  waktu_selesai DATETIME,
  status ENUM('aktif', 'nonaktif') DEFAULT 'nonaktif',
  kelas_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE SET NULL
);

-- Soal table
CREATE TABLE IF NOT EXISTS soal (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ujian_id INT,
  kelas_id INT,
  teks_soal TEXT NOT NULL,
  pilihan_a TEXT NOT NULL,
  pilihan_b TEXT NOT NULL,
  pilihan_c TEXT NOT NULL,
  pilihan_d TEXT NOT NULL,
  pilihan_e TEXT,
  kunci_jawaban CHAR(1) NOT NULL COMMENT 'A, B, C, D, atau E',
  nomor_urut INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (ujian_id) REFERENCES ujian(id) ON DELETE CASCADE,
  FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE SET NULL
);

-- Hasil table
CREATE TABLE IF NOT EXISTS hasil (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  ujian_id INT NOT NULL,
  skor DECIMAL(5,2),
  jawaban_siswa JSON,
  jumlah_benar INT,
  jumlah_soal INT,
  waktu_mulai TIMESTAMP,
  waktu_selesai TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (ujian_id) REFERENCES ujian(id) ON DELETE CASCADE
);

-- Reset requests table
CREATE TABLE IF NOT EXISTS reset_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  ujian_id INT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (ujian_id) REFERENCES ujian(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_exam_request (user_id, ujian_id, status)
);

-- Insert default admin user (password: admin123)
INSERT IGNORE INTO users (nama, email, password, role) VALUES
('Admin Utama', 'admin@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');