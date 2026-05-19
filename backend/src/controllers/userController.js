const userService = require('../services/userService');
const { body, param, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const validate = (validations) => {
  return async (req, res, next) => {
    console.log('=== VALIDATING REQUEST ===');
    console.log('Body:', req.body);
    
    // Jalankan semua validasi
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    logger.error({ errors: errors.array(), body: req.body }, 'Validation failed');
    res.status(400).json({ errors: errors.array() });
  };
};

const createValidation = [
  body('nama').notEmpty().withMessage('Nama is required'),
  body('email').optional({ nullable: true }).isEmail().withMessage('Invalid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['admin', 'guru', 'siswa']).withMessage('Invalid role'),
  body('kelas_id').optional({ nullable: true }).custom((value) => {
    if (value === null || value === undefined || value === '' || value === 0) return true;
    if (isNaN(parseInt(value))) throw new Error('Invalid kelas_id');
    return true;
  }),
  body('nisn').optional({ nullable: true }).isString().withMessage('Invalid NISN'),
  body('no_peserta').optional({ nullable: true }).isString().withMessage('Invalid NO. Peserta')
];

const updateValidation = [
  body('nama').optional({ checkFalsy: true }).notEmpty().withMessage('Nama cannot be empty'),
  body('email').optional({ nullable: true }).isEmail().withMessage('Invalid email'),
  body('role').optional().isIn(['admin', 'guru', 'siswa']).withMessage('Invalid role'),
  body('kelas_id').optional({ nullable: true }).custom((value) => {
    if (value === null || value === undefined || value === '' || value === 0) return true;
    if (isNaN(parseInt(value))) throw new Error('Invalid kelas_id');
    return true;
  }),
  body('nisn').optional({ nullable: true }).isString().withMessage('Invalid NISN'),
  body('no_peserta').optional({ nullable: true }).isString().withMessage('Invalid NO. Peserta')
];

const idValidation = [
  param('id').isInt().withMessage('Invalid user ID')
];

const create = async (req, res, next) => {
  try {
    const result = await userService.create(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const kelasId = req.query.kelas_id || null;
    const result = await userService.getAll(page, limit, search, kelasId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getAllByRoles = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const roles = req.query.roles || 'admin,guru';
    const result = await userService.getAllByRoles(roles, page, limit, search);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getAllStudents = async (req, res, next) => {
  try {
    const students = await userService.getAllStudents();
    res.json(students);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const user = await userService.getById(req.params.id);
    res.json(user);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  console.log('=== USER UPDATE CONTROLLER CALLED ===');
  console.log('Params ID:', req.params.id);
  console.log('Body:', req.body);
  try {
    const result = await userService.update(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const result = await userService.delete(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const bulkDelete = async (req, res, next) => {
  try {
    const { ids } = req.body;
    const result = await userService.bulkDelete(ids);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create: [createValidation, validate(createValidation), create],
  getAll,
  getAllByRoles,
  getAllStudents,
  getById,
  update: [idValidation, updateValidation, validate(updateValidation), validate(idValidation), update],
  deleteUser: [idValidation, validate(idValidation), deleteUser],
  bulkDelete
};