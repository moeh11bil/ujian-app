const db = require('../../config/database');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../errors/AppError');
const logger = require('../utils/logger');

class UserService {
  async getAll(page = 1, limit = 50, search = '', kelasId = null) {
    const offset = (page - 1) * limit;
    let query = `
      SELECT u.id, u.nama, u.email, u.nisn, u.no_peserta, u.role, u.created_at, u.kelas_id, k.nama_kelas
      FROM users u
      LEFT JOIN kelas k ON u.kelas_id = k.id
      WHERE u.role = 'siswa'
    `;
    const countQuery = [`SELECT COUNT(*) as total FROM users WHERE role = 'siswa'`];
    const params = [];

    if (search) {
      const searchPattern = `%${search}%`;
      query += ` AND (u.nama LIKE ? OR u.nisn LIKE ? OR u.no_peserta LIKE ?)`;
      countQuery.push(` AND (nama LIKE ? OR nisn LIKE ? OR no_peserta LIKE ?)`);
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (kelasId) {
      query += ` AND u.kelas_id = ?`;
      countQuery.push(` AND kelas_id = ?`);
      params.push(kelasId);
    }

    query += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
    const countParams = [...params];
    params.push(parseInt(limit), parseInt(offset));

    const users = await db.query(query, params);
    const [countResult] = await db.query(countQuery.join(''), countParams);
    
    logger.info({ count: users.length }, 'Fetched students with filter');
    return { data: users, pagination: { page, limit, total: countResult.total, totalPages: Math.ceil(countResult.total / limit) } };
  }

  async getAllByRoles(roles, page = 1, limit = 50, search = '') {
    const offset = (page - 1) * limit;
    const roleList = Array.isArray(roles) ? roles : roles.split(',');
    const placeholders = roleList.map(() => '?').join(',');
    let query = `
      SELECT u.id, u.nama, u.email, u.role, u.created_at
      FROM users u
      WHERE u.role IN (${placeholders})
    `;
    const countQuery = [`SELECT COUNT(*) as total FROM users WHERE role IN (${placeholders})`];
    const params = [...roleList];

    if (search) {
      const searchPattern = `%${search}%`;
      query += ` AND (u.nama LIKE ? OR u.email LIKE ?)`;
      countQuery.push(` AND (nama LIKE ? OR email LIKE ?)`);
      params.push(searchPattern, searchPattern);
    }

    query += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
    const countParams = [...params];
    params.push(parseInt(limit), parseInt(offset));

    const users = await db.query(query, params);
    const [countResult] = await db.query(countQuery.join(''), countParams);

    return { data: users, pagination: { page, limit, total: countResult.total, totalPages: Math.ceil(countResult.total / limit) } };
  }

  async getAllStudents() {
    const students = await db.query(`
      SELECT u.id, u.nama, u.email, u.nisn, u.no_peserta, u.role, u.created_at, u.kelas_id, k.nama_kelas
      FROM users u
      LEFT JOIN kelas k ON u.kelas_id = k.id
      WHERE u.role = 'siswa'
      ORDER BY u.nama ASC
    `);
    logger.info({ count: students.length }, 'Fetched all students');
    return students;
  }

  async getById(id) {
    const users = await db.query(`
      SELECT u.id, u.nama, u.email, u.nisn, u.no_peserta, u.role, u.created_at, u.kelas_id, k.nama_kelas
      FROM users u
      LEFT JOIN kelas k ON u.kelas_id = k.id
      WHERE u.id = ?
    `, [id]);

    if (!Array.isArray(users) || users.length === 0) {
      throw new NotFoundError('User not found');
    }

    return users[0];
  }

  async create(data) {
    logger.info({ data }, 'Creating user');
    const { nama, email, password, role, kelas_id, nisn, no_peserta } = data;

    const validRoles = ['admin', 'guru', 'siswa'];
    if (role && !validRoles.includes(role)) {
      throw new BadRequestError('Invalid role');
    }

    // Auto-generate email for students from NISN if not provided
    let userEmail = email;
    if ((role || 'siswa') === 'siswa' && (!userEmail || userEmail.trim() === '')) {
      if (!nisn) {
        throw new BadRequestError('NISN is required for students');
      }
      userEmail = `${nisn}@student.sch.id`;
    }

    if (!userEmail || userEmail.trim() === '') {
      throw new BadRequestError('Email is required');
    }

    if (kelas_id !== undefined && kelas_id !== null && kelas_id !== '' && kelas_id !== '0') {
      const existingClass = await db.query('SELECT id FROM kelas WHERE id = ?', [kelas_id]);
      if (!Array.isArray(existingClass) || existingClass.length === 0) {
        throw new BadRequestError('Class does not exist');
      }
    }

    const existingUser = await db.query('SELECT id FROM users WHERE email = ?', [userEmail]);
    if (existingUser.length > 0) {
      throw new BadRequestError('Email already exists');
    }

    // Check if NISN already exists
    if (nisn) {
      const existingNisn = await db.query('SELECT id FROM users WHERE nisn = ?', [nisn]);
      if (existingNisn.length > 0) {
        throw new BadRequestError('NISN already exists');
      }
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const classIdForDb = (kelas_id === null || kelas_id === '' || kelas_id === '0') ? null : kelas_id;

    const result = await db.query(
      'INSERT INTO users (nama, email, nisn, no_peserta, password, role, kelas_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nama, userEmail, nisn || null, no_peserta || null, hashedPassword, role || 'siswa', classIdForDb]
    );

    logger.info({ userId: result.insertId }, 'User created');
    return { userId: result.insertId, message: 'User created successfully' };
  }

  async update(id, data) {
    logger.info({ id, data }, 'Updating user');
    const { nama, email, role, kelas_id, nisn, no_peserta } = data;

    const validRoles = ['admin', 'guru', 'siswa'];
    if (role && !validRoles.includes(role)) {
      throw new BadRequestError('Invalid role');
    }

    // Auto-generate email from NISN if email is empty and role is siswa
    let userEmail = email;
    if ((role || 'siswa') === 'siswa' && (!userEmail || userEmail.trim() === '')) {
      if (nisn) {
        userEmail = `${nisn}@student.sch.id`;
      }
    }

    // Check NISN uniqueness if changed
    if (nisn) {
      const existingNisn = await db.query('SELECT id FROM users WHERE nisn = ? AND id != ?', [nisn, id]);
      if (existingNisn.length > 0) {
        throw new BadRequestError('NISN already exists');
      }
    }

    if (kelas_id !== undefined) {
      if (kelas_id !== null && kelas_id !== 0 && kelas_id !== '' && kelas_id !== '0') {
        const existingClass = await db.query('SELECT id FROM kelas WHERE id = ?', [kelas_id]);
        if (!Array.isArray(existingClass) || existingClass.length === 0) {
          throw new BadRequestError('Class does not exist');
        }
      }

      const classIdForDb = (kelas_id === null || kelas_id === 0 || kelas_id === '' || kelas_id === '0') ? null : kelas_id;
      await db.query('UPDATE users SET nama = ?, email = ?, nisn = ?, no_peserta = ?, role = ?, kelas_id = ? WHERE id = ?', [nama, userEmail, nisn || null, no_peserta || null, role, classIdForDb, id]);
    } else {
      await db.query('UPDATE users SET nama = ?, email = ?, nisn = ?, no_peserta = ?, role = ? WHERE id = ?', [nama, userEmail, nisn || null, no_peserta || null, role, id]);
    }

    logger.info({ userId: id }, 'User updated');
    return { message: 'User updated successfully' };
  }

  async #deleteRelatedData(id) {
    const tables = [
      'hasil', 'reset_requests', 'exam_violations', 'user_paket_assignments',
      'exam_sessions', 'essay_grading'
    ];
    for (const table of tables) {
      try {
        await db.query(`DELETE FROM ${table} WHERE user_id = ?`, [id]);
      } catch (e) {
        // some tables may not exist, skip
      }
    }
    // tables using SET NULL or different column names
    try { await db.query(`UPDATE essay_grading SET graded_by = NULL WHERE graded_by = ?`, [id]); } catch (e) {}
    try { await db.query(`UPDATE audit_logs SET user_id = NULL WHERE user_id = ?`, [id]); } catch (e) {}

  }

  async delete(id) {
    await this.#deleteRelatedData(id);
    const result = await db.query('DELETE FROM users WHERE id = ?', [id]);
    logger.info({ userId: id, affectedRows: result.affectedRows }, 'User deleted');
    return { message: 'User deleted successfully', affectedRows: result.affectedRows };
  }

  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestError('No user IDs provided');
    }
    for (const id of ids) {
      await this.#deleteRelatedData(id);
    }
    const placeholders = ids.map(() => '?').join(',');
    const result = await db.query(`DELETE FROM users WHERE id IN (${placeholders})`, ids);
    logger.info({ userIds: ids, affectedRows: result.affectedRows }, 'Bulk users deleted');
    return { message: `${result.affectedRows} siswa berhasil dihapus`, affectedRows: result.affectedRows };
  }
}

module.exports = new UserService();