require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const db = require('./config/database');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./src/middleware/errorHandler');
const logger = require('./src/utils/logger');

const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(origin => origin.trim())
  : ['http://localhost:5173'];

app.use(compression());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "*"],
      connectSrc: ["'self'", ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || !isProduction) {
      callback(null, origin || '*');
    } else if (allowedOrigins.includes(origin)) {
      callback(null, origin);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
const timeout = require('connect-timeout');
app.use('/api/', apiLimiter);
app.use(timeout('30s'));
app.use((req, res, next) => {
  if (req.timedout) return;
  next();
});

db.getConnection()
  .then(conn => {
    logger.info('Connected to MariaDB database');
    conn.release();
  })
  .catch(err => {
    logger.error({ err }, 'Database connection failed');
  });

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/uploads/soal', (req, res, next) => {
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Cache-Control', 'public, max-age=31536000, immutable');
  next();
}, express.static('uploads/soal'));

app.use('/uploads', (req, res, next) => {
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Access-Control-Allow-Origin', '*');
  next();
}, express.static('uploads'));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/ujian', require('./src/routes/ujian'));
app.use('/api/soal', require('./src/routes/soal'));
app.use('/api/hasil', require('./src/routes/hasil'));
app.use('/api/essay-grading', require('./src/routes/essay-grading'));
app.use('/api/kelas', require('./src/routes/kelas'));
app.use('/api/reset-requests', require('./src/routes/reset_requests'));
app.use('/api/statistics', require('./src/routes/statistics'));
app.use('/api/exam-sessions', require('./src/routes/exam-sessions'));
app.use('/api/bulk', require('./src/routes/bulk'));
app.use('/api/paket-soal', require('./src/routes/paket-soal'));
app.use('/api/exam-cards', require('./src/routes/exam-cards'));
app.use('/api/violations', require('./src/routes/violations'));
app.use('/api/backup', require('./src/routes/backup'));
app.use('/api/update', require('./src/routes/update'));

if (isProduction) {
  const frontendDist = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendDist));

  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    } else {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
    }
  });
} else {
  app.get('/', (req, res) => {
    res.json({ message: 'Online Exam API is running!' });
  });

  app.use('*', (req, res) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });
}

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Server is running');
});