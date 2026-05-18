const express = require('express');
const authenticateToken = require('../../middleware/auth');
const authorizeRole = require('../../middleware/authorize');
const { apiLimiter } = require('../../middleware/rateLimiter');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const router = express.Router();

const execAsync = util.promisify(exec);
const ROOT_DIR = path.join(__dirname, '../../..');
const BACKEND_DIR = path.join(__dirname, '../..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const PKG_PATH = path.join(BACKEND_DIR, 'package.json');

function getVersion() {
  try {
    return JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8')).version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

async function execGit(dir, cmd) {
  const { stdout, stderr } = await execAsync(`git ${cmd}`, { cwd: dir, timeout: 30000 });
  return stdout.trim();
}

// GET /api/update/info - Get current version and update status
router.get('/info', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    let currentCommit = '-';
    let currentBranch = '-';
    let remoteUrl = '-';
    let behind = null;
    let hasRemote = false;
    let error = null;

    try {
      currentCommit = await execGit(ROOT_DIR, 'rev-parse --short HEAD');
      currentBranch = await execGit(ROOT_DIR, 'rev-parse --abbrev-ref HEAD');
    } catch (e) {
      error = 'Git repo tidak ditemukan atau belum diinisialisasi';
    }

    try {
      remoteUrl = await execGit(ROOT_DIR, 'remote get-url origin');
      hasRemote = true;
    } catch (e) {
      remoteUrl = '(belum diatur)';
    }

    if (hasRemote) {
      try {
        await execGit(ROOT_DIR, 'remote update 2>&1');
        const status = await execGit(ROOT_DIR, 'status -sb');
        const match = status.match(/behind\s+(\d+)/);
        behind = match ? parseInt(match[1]) : 0;
      } catch (e) {
        behind = -1;
      }
    }

    res.json({
      success: true,
      data: {
        version: getVersion(),
        branch: currentBranch,
        commit: currentCommit,
        remote_url: remoteUrl,
        behind,
        has_remote: hasRemote,
        error
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/update/apply - Pull latest code, install deps, migrate, rebuild, restart
router.post('/apply', authenticateToken, authorizeRole(['admin']), apiLimiter, async (req, res) => {
  const logs = [];

  function log(msg) {
    logs.push({ time: new Date().toISOString(), message: msg });
  }

  try {
    log('Memulai proses update...');

    // 1. Git pull
    log('Mengambil kode terbaru dari remote...');
    try {
      const pullResult = await execGit(ROOT_DIR, 'pull origin main 2>&1');
      log(pullResult);
    } catch (e) {
      try {
        const pullResult = await execGit(ROOT_DIR, 'pull origin master 2>&1');
        log(pullResult);
      } catch (e2) {
        throw new Error('Gagal git pull: ' + (e2.stderr || e2.message));
      }
    }

    // 2. Install backend dependencies
    log('Menginstall dependensi backend...');
    await execAsync('npm install', { cwd: BACKEND_DIR, timeout: 120000 });
    log('Dependensi backend selesai');

    // 3. Install frontend dependencies
    log('Menginstall dependensi frontend...');
    await execAsync('npm install', { cwd: FRONTEND_DIR, timeout: 120000 });
    log('Dependensi frontend selesai');

    // 4. Run database migrations
    log('Menjalankan migrasi database...');
    const migrateScript = path.join(BACKEND_DIR, 'update-schema.js');
    if (fs.existsSync(migrateScript)) {
      try {
        const { stdout } = await execAsync('node update-schema.js', { cwd: BACKEND_DIR, timeout: 60000 });
        log(stdout || 'Migrasi selesai');
      } catch (e) {
        log('Warning: Migrasi gagal: ' + (e.stderr || e.message));
      }
    } else {
      log('Tidak ada file migrasi');
    }

    // 5. Rebuild frontend
    log('Membangun ulang frontend...');
    await execAsync('npm run build', { cwd: FRONTEND_DIR, timeout: 120000 });
    log('Frontend selesai dibangun');

    log('Update selesai! Server akan restart...');

    res.json({
      success: true,
      message: 'Update berhasil. Server akan restart...',
      logs
    });

    // 6. Restart server after response is sent
    setTimeout(() => {
      process.exit(0);
    }, 1000);

  } catch (error) {
    log('ERROR: ' + error.message);
    res.status(500).json({
      success: false,
      message: 'Update gagal: ' + error.message,
      logs
    });
  }
});

module.exports = router;
