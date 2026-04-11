// src/middleware/requireAuth.js
// Middleware to protect routes — checks for a valid platform session JWT

const { verifyJwt } = require('../services/platformAuth.service');

const requireAuth = (req, res, next) => {
  const token = req.cookies?.session;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated. Please log in.' });
  }

  try {
    const payload = verifyJwt(token);
    req.user = payload; // { userId, email }
    next();
  } catch (err) {
    res.clearCookie('session');
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
};

module.exports = requireAuth;
