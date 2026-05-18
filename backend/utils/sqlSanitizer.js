/**
 * SQL Sanitization Utilities
 * 
 * Provides safe ways to handle dynamic identifiers (column names, table names)
 * that cannot be parameterized with ? placeholders
 */

// Whitelist of allowed column names for specific tables
const ALLOWED_COLUMNS = {
  soal: [
    'id', 'ujian_id', 'kelas_id', 'teks_soal', 'gambar_soal',
    'pilihan_a', 'gambar_pilihan_a', 'pilihan_b', 'gambar_pilihan_b',
    'pilihan_c', 'gambar_pilihan_c', 'pilihan_d', 'gambar_pilihan_d',
    'pilihan_e', 'gambar_pilihan_e', 'kunci_jawaban', 'bobot',
    'nomor_urut', 'tipe_soal', 'jawaban_essay', 'jawaban_benar_salah',
    'jawaban_multiple'
  ],
  ujian: [
    'id', 'judul', 'deskripsi', 'durasi', 'waktu_mulai', 'waktu_selesai',
    'status', 'kelas_id', 'passing_grade', 'show_results',
    'shuffle_questions', 'shuffle_options'
  ],
  users: [
    'id', 'nama', 'email', 'password', 'role', 'kelas_id',
    'refresh_token', 'profile_picture', 'last_login'
  ]
};

/**
 * Safely validate a column name against a whitelist
 * @param {string} column - Column name to validate
 * @param {string} table - Table name (key in ALLOWED_COLUMNS)
 * @returns {string|null} - Safe column name or null if invalid
 */
function validateColumn(column, table) {
  const allowed = ALLOWED_COLUMNS[table];
  if (!allowed || !allowed.includes(column)) {
    return null;
  }
  return column;
}

/**
 * Escape a SQL identifier (column name, table name)
 * This should ONLY be used when parameterized queries are not possible
 * 
 * @param {string} identifier - The identifier to escape
 * @returns {string} - Safely escaped identifier
 */
function escapeIdentifier(identifier) {
  // Remove any backticks, quotes, or semicolons
  const sanitized = identifier.replace(/[`'";]/g, '');
  
  // Wrap in backticks
  return `\`${sanitized}\``;
}

/**
 * Build a safe WHERE clause with multiple conditions
 * @param {Object} conditions - Object with column: value pairs
 * @param {string} table - Table name
 * @returns {{query: string, params: Array}} - Safe query and parameters
 */
function buildSafeWhereClause(conditions, table) {
  const clauses = [];
  const params = [];
  
  for (const [column, value] of Object.entries(conditions)) {
    // Validate column name
    const safeColumn = validateColumn(column, table);
    if (!safeColumn) {
      throw new Error(`Invalid column: ${column}`);
    }
    
    if (value === null) {
      clauses.push(`${safeColumn} IS NULL`);
    } else if (Array.isArray(value)) {
      const placeholders = value.map(() => '?').join(', ');
      clauses.push(`${safeColumn} IN (${placeholders})`);
      params.push(...value);
    } else {
      clauses.push(`${safeColumn} = ?`);
      params.push(value);
    }
  }
  
  return {
    query: clauses.join(' AND '),
    params
  };
}

/**
 * Build a safe SET clause for UPDATE queries
 * @param {Object} updates - Object with column: value pairs
 * @param {string} table - Table name
 * @returns {{query: string, params: Array}} - Safe query and parameters
 */
function buildSafeSetClause(updates, table) {
  const clauses = [];
  const params = [];
  
  for (const [column, value] of Object.entries(updates)) {
    // Validate column name
    const safeColumn = validateColumn(column, table);
    if (!safeColumn) {
      throw new Error(`Invalid column: ${column}`);
    }
    
    clauses.push(`${safeColumn} = ?`);
    params.push(value);
  }
  
  return {
    query: clauses.join(', '),
    params
  };
}

module.exports = {
  validateColumn,
  escapeIdentifier,
  buildSafeWhereClause,
  buildSafeSetClause,
  ALLOWED_COLUMNS
};
