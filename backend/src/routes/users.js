// src/routes/users.js
// Platform user registration and login

const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../services/platformAuth.service');
const { isHmrcConnected } = require('../services/tokenStore.service');
const requireAuth = require('../middleware/requireAuth');
const prisma = require('../config/db');

const setSessionCookie = (res, token) => {
  res.cookie('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

/**
 * POST /users/register
 * Create a new platform account
 */
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const { user, token } = await registerUser(email, password, name);
    setSessionCookie(res, token);
    res.status(201).json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /users/login
 * Log into an existing platform account
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const { user, token } = await loginUser(email, password);
    setSessionCookie(res, token);
    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

/**
 * GET /users/me
 * Get current user profile + HMRC connection status
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        businesses: {
          select: {
            id: true,
            businessName: true,
            businessType: true,
            status: true,
            vrn: true,
            utr: true,
            crn: true,
          },
        },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found.' });

    const hmrcConnected = await isHmrcConnected(req.user.userId);

    res.json({ ...user, hmrcConnected });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
});

/**
 * POST /users/logout
 */
router.post('/logout', (req, res) => {
  res.clearCookie('session');
  res.json({ success: true });
});

module.exports = router;
