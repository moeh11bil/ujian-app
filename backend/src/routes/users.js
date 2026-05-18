const express = require('express');
const authenticateToken = require('../../middleware/auth');
const authorizeRole = require('../../middleware/authorize');
const userController = require('../controllers/userController');
const { apiLimiter } = require('../../middleware/rateLimiter');
const router = express.Router();

router.post('/', authenticateToken, authorizeRole(['admin', 'guru']), apiLimiter, userController.create);
router.get('/', authenticateToken, authorizeRole(['admin', 'guru']), apiLimiter, userController.getAll);
router.get('/students', authenticateToken, authorizeRole(['admin', 'guru']), apiLimiter, userController.getAllStudents);
router.get('/:id', authenticateToken, apiLimiter, userController.getById);
router.put('/:id', authenticateToken, authorizeRole(['admin', 'guru']), userController.update);
router.delete('/:id', authenticateToken, authorizeRole(['admin']), apiLimiter, userController.deleteUser);
router.post('/bulk-delete', authenticateToken, authorizeRole(['admin']), apiLimiter, userController.bulkDelete);

module.exports = router;