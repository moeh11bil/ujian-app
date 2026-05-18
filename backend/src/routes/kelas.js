const express = require('express');
const authenticateToken = require('../../middleware/auth');
const authorizeRole = require('../../middleware/authorize');
const classController = require('../controllers/kelasController');
const { apiLimiter } = require('../../middleware/rateLimiter');
const router = express.Router();

router.get('/', authenticateToken, authorizeRole(['admin', 'guru']), apiLimiter, classController.getAll);
router.get('/:id', authenticateToken, authorizeRole(['admin', 'guru']), apiLimiter, classController.getById);
router.post('/', authenticateToken, authorizeRole(['admin', 'guru']), classController.create);
router.put('/:id', authenticateToken, authorizeRole(['admin', 'guru']), classController.update);
router.delete('/:id', authenticateToken, authorizeRole(['admin']), classController.deleteClass);

module.exports = router;