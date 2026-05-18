/**
 * Form Validation Utilities
 * 
 * Provides client-side validation for all forms in the application
 */

// Email validation
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !email.trim()) {
    return { valid: false, message: 'Email wajib diisi' };
  }
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Format email tidak valid' };
  }
  return { valid: true, message: '' };
}

// Password validation
export function validatePassword(password) {
  if (!password || !password.trim()) {
    return { valid: false, message: 'Password wajib diisi' };
  }
  if (password.length < 6) {
    return { valid: false, message: 'Password minimal 6 karakter' };
  }
  if (password.length > 100) {
    return { valid: false, message: 'Password maksimal 100 karakter' };
  }
  return { valid: true, message: '' };
}

// Name validation
export function validateName(name) {
  if (!name || !name.trim()) {
    return { valid: false, message: 'Nama wajib diisi' };
  }
  if (name.length < 2) {
    return { valid: false, message: 'Nama minimal 2 karakter' };
  }
  if (name.length > 100) {
    return { valid: false, message: 'Nama maksimal 100 karakter' };
  }
  if (!/^[a-zA-Z0-9\s\-_.,']+$/.test(name)) {
    return { valid: false, message: 'Nama mengandung karakter tidak valid' };
  }
  return { valid: true, message: '' };
}

// Required field validation
export function validateRequired(value, fieldName = 'Field') {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return { valid: false, message: `${fieldName} wajib diisi` };
  }
  return { valid: true, message: '' };
}

// Number range validation
export function validateRange(value, min, max, fieldName = 'Nilai') {
  const num = Number(value);
  if (isNaN(num)) {
    return { valid: false, message: `${fieldName} harus berupa angka` };
  }
  if (num < min || num > max) {
    return { valid: false, message: `${fieldName} harus antara ${min} - ${max}` };
  }
  return { valid: true, message: '' };
}

// String length validation
export function validateLength(value, min, max, fieldName = 'Text') {
  if (!value || !value.trim()) {
    return { valid: false, message: `${fieldName} wajib diisi` };
  }
  if (value.length < min) {
    return { valid: false, message: `${fieldName} minimal ${min} karakter` };
  }
  if (value.length > max) {
    return { valid: false, message: `${fieldName} maksimal ${max} karakter` };
  }
  return { valid: true, message: '' };
}

// NISN validation
export function validateNisn(nisn) {
  if (!nisn || !nisn.trim()) {
    return { valid: false, message: 'NISN wajib diisi' };
  }
  return { valid: true, message: '' };
}

// Login form validation (accepts NISN or email)
export function validateLoginForm({ email, password }) {
  const errors = {};
  
  if (!email || !email.trim()) {
    errors.email = 'NISN/Email wajib diisi';
  }
  
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    errors.password = passwordValidation.message;
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

// Register form validation
export function validateRegisterForm({ nama, email, password, confirmPassword, role, kelas_id }) {
  const errors = {};
  
  const nameValidation = validateName(nama);
  if (!nameValidation.valid) {
    errors.nama = nameValidation.message;
  }
  
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    errors.email = emailValidation.message;
  }
  
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    errors.password = passwordValidation.message;
  }
  
  if (password !== confirmPassword) {
    errors.confirmPassword = 'Password tidak cocok';
  }
  
  const roleValidation = validateRequired(role, 'Role');
  if (!roleValidation.valid) {
    errors.role = roleValidation.message;
  }
  
  if (role === 'siswa' && !kelas_id) {
    errors.kelas_id = 'Kelas wajib dipilih untuk siswa';
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

// Exam form validation
export function validateExamForm({ judul, durasi, passing_grade }) {
  const errors = {};
  
  const titleValidation = validateLength(judul, 5, 200, 'Judul ujian');
  if (!titleValidation.valid) {
    errors.judul = titleValidation.message;
  }
  
  const durationValidation = validateRange(durasi, 1, 480, 'Durasi (menit)');
  if (!durationValidation.valid) {
    errors.durasi = durationValidation.message;
  }
  
  const passingGradeValidation = validateRange(passing_grade, 0, 100, 'Passing grade');
  if (!passingGradeValidation.valid) {
    errors.passing_grade = passingGradeValidation.message;
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

// Question form validation
export function validateQuestionForm({ teks_soal, tipe_soal, pilihan_a, pilihan_b, pilihan_c, kunci_jawaban }) {
  const errors = {};
  
  const soalValidation = validateLength(teks_soal, 10, 5000, 'Teks soal');
  if (!soalValidation.valid) {
    errors.teks_soal = soalValidation.message;
  }
  
  const tipeValidation = validateRequired(tipe_soal, 'Tipe soal');
  if (!tipeValidation.valid) {
    errors.tipe_soal = tipeValidation.message;
  }
  
  // For multiple choice, validate options
  if (tipe_soal === 'pilihan_ganda') {
    if (!pilihan_a || !pilihan_a.trim()) errors.pilihan_a = 'Pilihan A wajib diisi';
    if (!pilihan_b || !pilihan_b.trim()) errors.pilihan_b = 'Pilihan B wajib diisi';
    if (!pilihan_c || !pilihan_c.trim()) errors.pilihan_c = 'Pilihan C wajib diisi';
    
    if (!kunci_jawaban || !['A', 'B', 'C', 'D', 'E'].includes(kunci_jawaban.toUpperCase())) {
      errors.kunci_jawaban = 'Kunci jawaban harus A, B, C, D, atau E';
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

// Class form validation
export function validateClassForm({ nama_kelas, deskripsi }) {
  const errors = {};
  
  const nameValidation = validateLength(nama_kelas, 2, 100, 'Nama kelas');
  if (!nameValidation.valid) {
    errors.nama_kelas = nameValidation.message;
  }
  
  if (deskripsi && deskripsi.length > 500) {
    errors.deskripsi = 'Deskripsi maksimal 500 karakter';
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

// Reset request form validation
export function validateResetRequestForm({ alasan }) {
  const errors = {};
  
  const alasanValidation = validateLength(alasan, 20, 1000, 'Alasan');
  if (!alasanValidation.valid) {
    errors.alasan = alasanValidation.message;
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}
