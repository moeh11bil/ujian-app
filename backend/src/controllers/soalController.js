const questionService = require('../services/soalService');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const logger = require('../utils/logger');

const uploadDir = path.join(__dirname, '../../uploads/soal');
if (!fsSync.existsSync(uploadDir)) {
  fsSync.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'img-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Hanya file gambar (JPEG, PNG, GIF, WEBP) yang diperbolehkan'));
  }
});

const imageFields = [
  { name: 'gambar_soal', maxCount: 1 },
  { name: 'gambar_pilihan_a', maxCount: 1 },
  { name: 'gambar_pilihan_b', maxCount: 1 },
  { name: 'gambar_pilihan_c', maxCount: 1 },
  { name: 'gambar_pilihan_d', maxCount: 1 },
  { name: 'gambar_pilihan_e', maxCount: 1 }
];

const idValidation = [param('id').isInt().withMessage('Invalid question ID')];
const examIdValidation = [param('ujianId').isInt().withMessage('Invalid exam ID')];
const kelasIdValidation = [param('kelasId').isInt().withMessage('Invalid class ID')];

const getByExam = async (req, res, next) => {
  try {
    const result = await questionService.getByExam(req.params.ujianId, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const result = await questionService.getAll(null, page, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const result = await questionService.create(req.body, req.files);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const result = await questionService.update(req.params.id, req.body, req.files);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const deleteQuestion = async (req, res, next) => {
  try {
    const result = await questionService.delete(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getByBank = async (req, res, next) => {
  try {
    const result = await questionService.getAll(req.params.kelasId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getAllBank = async (req, res, next) => {
  try {
    const result = await questionService.getAll();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const deleteImage = async (req, res, next) => {
  try {
    const result = await questionService.deleteImage(req.params.id, req.params.field);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const bulkDelete = async (req, res, next) => {
  try {
    const { ids } = req.body;
    const result = await questionService.bulkDelete(ids);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  upload: upload.fields(imageFields),
  getByExam,
  getAll,
  create,
  update,
  deleteQuestion,
  getByBank,
  getAllBank,
  deleteImage,
  bulkDelete,
  validations: {
    id: idValidation,
    examId: examIdValidation,
    kelasId: kelasIdValidation
  }
};