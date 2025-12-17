// backend/src/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const morgan = require('morgan');
const connectDB = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const { applySecurityMiddleware } = require('./middleware/securityMiddleware');
const mongoSanitize = require('./middleware/mongoSanitize');

// Routes
const authRoutes = require('./routes/authRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const broadcastRoutes = require('./routes/broadcastRoutes');
const contactRoutes = require('./routes/contactRoutes');

const app = express();

/* -------------------- DATABASE -------------------- */
connectDB();

/* -------------------- CORS (MUST BE FIRST) -------------------- */
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

/* -------------------- BODY PARSERS -------------------- */
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

/* -------------------- SECURITY -------------------- */
applySecurityMiddleware(app);

/* -------------------- SANITIZE (SAFE CUSTOM) -------------------- */
app.use(mongoSanitize);

/* -------------------- PERFORMANCE -------------------- */
app.use(compression());

/* -------------------- LOGGING -------------------- */
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

/* -------------------- ROUTES -------------------- */
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/broadcast', broadcastRoutes);
app.use('/api/contact', contactRoutes);

/* -------------------- HEALTH CHECK -------------------- */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: Date.now(),
    node: process.version,
  });
});

/* -------------------- ERRORS -------------------- */
app.use(notFound);
app.use(errorHandler);

module.exports = app;
