export type UserRole = 'admin' | 'guru' | 'siswa';

export interface User {
  id: number;
  nama: string;
  email: string;
  nisn?: string | null;
  no_peserta?: string | null;
  role: UserRole;
  kelas_id?: number | null;
  nama_kelas?: string | null;
  profile_picture?: string | null;
  last_login?: string;
  created_at?: string;
}

export interface Kelas {
  id: number;
  nama_kelas: string;
  deskripsi?: string;
  created_at?: string;
}

export interface Soal {
  id: number;
  paket_soal_id: number;
  pertanyaan: string;
  pilihan_a: string;
  pilihan_b: string;
  pilihan_c: string;
  pilihan_d: string;
  pilihan_e?: string | null;
  kunci_jawaban: string;
  gambar?: string | null;
  tipe: 'pilihan_ganda' | 'essay';
  bobot: number;
}

export interface PaketSoal {
  id: number;
  nama_paket: string;
  deskripsi?: string;
  guru_id: number;
  created_at?: string;
}

export interface Ujian {
  id: number;
  nama_ujian: string;
  paket_soal_id: number;
  kelas_id?: number | null;
  waktu_mulai: string;
  waktu_selesai: string;
  durasi: number;
  is_active: boolean;
  token?: string | null;
  created_at?: string;
}

export interface HasilUjian {
  id: number;
  ujian_id: number;
  user_id: number;
  nilai: number;
  jawaban_benar: number;
  jawaban_salah: number;
  total_soal: number;
  waktu_selesai: string;
  status: 'selesai' | 'proses' | 'dikoreksi';
}
