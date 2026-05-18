const express = require('express');
const authenticateToken = require('../../middleware/auth');
const authorizeRole = require('../../middleware/authorize');
const { apiLimiter } = require('../../middleware/rateLimiter');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const crypto = require('crypto');
const router = express.Router();

const execAsync = util.promisify(exec);
const ROOT_DIR = path.join(__dirname, '../../..');
const BACKEND_DIR = path.join(__dirname, '../..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const PKG_PATH = path.join(BACKEND_DIR, 'package.json');
const SCRIPT_PATH = path.join(BACKEND_DIR, 'scripts/update.sh');
const LOG_DIR = path.join(BACKEND_DIR, 'backups');

let currentJob = null;

function getVersion() {
  try {
    return JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8')).version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

async function execGit(dir, cmd) {
  const { stdout } = await execAsync(`git ${cmd}`, { cwd: dir, timeout: 30000 });
  return stdout.trim();
}

function logFile(id) {
  return path.join(LOG_DIR, `update-${id}.log`);
}

// GET /api/update/info
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
      error = 'Git repo tidak ditemukan';
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
        running: currentJob !== null,
        error
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/update/apply - Jalankan update di background
router.post('/apply', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  if (currentJob) {
    return res.status(400).json({ success: false, message: 'Update sedang berjalan' });
  }

  const jobId = Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
  const logPath = logFile(jobId);
  const lockPath = path.join(LOG_DIR, 'update.lock');

  fs.writeFileSync(lockPath, jobId);

  const script = spawn('bash', [SCRIPT_PATH, logPath], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, HOME: process.env.HOME }
  });

  currentJob = { id: jobId, pid: script.pid, logPath };

  script.unref();

  res.json({
    success: true,
    message: 'Update dimulai',
    job_id: jobId
  });
});

// GET /api/update/status/:jobId - Cek status update
router.get('/status/:jobId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const jobId = req.params.jobId;
  const logPath = logFile(jobId);

  if (!fs.existsSync(logPath)) {
    return res.json({ success: true, data: { running: false, logs: [], done: false } });
  }

  const content = fs.readFileSync(logPath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);
  const logs = lines.map(l => ({ time: new Date().toISOString(), message: l }));
  const done = content.includes('DONE');

  if (done) {
    currentJob = null;
    try { fs.unlinkSync(path.join(LOG_DIR, 'update.lock')); } catch (e) {}
  }

  res.json({
    success: true,
    data: { running: !done, logs, done }
  });
});

module.exports = router;
