const sharp = require('sharp');
const db = require('../../config/database');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../errors/AppError');
const logger = require('../utils/logger');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/soal');

class QuestionService {
  async getByExam(ujianId, user) {
    if (user.role === 'siswa') {
      const ujianResult = await db.query('SELECT u.*, k.nama_kelas FROM ujian u LEFT JOIN kelas k ON u.kelas_id = k.id WHERE u.id = ?', [ujianId]);

      const ujian = Array.isArray(ujianResult) && ujianResult.length > 0 ? ujianResult[0] : null;
      if (!ujian) {
        throw new ForbiddenError('Cannot access exam questions');
      }

      const now = new Date();
      const startTime = new Date(ujian.waktu_mulai);
      const endTime = new Date(ujian.waktu_selesai);

      if (ujian.status !== 'aktif' || now < startTime || now > endTime) {
        throw new ForbiddenError('Cannot access exam questions');
      }

      if (ujian.kelas_id) {
        if (!user.kelas_id || ujian.kelas_id !== user.kelas_id) {
          throw new ForbiddenError('Cannot access exam - not in your class');
        }
      }
    }

    const baseFields = user.role === 'siswa' 
      ? 's.id, s.ujian_id, s.kelas_id, s.teks_soal, s.gambar_soal, s.pilihan_a, s.gambar_pilihan_a, s.pilihan_b, s.gambar_pilihan_b, s.pilihan_c, s.gambar_pilihan_c, s.pilihan_d, s.gambar_pilihan_d, s.pilihan_e, s.gambar_pilihan_e, s.nomor_urut, s.tipe_soal'
      : 's.id, s.ujian_id, s.kelas_id, s.teks_soal, s.gambar_soal, s.pilihan_a, s.gambar_pilihan_a, s.pilihan_b, s.gambar_pilihan_b, s.pilihan_c, s.gambar_pilihan_c, s.pilihan_d, s.gambar_pilihan_d, s.pilihan_e, s.gambar_pilihan_e, s.nomor_urut, s.tipe_soal, s.jawaban_essay, s.jawaban_benar_salah, s.jawaban_multiple, s.kunci_jawaban';
    
    const fields = baseFields;

    const soal = await db.query(
      `SELECT ${fields} FROM soal s LEFT JOIN kelas k ON s.kelas_id = k.id WHERE s.ujian_id = ? ORDER BY s.nomor_urut`,
      [ujianId]
    );

    return soal;
  }

  async getAll(kelasId = null, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    let query = `
      SELECT s.id, s.ujian_id, s.kelas_id, s.teks_soal, s.gambar_soal, s.pilihan_a, s.gambar_pilihan_a, s.pilihan_b, s.gambar_pilihan_b, s.pilihan_c, s.gambar_pilihan_c, s.pilihan_d, s.gambar_pilihan_d, s.pilihan_e, s.gambar_pilihan_e, s.kunci_jawaban, s.bobot, s.nomor_urut, s.tipe_soal, s.jawaban_essay, s.jawaban_benar_salah, s.jawaban_multiple, u.judul as ujian_judul, k.nama_kelas, uk.nama_kelas as ujian_nama_kelas
      FROM soal s
      LEFT JOIN ujian u ON s.ujian_id = u.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      LEFT JOIN kelas uk ON u.kelas_id = uk.id
    `;
    const params = [];
    if (kelasId) {
      query += 'WHERE s.kelas_id = ? ';
      params.push(kelasId);
    }
    query += 'ORDER BY s.kelas_id, s.ujian_id, s.nomor_urut LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const soal = await db.query(query, params);
    
    let countQuery = 'SELECT COUNT(*) as total FROM soal';
    const countParams = [];
    if (kelasId) {
      countQuery += ' WHERE kelas_id = ?';
      countParams.push(kelasId);
    }
    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult.total;
    
    logger.info({ count: soal.length, kelasId, page, limit, total }, 'Fetched questions');
    return { data: soal, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async create(data, files = {}) {
    const { ujian_id, kelas_id, teks_soal, pilihan_a, pilihan_b, pilihan_c, pilihan_d, pilihan_e, kunci_jawaban, nomor_urut, bobot, tipe_soal, jawaban_essay, jawaban_benar_salah, jawaban_multiple } = data;

    const questionType = tipe_soal || 'pilihan_ganda';

    if (questionType === 'pilihan_ganda') {
      const validAnswers = ['A', 'B', 'C', 'D', 'E'];
      if (!kunci_jawaban || !validAnswers.includes(kunci_jawaban.toUpperCase())) {
        throw new BadRequestError('Invalid answer key. Must be A, B, C, D, or E.');
      }
      if (!pilihan_a || !pilihan_b || !pilihan_c || !pilihan_d) {
        throw new BadRequestError('Pilihan A, B, C, dan D wajib diisi untuk pilihan ganda');
      }
    } else if (questionType === 'essay') {
      if (!jawaban_essay) {
        throw new BadRequestError('Jawaban contoh wajib diisi untuk soal essay');
      }
    } else if (questionType === 'benar_salah') {
      const validTF = ['benar', 'salah'];
      if (!jawaban_benar_salah || !validTF.includes(jawaban_benar_salah.toLowerCase())) {
        throw new BadRequestError('Jawaban harus "benar" atau "salah" untuk soal benar/salah');
      }
      data.pilihan_a = 'Benar';
      data.pilihan_b = 'Salah';
    } else if (questionType === 'multiple_answer') {
      if (!jawaban_multiple) {
        throw new BadRequestError('Jawaban wajib diisi untuk soal multiple answer');
      }
      const answers = jawaban_multiple.split(',').map(a => a.trim().toUpperCase());
      const validAnswers = ['A', 'B', 'C', 'D', 'E'];
      const allValid = answers.every(a => validAnswers.includes(a));
      if (!allValid || answers.length === 0) {
        throw new BadRequestError('Jawaban harus kombinasi dari A, B, C, D, E (contoh: A,B,D)');
      }
      if (!pilihan_a || !pilihan_b || !pilihan_c || !pilihan_d) {
        throw new BadRequestError('Pilihan A, B, C, dan D wajib diisi untuk multiple answer');
      }
    }

    if (ujian_id) {
      const examExists = await db.query('SELECT id FROM ujian WHERE id = ?', [ujian_id]);
      if (!examExists.length) {
        throw new BadRequestError('Referenced exam does not exist');
      }
    }

    if (kelas_id) {
      const [kelasExists] = await db.query('SELECT id FROM kelas WHERE id = ?', [kelas_id]);
      if (!kelasExists || kelasExists.length === 0) {
        throw new BadRequestError('Invalid kelas_id');
      }
    }

    const gambar_soal = files.gambar_soal ? files.gambar_soal[0].filename : null;
    const gambar_pilihan_a = files.gambar_pilihan_a ? files.gambar_pilihan_a[0].filename : null;
    const gambar_pilihan_b = files.gambar_pilihan_b ? files.gambar_pilihan_b[0].filename : null;
    const gambar_pilihan_c = files.gambar_pilihan_c ? files.gambar_pilihan_c[0].filename : null;
    const gambar_pilihan_d = files.gambar_pilihan_d ? files.gambar_pilihan_d[0].filename : null;
    const gambar_pilihan_e = files.gambar_pilihan_e ? files.gambar_pilihan_e[0].filename : null;

    const result = await db.query(
      'INSERT INTO soal (ujian_id, kelas_id, teks_soal, gambar_soal, pilihan_a, gambar_pilihan_a, pilihan_b, gambar_pilihan_b, pilihan_c, gambar_pilihan_c, pilihan_d, gambar_pilihan_d, pilihan_e, gambar_pilihan_e, kunci_jawaban, nomor_urut, bobot, tipe_soal, jawaban_essay, jawaban_benar_salah, jawaban_multiple) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [ujian_id || null, kelas_id || null, teks_soal, gambar_soal, pilihan_a || null, gambar_pilihan_a, pilihan_b || null, gambar_pilihan_b, pilihan_c || null, gambar_pilihan_c, pilihan_d || null, gambar_pilihan_d, pilihan_e || null, gambar_pilihan_e, kunci_jawaban ? kunci_jawaban.toUpperCase() : null, nomor_urut || 0, bobot || 1, questionType, jawaban_essay || null, jawaban_benar_salah || null, jawaban_multiple || null]
    );

    logger.info({ soalId: result.insertId }, 'Question created');
    return { message: 'Soal created successfully', soalId: result.insertId };
  }

  async update(id, data, files = {}) {
    const { ujian_id, kelas_id, teks_soal, pilihan_a, pilihan_b, pilihan_c, pilihan_d, pilihan_e, kunci_jawaban, nomor_urut, bobot, tipe_soal, jawaban_essay, jawaban_benar_salah, jawaban_multiple } = data;

    const validAnswers = ['A', 'B', 'C', 'D', 'E'];
    if (kunci_jawaban && !validAnswers.includes(kunci_jawaban.toUpperCase())) {
      throw new BadRequestError('Invalid answer key. Must be A, B, C, D, or E.');
    }

    if (kelas_id !== undefined && kelas_id !== null && kelas_id !== '') {
      const [kelasExists] = await db.query('SELECT id FROM kelas WHERE id = ?', [kelas_id]);
      if (!kelasExists || kelasExists.length === 0) {
        throw new BadRequestError('Invalid kelas_id');
      }
    }

    if (ujian_id !== undefined && ujian_id !== null && ujian_id !== '') {
      const [ujianExists] = await db.query('SELECT id FROM ujian WHERE id = ?', [ujian_id]);
      if (!ujianExists || ujianExists.length === 0) {
        throw new BadRequestError('Invalid ujian_id');
      }
    }

    const currentData = await db.query('SELECT gambar_soal, gambar_pilihan_a, gambar_pilihan_b, gambar_pilihan_c, gambar_pilihan_d, gambar_pilihan_e FROM soal WHERE id = ?', [id]);
    const currentImages = currentData && currentData.length > 0 ? currentData[0] : {};

    const gambar_soal = await this.handleImage('gambar_soal', currentImages.gambar_soal, files, data);
    const gambar_pilihan_a = await this.handleImage('gambar_pilihan_a', currentImages.gambar_pilihan_a, files, data);
    const gambar_pilihan_b = await this.handleImage('gambar_pilihan_b', currentImages.gambar_pilihan_b, files, data);
    const gambar_pilihan_c = await this.handleImage('gambar_pilihan_c', currentImages.gambar_pilihan_c, files, data);
    const gambar_pilihan_d = await this.handleImage('gambar_pilihan_d', currentImages.gambar_pilihan_d, files, data);
    const gambar_pilihan_e = await this.handleImage('gambar_pilihan_e', currentImages.gambar_pilihan_e, files, data);

    const updates = [];
    const params = [];

    const addUpdate = (field, value) => {
      if (value !== undefined) {
        updates.push(`${field} = ?`);
        params.push(value);
      }
    };

    if (ujian_id !== undefined && ujian_id !== '') addUpdate('ujian_id', ujian_id);
    if (kelas_id !== undefined && kelas_id !== '') addUpdate('kelas_id', kelas_id);
    if (teks_soal !== undefined) addUpdate('teks_soal', teks_soal);
    if (gambar_soal !== undefined) addUpdate('gambar_soal', gambar_soal);
    if (pilihan_a !== undefined) addUpdate('pilihan_a', pilihan_a);
    if (gambar_pilihan_a !== undefined) addUpdate('gambar_pilihan_a', gambar_pilihan_a);
    if (pilihan_b !== undefined) addUpdate('pilihan_b', pilihan_b);
    if (gambar_pilihan_b !== undefined) addUpdate('gambar_pilihan_b', gambar_pilihan_b);
    if (pilihan_c !== undefined) addUpdate('pilihan_c', pilihan_c);
    if (gambar_pilihan_c !== undefined) addUpdate('gambar_pilihan_c', gambar_pilihan_c);
    if (pilihan_d !== undefined) addUpdate('pilihan_d', pilihan_d);
    if (gambar_pilihan_d !== undefined) addUpdate('gambar_pilihan_d', gambar_pilihan_d);
    if (pilihan_e !== undefined) addUpdate('pilihan_e', pilihan_e);
    if (gambar_pilihan_e !== undefined) addUpdate('gambar_pilihan_e', gambar_pilihan_e);
    if (kunci_jawaban !== undefined) addUpdate('kunci_jawaban', kunci_jawaban?.toUpperCase());
    if (nomor_urut !== undefined) addUpdate('nomor_urut', nomor_urut);
    if (bobot !== undefined) addUpdate('bobot', bobot);
    if (tipe_soal !== undefined) addUpdate('tipe_soal', tipe_soal);
    if (jawaban_essay !== undefined) addUpdate('jawaban_essay', jawaban_essay);
    if (jawaban_benar_salah !== undefined) addUpdate('jawaban_benar_salah', jawaban_benar_salah);
    if (jawaban_multiple !== undefined) addUpdate('jawaban_multiple', jawaban_multiple);

    if (updates.length === 0) {
      throw new BadRequestError('No fields to update');
    }

    params.push(id);

    await db.query(`UPDATE soal SET ${updates.join(', ')} WHERE id = ?`, params);

    logger.info({ soalId: id }, 'Question updated');
    return { message: 'Soal updated successfully' };
  }

  async handleImage(fieldName, currentImage, files, body) {
    const removeFlag = body[`remove_${fieldName}`];

    if (removeFlag === 'true' && currentImage) {
      const oldPath = path.join(UPLOAD_DIR, currentImage);
      try { await fs.unlink(oldPath); } catch (e) { /* ignore if not exists */ }
      return null;
    }

    if (files[fieldName] && files[fieldName][0]) {
      const originalFile = files[fieldName][0];
      const newFilename = originalFile.filename.replace(/\.[^/.]+$/, '.webp');
      const newPath = path.join(UPLOAD_DIR, newFilename);

      try {
        await sharp(originalFile.path)
          .resize(800, null, { withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(newPath);

        await fs.unlink(originalFile.path);
      } catch (err) {
        logger.error({ err }, 'Image processing failed');
        throw new Error('Failed to process image');
      }

      if (currentImage) {
        const oldPath = path.join(UPLOAD_DIR, currentImage);
        try { await fs.unlink(oldPath); } catch (e) { /* ignore if not exists */ }
      }
      return newFilename;
    }

    return currentImage;
  }

  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestError('No question IDs provided');
    }

    for (const id of ids) {
      const [soalData] = await db.query(
        'SELECT gambar_soal, gambar_pilihan_a, gambar_pilihan_b, gambar_pilihan_c, gambar_pilihan_d, gambar_pilihan_e FROM soal WHERE id = ?',
        [id]
      );

      if (soalData && soalData.length > 0) {
        const images = [
          soalData[0].gambar_soal,
          soalData[0].gambar_pilihan_a,
          soalData[0].gambar_pilihan_b,
          soalData[0].gambar_pilihan_c,
          soalData[0].gambar_pilihan_d,
          soalData[0].gambar_pilihan_e
        ];

        for (const filename of images) {
          if (filename) {
            const imagePath = path.join(UPLOAD_DIR, filename);
            try { await fs.unlink(imagePath); } catch (e) { /* ignore if not exists */ }
          }
        }
      }
    }

    const placeholders = ids.map(() => '?').join(',');
    const result = await db.query(`DELETE FROM soal WHERE id IN (${placeholders})`, ids);
    logger.info({ soalIds: ids, affectedRows: result.affectedRows }, 'Bulk questions deleted');
    return { message: `${result.affectedRows} soal berhasil dihapus`, affectedRows: result.affectedRows };
  }

  async delete(id) {
    const [soalData] = await db.query(
      'SELECT gambar_soal, gambar_pilihan_a, gambar_pilihan_b, gambar_pilihan_c, gambar_pilihan_d, gambar_pilihan_e FROM soal WHERE id = ?',
      [id]
    );

    if (soalData && soalData.length > 0) {
      const images = [
        soalData[0].gambar_soal,
        soalData[0].gambar_pilihan_a,
        soalData[0].gambar_pilihan_b,
        soalData[0].gambar_pilihan_c,
        soalData[0].gambar_pilihan_d,
        soalData[0].gambar_pilihan_e
      ];

      for (const filename of images) {
        if (filename) {
          const imagePath = path.join(UPLOAD_DIR, filename);
          try { await fs.unlink(imagePath); } catch (e) { /* ignore if not exists */ }
        }
      }
    }

    await db.query('DELETE FROM soal WHERE id = ?', [id]);
    logger.info({ soalId: id }, 'Question deleted');
    return { message: 'Soal deleted successfully' };
  }

  async deleteImage(id, field) {
    const allowedFields = ['gambar_soal', 'gambar_pilihan_a', 'gambar_pilihan_b', 'gambar_pilihan_c', 'gambar_pilihan_d', 'gambar_pilihan_e'];
    if (!allowedFields.includes(field)) {
      throw new BadRequestError('Invalid image field');
    }

    const [currentData] = await db.query(`SELECT \`${field}\` FROM soal WHERE id = ?`, [id]);

    if (!currentData.length || !currentData[0][field]) {
      throw new NotFoundError('Image not found');
    }

    const imageFilename = currentData[0][field];
    const imagePath = path.join(UPLOAD_DIR, imageFilename);

    try { await fs.unlink(imagePath); } catch (e) { /* ignore if not exists */ }

    await db.query(`UPDATE soal SET \`${field}\` = NULL WHERE id = ?`, [id]);

    logger.info({ soalId: id, field }, 'Question image deleted');
    return { message: 'Image deleted successfully' };
  }
}

module.exports = new QuestionService();