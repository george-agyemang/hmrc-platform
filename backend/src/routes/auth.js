// src/routes/auth.js
// HMRC OAuth 2.0 flow routes

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { buildAuthUrl, exchangeCodeForTokens } = require('../services/hmrcAuth.service');
const { saveTokens } = require('../services/tokenStore.service');
const prisma = require('../config/db');

// In-memory state store (use Redis in production)
const pendingStates = new Map();

/**
 * GET /auth/hmrc
 * Initiates the HMRC OAuth flow.
 * Redirects the user to HMRC's login page.
 *
 * Query params:
 *   userId - your platform's user ID (must be logged in to your platform first)
 */
router.get('/hmrc', (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Generate a unique, random state value to prevent CSRF
  const state = uuidv4();

  // Store state with userId so we can link it after callback
  // Expires after 10 minutes
  pendingStates.set(state, {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  // Clean up expired states
  for (const [key, value] of pendingStates.entries()) {
    if (value.expiresAt < Date.now()) pendingStates.delete(key);
  }

  const authUrl = buildAuthUrl(state);

  console.log(`[Auth] Initiating HMRC OAuth for user ${userId}, state: ${state}`);

  // Redirect user to HMRC
  res.redirect(authUrl);
});

/**
 * GET /auth/callback
 * HMRC redirects here after user grants permission.
 * Exchanges the authorization code for tokens and stores them.
 *
 * Query params (from HMRC):
 *   code  - authorization code to exchange
 *   state - must match what we sent to prevent CSRF
 *   error - present if user denied access
 */
router.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  // Handle user denying access
  if (error) {
    console.warn(`[Auth] HMRC OAuth denied: ${error} - ${error_description}`);
    return res.redirect(`${frontendUrl}/auth/error?reason=${encodeURIComponent(error_description || error)}`);
  }

  if (!code || !state) {
    return res.redirect(`${frontendUrl}/auth/error?reason=missing_parameters`);
  }

  // Validate state to prevent CSRF attacks
  const pendingAuth = pendingStates.get(state);

  if (!pendingAuth) {
    console.warn(`[Auth] Invalid or expired state received: ${state}`);
    return res.redirect(`${frontendUrl}/auth/error?reason=invalid_state`);
  }

  if (pendingAuth.expiresAt < Date.now()) {
    pendingStates.delete(state);
    return res.redirect(`${frontendUrl}/auth/error?reason=session_expired`);
  }

  const { userId } = pendingAuth;
  pendingStates.delete(state); // One-time use

  try {
    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code);

    console.log(`[Auth] Successfully obtained tokens for user ${userId}`);
    console.log(`[Auth] Scopes granted: ${tokens.scope}`);

    // Ensure the user record exists (create if this is their first HMRC connect)
    await prisma.user.upsert({
      where:  { id: userId },
      update: {},
      create: { id: userId, email: `${userId}@pending.local` }, // email updated on /users/me
    });

    // Persist tokens to the database — they never leave the server
    await saveTokens(userId, tokens);

    // Issue a lightweight platform session JWT (no tokens inside)
    const sessionPayload = { userId, hmrcConnected: true, scope: tokens.scope };
    const sessionToken   = jwt.sign(sessionPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRY || '7d',
    });

    // Set session cookie and redirect to success page
    res.cookie('session', sessionToken, {
      httpOnly: true,    // Not accessible via JavaScript
      secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    });

    res.redirect(`${frontendUrl}/auth/success`);

  } catch (err) {
    console.error('[Auth] Token exchange failed:', err.response?.data || err.message);
    res.redirect(`${frontendUrl}/auth/error?reason=token_exchange_failed`);
  }
});

/**
 * POST /auth/logout
 * Clears the session cookie
 */
router.post('/logout', (req, res) => {
  res.clearCookie('session');
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /auth/status
 * Returns current connection status for a user
 */
router.get('/status', (req, res) => {
  const session = req.cookies?.session;

  if (!session) {
    return res.json({ connected: false });
  }

  try {
    const payload = jwt.verify(session, process.env.JWT_SECRET);
    res.json({
      connected: true,
      userId: payload.userId,
      hmrcConnected: payload.hmrcConnected,
      scope: payload.scope,
    });
  } catch {
    res.json({ connected: false });
  }
});

module.exports = router;
