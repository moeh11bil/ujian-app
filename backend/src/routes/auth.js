const express = require('express');
const authenticateToken = require('../../middleware/auth');
const authController = require('../controllers/authController');
const { loginLimiter } = require('../../middleware/rateLimiter');
const router = express.Router();

// Registration disabled - user accounts managed by admin
// router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authenticateToken, authController.logout);

module.exports = router;