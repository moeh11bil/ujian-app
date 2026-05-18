const authService = require('../services/authService');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');

const registerValidation = [
  body('nama').notEmpty().withMessage('Nama is required'),
  body('email').isEmail().withMessage('Invalid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['admin', 'guru', 'siswa']).withMessage('Invalid role'),
  body('kelas_id').optional().isInt().withMessage('Invalid kelas_id'),
  body('nisn').optional({ nullable: true }).isString().withMessage('Invalid NISN'),
  body('no_peserta').optional({ nullable: true }).isString().withMessage('Invalid NO. Peserta')
];

const loginValidation = [
  body('email').notEmpty().withMessage('NISN or Email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const result = await authService.refreshToken(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const result = await authService.logout(req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register: [registerValidation, validate(registerValidation), register],
  login: [loginValidation, validate(loginValidation), login],
  refreshToken,
  logout
};