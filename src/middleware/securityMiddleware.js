const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const hpp = require('hpp');

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  points: 500,
  duration: 15 * 60,
  blockDuration: 60 * 60,
});

const rateLimiterMiddleware = async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch {
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.',
    });
  }
};

const applySecurityMiddleware = (app) => {
  // Secure headers
  app.use(helmet());

  // Rate limit API only
  app.use('/api', rateLimiterMiddleware);

  // Prevent HTTP parameter pollution
  app.use(hpp());
};

module.exports = { applySecurityMiddleware };
