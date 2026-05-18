const express = require('express');
const jwt = require('jsonwebtoken');
const authenticateToken = require('../../middleware/auth');
const authorizeRole = require('../../middleware/authorize');
const { apiLimiter } = require('../../middleware/rateLimiter');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const router = express.Router();

const execAsync = util.promisify(exec);
const BACKUP_DIR = path.join(__dirname, '../../backups');
const DB_NAME = process.env.DB_NAME || 'ujian_db';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASSWORD || '123';
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

function getBackupPath(name) {
  return path.join(BACKUP_DIR, name);
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// POST /api/backup/create - Create a new backup
router.post('/create', authenticateToken, authorizeRole(['admin']), apiLimiter, async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.tar.gz`;
    const sqlFile = `backup-${timestamp}.sql`;
    const sqlPath = path.join(BACKUP_DIR, sqlFile);
    const outputPath = path.join(BACKUP_DIR, filename);

    // 1. Dump database
    const dumpCmd = process.env.DB_PASSWORD
      ? `mysqldump -u ${DB_USER} -p${DB_PASS} ${DB_NAME} > ${sqlPath}`
      : `mysqldump -u ${DB_USER} ${DB_NAME} > ${sqlPath}`;
    await execAsync(dumpCmd);

    // 2. Package SQL + uploads into tar.gz
    const tarCmd = `tar -czf ${outputPath} -C ${BACKUP_DIR} ${sqlFile} ${fs.existsSync(UPLOADS_DIR) ? `-C ${path.dirname(UPLOADS_DIR)} uploads` : ''}`;
    await execAsync(tarCmd);

    // 3. Remove temp SQL file
    fs.unlinkSync(sqlPath);

    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    res.json({
      success: true,
      message: 'Backup berhasil dibuat',
      filename,
      size: `${sizeMB} MB`,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ success: false, message: 'Gagal membuat backup: ' + error.message });
  }
});

// GET /api/backup/list - List all backups
router.get('/list', authenticateToken, authorizeRole(['admin']), apiLimiter, async (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return res.json({ success: true, data: [] });
    }
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.tar.gz'))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          filename: f,
          size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
          created_at: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ success: true, data: files });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal memuat daftar backup' });
  }
});

// GET /api/backup/download/:file - Download a backup file
router.get('/download/:file', async (req, res) => {
  try {
    // Support token via query param for direct downloads via window.open
    const token = req.query.token || (req.headers.authorization || '').split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }
    let user;
    try {
      user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const filename = sanitizeFilename(req.params.file);
    const filePath = getBackupPath(filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File tidak ditemukan' });
    }

    res.download(filePath, filename);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal mengunduh backup' });
  }
});

// POST /api/backup/restore/:file - Restore from an existing backup file
router.post('/restore/:file', authenticateToken, authorizeRole(['admin']), apiLimiter, async (req, res) => {
  try {
    const filename = sanitizeFilename(req.params.file);
    const filePath = getBackupPath(filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File backup tidak ditemukan' });
    }

    const extractDir = path.join(BACKUP_DIR, `extract-${Date.now()}`);
    fs.mkdirSync(extractDir, { recursive: true });

    await execAsync(`tar -xzf ${filePath} -C ${extractDir}`);

    const extractedFiles = fs.readdirSync(extractDir);
    const sqlFile = extractedFiles.find(f => f.endsWith('.sql'));
    if (!sqlFile) {
      fs.rmSync(extractDir, { recursive: true, force: true });
      return res.status(400).json({ success: false, message: 'File SQL tidak ditemukan dalam backup' });
    }

    const sqlPath = path.join(extractDir, sqlFile);

    const restoreCmd = process.env.DB_PASSWORD
      ? `mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME} < ${sqlPath}`
      : `mysql -u ${DB_USER} ${DB_NAME} < ${sqlPath}`;
    await execAsync(restoreCmd);

    const uploadExtractDir = path.join(extractDir, 'uploads');
    if (fs.existsSync(uploadExtractDir) && fs.existsSync(UPLOADS_DIR)) {
      await execAsync(`cp -rf ${uploadExtractDir}/* ${UPLOADS_DIR}/`);
    }

    fs.rmSync(extractDir, { recursive: true, force: true });

    res.json({ success: true, message: 'Restore berhasil dilakukan' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal melakukan restore: ' + error.message });
  }
});

// DELETE /api/backup/:file - Delete a backup
router.delete('/:file', authenticateToken, authorizeRole(['admin']), apiLimiter, async (req, res) => {
  try {
    const filename = sanitizeFilename(req.params.file);
    const filePath = getBackupPath(filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File tidak ditemukan' });
    }

    fs.unlinkSync(filePath);
    res.json({ success: true, message: 'Backup berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal menghapus backup' });
  }
});

module.exports = router;
