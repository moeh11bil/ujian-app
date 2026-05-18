const db = require('../../config/database');
const { BadRequestError, NotFoundError, ConflictError } = require('../errors/AppError');
const logger = require('../utils/logger');

class ClassService {
  async getAll(page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const kelas = await db.query(`
      SELECT k.id, k.nama_kelas, k.deskripsi, k.created_at, k.updated_at,
             COUNT(u.id) as jumlah_siswa
      FROM kelas k
      LEFT JOIN users u ON k.id = u.kelas_id AND u.role = 'siswa'
      GROUP BY k.id, k.nama_kelas, k.deskripsi, k.created_at, k.updated_at
      ORDER BY k.nama_kelas
      LIMIT ? OFFSET ?
    `, [parseInt(limit), parseInt(offset)]);
    
    const [countResult] = await db.query('SELECT COUNT(*) as total FROM kelas');
    
    logger.info({ count: kelas.length }, 'Fetched all classes');
    return { data: kelas, pagination: { page, limit, total: countResult.total, totalPages: Math.ceil(countResult.total / limit) } };
  }

  async getById(id) {
    const kelasResult = await db.query('SELECT id, nama_kelas, deskripsi, created_at, updated_at FROM kelas WHERE id = ?', [id]);

    if (!Array.isArray(kelasResult) || kelasResult.length === 0) {
      throw new NotFoundError('Class not found');
    }

    const kelas = kelasResult[0];
    const students = await db.query(`
      SELECT u.id, u.nama, u.email, u.created_at
      FROM users u
      WHERE u.kelas_id = ? AND u.role = 'siswa'
      ORDER BY u.nama
    `, [id]);

    return { ...kelas, students };
  }

  async create(data) {
    const { nama_kelas, deskripsi } = data;

    if (!nama_kelas) {
      throw new BadRequestError('Nama kelas is required');
    }

    const existingClass = await db.query('SELECT id FROM kelas WHERE nama_kelas = ?', [nama_kelas]);
    if (existingClass.length > 0) {
      throw new ConflictError('Class with this name already exists');
    }

    await db.query('INSERT INTO kelas (nama_kelas, deskripsi) VALUES (?, ?)', [nama_kelas, deskripsi]);
    logger.info({ nama_kelas }, 'Class created');
    return { message: 'Class created successfully' };
  }

  async update(id, data) {
    const { nama_kelas, deskripsi } = data;

    if (!nama_kelas) {
      throw new BadRequestError('Nama kelas is required');
    }

    const existingClass = await db.query('SELECT id FROM kelas WHERE nama_kelas = ? AND id != ?', [nama_kelas, id]);
    if (existingClass.length > 0) {
      throw new ConflictError('Class with this name already exists');
    }

    await db.query('UPDATE kelas SET nama_kelas = ?, deskripsi = ? WHERE id = ?', [nama_kelas, deskripsi, id]);
    logger.info({ classId: id }, 'Class updated');
    return { message: 'Class updated successfully' };
  }

  async delete(id) {
    await db.query('UPDATE users SET kelas_id = NULL WHERE kelas_id = ?', [id]);
    await db.query('DELETE FROM kelas WHERE id = ?', [id]);
    logger.info({ classId: id }, 'Class deleted');
    return { message: 'Class deleted successfully' };
  }
}

module.exports = new ClassService();