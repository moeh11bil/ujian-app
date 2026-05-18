-- Fix soal table columns to allow NULL for non-multiple-choice fields
ALTER TABLE soal 
  MODIFY COLUMN pilihan_a TEXT,
  MODIFY COLUMN pilihan_b TEXT,
  MODIFY COLUMN pilihan_c TEXT,
  MODIFY COLUMN pilihan_d TEXT,
  MODIFY COLUMN pilihan_e TEXT,
  MODIFY COLUMN kunci_jawaban CHAR(1);
