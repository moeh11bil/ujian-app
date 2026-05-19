# IMPLEMENTASI LENGKAP PERBAIKAN APLIKASI UJIAN ONLINE

## Status: Partially Completed (4/15 Critical & Important Items)

Dokumen ini menjelaskan semua perbaikan yang telah dilakukan dan yang masih perlu diimplementasikan.

---

## ✅ YANG SUDAH DITERAPKAN (Items 1-4)

### 1. Environment Variables (✅ DONE)
**Files Changed**:
- `frontend/.env` - API URL configuration
- `frontend/.env.example` - Template
- `frontend/src/lib/api.js` - Uses `import.meta.env.VITE_API_URL`
- `frontend/vite.config.js` - Dynamic proxy configuration
- `frontend/.gitignore` - Protect .env files

**Impact**: Application can now be deployed to different environments without code changes.

### 2. Error Boundary (✅ DONE)
**Files Created**:
- `frontend/src/components/ErrorBoundary.svelte` - Error boundary component
- `frontend/src/utils/errorHandler.js` - Error handling utilities

**Files Modified**:
- `frontend/src/App.svelte` - Wrapped with ErrorBoundary

**Impact**: Runtime errors are now caught and displayed user-friendly error pages instead of crashing the app.

### 3. SQL Injection Prevention (✅ DONE)
**Files Created**:
- `backend/utils/sqlSanitizer.js` - Column validation utilities

**Files Modified**:
- `backend/routes/soal.js` - Fixed vulnerable DELETE image endpoint

**Audit Results**:
- 18 route files audited
- 14/18 already safe (using parameterized queries)
- 1 vulnerable endpoint fixed (`DELETE /:id/images/:field`)
- 3 endpoints use safe dynamic column patterns (whitelisted in code)

**Impact**: All SQL queries now use parameterized values or validated column names, preventing SQL injection attacks.

### 4. Client-Side Validation (✅ DONE)
**Files Created**:
- `frontend/src/utils/formValidation.js` - 14 validation functions
- `frontend/VALIDATION_GUIDE.md` - Implementation guide

**Files Modified**:
- `frontend/src/pages/Login.svelte` - Added validation

**Available Validations**:
- `validateLoginForm()` - Login form
- `validateRegisterForm()` - Registration form
- `validateExamForm()` - Exam creation
- `validateQuestionForm()` - Question creation
- `validateClassForm()` - Class management
- `validateProfileForm()` - Profile updates
- `validateResetRequestForm()` - Reset requests


**Impact**: Ready to implement in any form following the Login.svelte pattern.

---

## 📝 YANG PERLU DITERAPKAN (Items 5-15)

### 5. Proper Svelte Stores for Global State
**Current Issue**: User state managed in App.svelte with localStorage, not reactive across components.

**Solution**:
```javascript
// frontend/src/stores/authStore.js
import { writable, derived } from 'svelte/store';

function createAuthStore() {
  const { subscribe, set, update } = writable(null);

  return {
    subscribe,
    login(token, user) {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      set({ token, user, isAuthenticated: true });
    },
    logout() {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      set(null);
    },
    init() {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          set({ token, user, isAuthenticated: true });
        } catch {
          this.logout();
        }
      }
    }
  };
}

export const authStore = createAuthStore();
export const currentUser = derived(authStore, $auth => $auth?.user);
export const isAuthenticated = derived(authStore, $auth => $auth?.isAuthenticated || false);
```

**Files to Update**:
- Create: `frontend/src/stores/authStore.js`
- Update: `frontend/src/App.svelte` - Use authStore instead of localStorage
- Update: `frontend/src/pages/Login.svelte` - Use authStore.login()
- Update: `frontend/src/components/Navbar.svelte` - Subscribe to authStore
- Update: All components using `localStorage.getItem('token')`

### 6. Loading States for API Calls
**Solution**: Create reusable loading components.

```svelte
<!-- frontend/src/components/LoadingSpinner.svelte -->
<script>
  export let size = 'md'; // sm, md, lg
  export let fullScreen = false;
  export let message = 'Memuat...';
  
  const sizes = {
    sm: 'h-5 w-5',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };
</script>

{#if fullScreen}
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center">
      <svg class="animate-spin {sizes[size]} text-primary-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      {#if message}
        <p class="mt-4 text-gray-600">{message}</p>
      {/if}
    </div>
  </div>
{:else}
  <div class="flex items-center justify-center py-8">
    <svg class="animate-spin {sizes[size]} text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    {#if message}
      <span class="ml-3 text-gray-600">{message}</span>
    {/if}
  </div>
{/if}
```

**Skeleton Component**:
```svelte
<!-- frontend/src/components/SkeletonCard.svelte -->
<script>
  export let lines = 3;
</script>

<div class="animate-pulse bg-white rounded-lg shadow p-6">
  <div class="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
  {#each Array(lines) as _, i}
    <div class="h-3 bg-gray-200 rounded mb-2" style="width: {100 - (i * 10)}%"></div>
  {/each}
</div>
```

**Usage Pattern in Pages**:
```svelte
<script>
  import LoadingSpinner from '../components/LoadingSpinner.svelte';
  import SkeletonCard from '../components/SkeletonCard.svelte';
  
  let loading = false;
  let data = [];
  
  async function loadData() {
    loading = true;
    try {
      data = await fetchWithAuth('/api/data');
    } finally {
      loading = false;
    }
  }
</script>

{#if loading}
  <LoadingSpinner message="Memuat data..." />
  <!-- OR for lists -->
  <div class="grid gap-4">
    {#each Array(5) as _, i}
      <SkeletonCard lines={3} />
    {/each}
  </div>
{:else}
  <!-- Render actual data -->
{/if}
```

### 7. Organize Migration Scripts
**Current Issue**: Dozens of `.js` scripts in backend root directory.

**Solution**:
```bash
# Create organized folder structure
backend/scripts/
  ├── database/
  │   ├── create-db.js
  │   ├── init-db.js
  │   └── update-schema.js
  ├── migrations/
  │   ├── add-password-recovery.js
  │   ├── add-essay-grading-system.js
  │   ├── create-soal-paket.js
  │   └── fix-soal-columns.js
  ├── testing/
  │   ├── create-test-users.js
  │   ├── create-active-exam.js
  │   ├── test-api-endpoints.js
  │   └── test-login-flow.js
  ├── maintenance/
  │   ├── backup-database.js
  │   ├── cleanup-old-sessions.js
  │   └── recalculate-scores.js
  └── README.md

# Update package.json scripts
{
  "scripts": {
    "db:create": "node scripts/database/create-db.js",
    "db:init": "node scripts/database/init-db.js",
    "db:backup": "node scripts/maintenance/backup-database.js",
    "test:users": "node scripts/testing/create-test-users.js"
  }
}
```

### 8. Testing Setup

**Backend Testing** (Jest + Supertest):
```json
// backend/package.json additions
{
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.3",
    "@types/jest": "^29.5.5"
  },
  "scripts": {
    "test": "jest --coverage",
    "test:watch": "jest --watch"
  }
}
```

```javascript
// backend/tests/auth.test.js
const request = require('supertest');
const app = require('../server');
const db = require('../config/database');

describe('Auth API', () => {
  afterAll(async () => {
    await db.end();
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'password123'
        });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('email', 'admin@test.com');
    });

    it('should reject invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'wrongpassword'
        });
      
      expect(res.status).toBe(401);
    });
  });
});
```

**Frontend Testing** (Vitest + Svelte Testing Library):
```json
// frontend/package.json additions
{
  "devDependencies": {
    "@testing-library/svelte": "^4.0.3",
    "@vitest/coverage-v8": "^0.34.0",
    "jsdom": "^22.1.0",
    "vitest": "^0.34.0"
  },
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

```javascript
// frontend/src/components/Modal.test.js
import { render, fireEvent } from '@testing-library/svelte';
import Modal from './Modal.svelte';

describe('Modal', () => {
  test('renders when open is true', () => {
    const { getByText } = render(Modal, {
      props: { open: true, title: 'Test Modal' }
    });
    
    expect(getByText('Test Modal')).toBeTruthy();
  });

  test('does not render when open is false', () => {
    const { queryByText } = render(Modal, {
      props: { open: false, title: 'Test Modal' }
    });
    
    expect(queryByText('Test Modal')).toBeNull();
  });
});
```

### 9. Database Connection Pooling Optimization

```javascript
// backend/config/database.js
const mariadb = require('mariadb');

const isProduction = process.env.NODE_ENV === 'production';

const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: isProduction ? 20 : 5,
  acquireTimeout: isProduction ? 30000 : 10000,
  timeout: 30000,
  idleTimeout: 600000, // 10 minutes
  minDelay: 1000,
  resetAfterUse: true,
  // Production-specific settings
  ...(isProduction && {
    connectTimeout: 5000,
    poolSize: 20
  })
});

// Add pool monitoring
pool.on('connection', (conn) => {
  console.log(`Database connection established. Pool size: ${pool.totalConnections()}`);
});

module.exports = pool;
```

### 10. WebSocket for Real-Time Exam Monitoring

**Backend Setup**:
```bash
npm install socket.io
```

```javascript
// backend/server.js additions
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST']
  }
});

// Store active connections
const activeExamSessions = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Join exam room
  socket.on('join-exam', ({ examId, userId }) => {
    socket.join(`exam:${examId}`);
    activeExamSessions.set(socket.id, { examId, userId });
    
    io.to(`exam:${examId}`).emit('student-joined', {
      userId,
      timestamp: new Date().toISOString()
    });
  });
  
  // Real-time activity tracking
  socket.on('exam-activity', (data) => {
    const { examId, userId, activity } = data;
    
    io.to(`exam:${examId}`).emit('activity-update', {
      userId,
      activity,
      timestamp: new Date().toISOString()
    });
  });
  
  // Auto-submit exam
  socket.on('auto-submit-exam', (data) => {
    io.to(`exam:${data.examId}`).emit('exam-auto-submitted', data);
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    activeExamSessions.delete(socket.id);
  });
});

// Replace `server.listen()` with:
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} with WebSocket support`);
});
```

**Frontend Setup**:
```bash
npm install socket.io-client
```

```javascript
// frontend/src/lib/socket.js
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const SOCKET_URL = API_URL.replace('/api', '');

let socket = null;

export function initSocket(token) {
  if (socket) {
    socket.disconnect();
  }
  
  socket = io(SOCKET_URL, {
    auth: { token }
  });
  
  socket.on('connect', () => {
    console.log('[Socket] Connected to server');
  });
  
  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected from server');
  });
  
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
```

### 11. Redis Caching

**Backend Setup**:
```bash
npm install redis
```

```javascript
// backend/config/redis.js
const redis = require('redis');

const isProduction = process.env.NODE_ENV === 'production';
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  },
  ...(isProduction && {
    password: process.env.REDIS_PASSWORD
  })
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

redisClient.on('connect', () => {
  console.log('Redis connected');
});

async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

// Cache middleware
export async function cacheMiddleware(key, duration = 300) {
  return async (req, res, next) => {
    try {
      await connectRedis();
      const cached = await redisClient.get(key);
      
      if (cached) {
        return res.json(JSON.parse(cached));
      }
      
      // Store original send
      const originalSend = res.json;
      res.json = function(data) {
        redisClient.setEx(key, duration, JSON.stringify(data));
        return originalSend.call(this, data);
      };
      
      next();
    } catch (err) {
      console.error('Cache error:', err);
      next();
    }
  };
}

// Example usage in routes:
// router.get('/ujian', cacheMiddleware('all-ujian', 60), async (req, res) => {
//   // ... existing code
// });

module.exports = { redisClient, connectRedis, cacheMiddleware };
```

### 12. Pagination Implementation

```javascript
// backend/middleware/pagination.js
export function paginate(req, res, next) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  
  // Validate inputs
  if (page < 1 || limit < 1 || limit > 100) {
    return res.status(400).json({
      message: 'Invalid pagination parameters',
      validRange: 'page >= 1, limit: 1-100'
    });
  }
  
  req.pagination = { page, limit, offset };
  next();
}

// Helper to format paginated response
export function paginateResponse(data, total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  
  return {
    success: true,
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
}

// Usage in routes:
// import { paginate, paginateResponse } from '../middleware/pagination.js';
// 
// router.get('/users', authenticateToken, paginate, async (req, res) => {
//   const { page, limit, offset } = req.pagination;
//   
//   const [users] = await db.query(
//     'SELECT * FROM users LIMIT ? OFFSET ?',
//     [limit, offset]
//   );
//   
//   const [{ total }] = await db.query('SELECT COUNT(*) as total FROM users');
//   
//   res.json(paginateResponse(users, total, page, limit));
// });
```

### 13. Automated Database Backup

```javascript
// backend/scripts/maintenance/backup-database.js
require('dotenv').config();
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const BACKUP_DIR = path.join(__dirname, '../../backups');
const DATE = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_FILE = path.join(BACKUP_DIR, `backup-${DATE}.sql.gz`);

// Create backup directory if not exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

const command = `mysqldump -h ${dbConfig.host} -u ${dbConfig.user} -p${dbConfig.password} ${dbConfig.database} | gzip > ${BACKUP_FILE}`;

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error('Backup failed:', error);
    process.exit(1);
  }
  
  console.log(`Backup completed: ${BACKUP_FILE}`);
  
  // Delete backups older than 7 days
  const cleanupCommand = `find ${BACKUP_DIR} -name "backup-*.sql.gz" -mtime +7 -delete`;
  exec(cleanupCommand, (err) => {
    if (err) {
      console.error('Cleanup failed:', err);
    } else {
      console.log('Old backups cleaned up');
    }
    process.exit(0);
  });
});
```

Add to crontab:
```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/backend && node scripts/maintenance/backup-database.js >> logs/backup.log 2>&1
```

### 14. Logging System (Winston + Morgan)

```bash
npm install winston morgan
```

```javascript
// backend/config/logger.js
const winston = require('winston');
const path = require('path');

const logDir = path.join(__dirname, '../logs');
const { format } = winston;

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'ujian-app' },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Combined logs
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5
    }),
    // Console for development
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: format.combine(
          format.colorize(),
          format.simple()
        )
      })
    ]: [])
  ]
});

module.exports = logger;
```

```javascript
// backend/server.js - Add Morgan
const morgan = require('morgan');
const logger = require('./config/logger');

// HTTP request logging
const stream = {
  write: (message) => logger.info(message.trim())
};

app.use(morgan('combined', { stream }));

// Error logging middleware
app.use((err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });
  
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error'
  });
});
```

### 15. CSRF Protection & Input Sanitization

```bash
npm install csurf express-validator xss
```

```javascript
// backend/middleware/csrf.js
const csrf = require('csurf');

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

module.exports = csrfProtection;
```

```javascript
// backend/middleware/sanitizeInput.js
const xss = require('xss');

function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  return xss(value.trim(), {
    whiteList: {}, // No HTML tags allowed
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script']
  });
}

function sanitizeObject(obj) {
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// Middleware to sanitize req.body
function sanitizeInput(req, res, next) {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  next();
}

module.exports = sanitizeInput;
```

```javascript
// backend/server.js - Add middleware
const csrfProtection = require('./middleware/csrf');
const sanitizeInput = require('./middleware/sanitizeInput');

// Input sanitization
app.use(sanitizeInput);

// CSRF protection for state-changing routes (after session middleware)
// app.use('/api', csrfProtection);
```

---

## PRIORITY RECOMMENDATIONS

### High Priority (Do Next)
1. **Item 5**: Auth Store - Will simplify authentication across entire app
2. **Item 6**: Loading States - Major UX improvement
3. **Item 9**: Connection Pooling - Performance optimization
4. **Item 15**: CSRF Protection - Security hardening

### Medium Priority
5. **Item 12**: Pagination - Needed for scaling (student lists, results)
6. **Item 14**: Logging - Essential for debugging production issues
7. **Item 8**: Testing - Start with critical auth and exam submission flows

### Lower Priority
8. **Item 10**: WebSocket - Nice to have, polling works for now
9. **Item 11**: Redis - Only needed if you hit performance bottlenecks
10. **Item 13**: Backup - Important but can be done via cron + mysqldump manually
11. **Item 7**: Scripts Organization - Quality of life improvement

---

## ESTIMATED EFFORT

| Item | Files to Create | Files to Modify | Time Estimate |
|------|----------------|----------------|---------------|
| 5 | 1 | 10+ | 2 hours |
| 6 | 2 | 20+ | 4 hours |
| 7 | 0 (move files) | 5 | 1 hour |
| 8 | 5+ | 2 | 6 hours |
| 9 | 0 | 1 | 0.5 hours |
| 10 | 2 | 2 | 3 hours |
| 11 | 1 | 5+ | 3 hours |
| 12 | 1 | 10+ | 4 hours |
| 13 | 1 | 0 | 1 hour |
| 14 | 1 | 2 | 2 hours |
| 15 | 2 | 2 | 2 hours |

**Total**: ~28.5 hours of development time for remaining 11 items

---

## NEXT STEPS

1. **Review completed items** (1-4) and test them
2. **Prioritize remaining items** based on your deployment timeline
3. **Implement items in phases**:
   - Phase 1: Security & Performance (5, 6, 9, 15)
   - Phase 2: Infrastructure (7, 8, 12, 14)
   - Phase 3: Features (10, 11, 13)
4. **Test thoroughly** after each phase

Would you like me to implement any specific remaining items?

---

## 2026-05-19

### Mobile Admin Responsive & Update Badge Fix
- **Modified** `frontend/src/layouts/AdminGuruLayout.svelte` — sidebar jadi `fixed` overlay di mobile via CSS media query + dynamic class; hapus icon, subtitle LMS, tombol X; tambah overflow hidden cegah bleed; sidebar otomatis tutup setelah klik link
- **Modified** `frontend/src/pages/admin/Exams.svelte` — flex-wrap action buttons, truncate date text
- **Modified** `frontend/src/pages/admin/Users.svelte` — pagination bar flex-col di mobile
- **Modified** `frontend/src/pages/admin/Students.svelte` — hapus whitespace-nowrap nama, flex-nowrap buttons, bottom bar full-width
- **Modified** `frontend/src/pages/admin/UnifiedQuestionBank.svelte` — max-w responsive untuk teks soal
- **Fixed** `backend/src/routes/update.js` — ganti `git remote update` jadi `git fetch origin master --depth=1` biar gak hang saat banyak commit
- **Modified** `frontend/src/pages/admin/Update.svelte` — progress bar + step list + collapsible terminal log; fix remote url overflow

### Bulk Delete Soal Bank Soal
- **Added** `backend/src/services/soalService.js` — `bulkDelete(ids)` method hapus banyak soal + gambar terkait
- **Added** `backend/src/controllers/soalController.js` — `bulkDelete` endpoint handler
- **Added** `backend/src/routes/soal.js` — `POST /bulk-delete` route
- **Modified** `frontend/src/pages/admin/UnifiedQuestionBank.svelte` — checkbox kolom tabel, pilih semua, highlight row, fixed bottom action bar, konfirmasi modal + hapus massal
- **Fixed** `backend/scripts/update.sh` — ganti `git pull` jadi `git fetch origin master && git reset --hard origin/master` biar gak gagal divergent branches

### Fix Preview Exam & Reset Ujian Siswa
- **Fixed** `frontend/src/pages/admin/ExamPreview.svelte` — ganti error handling biar gak navigasi away; tambah loading spinner + error state + tombol "Coba Lagi"; fix hardcoded `localhost:3000` jadi dynamic base url
- **Fixed** `backend/src/routes/reset_requests.js` — typo `ujianId` → `examId` (variabel undefined) yang bikin 500 error saat siswa minta reset
- **Added** `backend/src/routes/hasil.js` — route `DELETE /reset-student/:userId` untuk admin reset status ujian siswa dari halaman Students
- **Exported** `frontend/src/lib/api.ts` — export `BASE_URL` biar bisa dipakai di komponen lain

### Fix Gambar Tidak Tampil di HP (Hardcoded localhost)
- **Fixed** `frontend/src/pages/student/ExamInterface.svelte` — ganti hardcoded `localhost:3000` di gambar soal & pilihan jadi `uploadBase` dari `BASE_URL`
- **Fixed** `frontend/src/pages/admin/GradingDetail.svelte` — ganti hardcoded `localhost:3000` di gambar soal
- **Fixed** `frontend/src/pages/admin/UnifiedQuestionBank.svelte` — ganti hardcoded `localhost:3000` di export & preview edit gambar

### UI Exam Interface & Pelanggaran
- **Modified** `frontend/src/pages/student/ExamInterface.svelte` — tombol "Kirim Jawaban" pindah ke akhir soal (gantikan "Selanjutnya"); sidebar nomor soal jadi collapsible `<details>` default collapsed; tambah `max-lg:hidden` biar gak dobel panel di HP
- **Removed** `frontend/src/pages/student/ExamInterface.svelte` — hapus `window_blur` violation handler biar sleep/background/blur HP gak dianggap pelanggaran

### Fix Crash Preview Exam
- **Fixed** `frontend/src/pages/admin/ExamPreview.svelte` — bungkus exam header dgn `{#if exam}` biar gak crash saat `exam` masih null pas render pertama
