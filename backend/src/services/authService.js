const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../config/database');
const { BadRequestError, UnauthorizedError, NotFoundError } = require('../errors/AppError');
const logger = require('../utils/logger');

class AuthService {
  async register(data) {
    const { nama, email, password, role, kelas_id, nisn, no_peserta } = data;

    const validRoles = ['admin', 'guru', 'siswa'];
    if (!validRoles.includes(role)) {
      throw new BadRequestError('Invalid role');
    }

    // Auto-generate email for students from NISN if not provided
    let userEmail = email;
    if (role === 'siswa' && (!userEmail || userEmail.trim() === '')) {
      if (!nisn) {
        throw new BadRequestError('NISN is required for students');
      }
      userEmail = `${nisn}@student.sch.id`;
    }

    if (!userEmail || userEmail.trim() === '') {
      throw new BadRequestError('Email is required');
    }

    if (kelas_id !== undefined && kelas_id !== null) {
      const kelasExists = await db.query('SELECT id FROM kelas WHERE id = ?', [kelas_id]);
      if (!Array.isArray(kelasExists) || kelasExists.length === 0) {
        throw new BadRequestError('Invalid kelas_id');
      }
    }

    // Check if NISN already exists (for students)
    if (nisn) {
      const existingNisn = await db.query('SELECT id FROM users WHERE nisn = ?', [nisn]);
      if (existingNisn.length > 0) {
        throw new BadRequestError('NISN already exists');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.query(
      'INSERT INTO users (nama, email, nisn, no_peserta, password, role, kelas_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nama, userEmail, nisn || null, no_peserta || null, hashedPassword, role, kelas_id || null]
    );

    logger.info({ userId: result.insertId, email: userEmail, role }, 'User registered');

    return { userId: result.insertId, message: 'User registered successfully' };
  }

  async login(data) {
    const { email, password } = data;
    const identifier = email; // field name is 'email' but can be NISN or email

    let users;
    // If contains '@', search by email, otherwise search by NISN
    if (identifier && identifier.includes('@')) {
      users = await db.query(
        'SELECT u.*, k.nama_kelas FROM users u LEFT JOIN kelas k ON u.kelas_id = k.id WHERE u.email = ?',
        [identifier]
      );
    } else {
      users = await db.query(
        'SELECT u.*, k.nama_kelas FROM users u LEFT JOIN kelas k ON u.kelas_id = k.id WHERE u.nisn = ?',
        [identifier]
      );
    }

    if (!users.length) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const user = users[0];

    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user.password);
    } catch (e) {
      isMatch = false;
    }

    if (!isMatch && user.exam_password_hash) {
      try {
        isMatch = await bcrypt.compare(password, user.exam_password_hash);
      } catch (e) {
        isMatch = false;
      }
    }

    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const token = jwt.sign(
      { id: user.id, nama: user.nama, email: user.email, role: user.role, kelas_id: user.kelas_id },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh',
      { expiresIn: '7d' }
    );

    await db.query('UPDATE users SET refresh_token = ?, last_login = NOW() WHERE id = ?', [refreshToken, user.id]);

    logger.info({ userId: user.id }, 'User logged in');

    return {
      token,
      refreshToken,
      user: { id: user.id, nama: user.nama, email: user.email, role: user.role, kelas_id: user.kelas_id }
    };
  }

  async refreshToken(data) {
    const { refreshToken } = data;

    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token required');
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh');

    const users = await db.query(
      'SELECT u.*, k.nama_kelas FROM users u LEFT JOIN kelas k ON u.kelas_id = k.id WHERE u.id = ? AND u.refresh_token = ?',
      [decoded.id, refreshToken]
    );

    if (!users.length) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = users[0];

    const newToken = jwt.sign(
      { id: user.id, nama: user.nama, email: user.email, role: user.role, kelas_id: user.kelas_id },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return { token: newToken };
  }

  async logout(userId) {
    await db.query('UPDATE users SET refresh_token = NULL WHERE id = ?', [userId]);
    logger.info({ userId }, 'User logged out');
    return { message: 'Logout successful' };
  }
}

module.exports = new AuthService();