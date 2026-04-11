// src/index.js
// Main Express server entry point

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const { validateConfig } = require('./config/hmrc');
const { fraudPreventionMiddleware } = require('./middleware/fraudPrevention');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const businessRoutes = require('./routes/businesses');
const submissionRoutes = require('./routes/submissions');

// Validate HMRC config on startup — fail fast if misconfigured
try {
  validateConfig();
  console.log('✅ HMRC config validated');
} catch (err) {
  console.error('❌ Configuration error:', err.message);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security Middleware ──────────────────────────────────────────────────────

app.use(helmet());  // Sets secure HTTP headers

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,  // Required for cookies
}));

// Rate limiting — prevents abuse of HMRC API via your platform
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts, please try again later.' },
});
app.use('/auth/', authLimiter);

// ─── Parsing Middleware ───────────────────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── HMRC Fraud Prevention Headers ───────────────────────────────────────────
// Attaches req.buildFraudHeaders() helper for use in API calls

app.use(fraudPreventionMiddleware);

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/businesses', businessRoutes);
app.use('/submissions', submissionRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV,
    hmrcApiUrl: process.env.HMRC_API_BASE_URL,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { detail: err.message }),
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 HMRC Platform backend running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV}`);
  console.log(`   HMRC API:    ${process.env.HMRC_API_BASE_URL}`);
  console.log(`   Frontend:    ${process.env.FRONTEND_URL}\n`);
});

module.exports = app;
