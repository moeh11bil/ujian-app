const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const authenticateToken = require('../../middleware/auth');
const authorizeRole = require('../../middleware/authorize');
const questionController = require('../controllers/soalController');
const { apiLimiter } = require('../../middleware/rateLimiter');
const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '../../uploads/soal');

router.get('/images/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const imagePath = path.join(UPLOAD_DIR, filename);

    try {
      await fs.access(imagePath);
    } catch {
      return res.status(404).json({ message: 'Image not found' });
    }

    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'public, max-age=31536000');

    res.sendFile(imagePath);
  } catch (error) {
    res.status(500).json({ message: 'Failed to serve image', error: error.message });
  }
});

router.get('/ujian/:ujianId', authenticateToken, apiLimiter, questionController.getByExam);
router.get('/', authenticateToken, authorizeRole(['admin', 'guru']), apiLimiter, questionController.getAll);
router.post('/', authenticateToken, authorizeRole(['admin', 'guru']), questionController.upload, questionController.create);
router.put('/:id', authenticateToken, authorizeRole(['admin', 'guru']), questionController.upload, questionController.update);
router.delete('/:id', authenticateToken, authorizeRole(['admin', 'guru']), questionController.deleteQuestion);
router.post('/bulk-delete', authenticateToken, authorizeRole(['admin', 'guru']), questionController.bulkDelete);
router.get('/bank-soal/:kelasId', authenticateToken, authorizeRole(['admin', 'guru']), questionController.getByBank);
router.get('/bank-soal', authenticateToken, authorizeRole(['admin', 'guru']), questionController.getAllBank);
router.delete('/:id/images/:field', authenticateToken, authorizeRole(['admin', 'guru']), questionController.deleteImage);

module.exports = router;