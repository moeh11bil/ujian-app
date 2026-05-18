const classService = require('../services/kelasService');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');

const createValidation = [
  body('nama_kelas').notEmpty().withMessage('Nama kelas is required'),
  body('deskripsi').optional()
];

const updateValidation = [
  param('id').isInt().withMessage('Invalid class ID'),
  body('nama_kelas').notEmpty().withMessage('Nama kelas is required')
];

const idValidation = [param('id').isInt().withMessage('Invalid class ID')];

const getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const result = await classService.getAll(page, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const result = await classService.getById(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const result = await classService.create(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const result = await classService.update(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const deleteClass = async (req, res, next) => {
  try {
    const result = await classService.delete(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAll,
  getById,
  create: [createValidation, validate(createValidation), create],
  update: [updateValidation, validate(updateValidation), update],
  deleteClass: [idValidation, validate(idValidation), deleteClass]
};