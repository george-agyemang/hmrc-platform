// src/services/tokenStore.service.js
// Handles secure storage and retrieval of HMRC OAuth tokens in the database.
// Tokens NEVER leave the server — only session JWTs go to the frontend.

const prisma = require('../config/db');
const { refreshAccessToken, isTokenExpired } = require('./hmrcAuth.service');

/**
 * Save (or update) HMRC tokens for a user.
 * Uses upsert so reconnecting overwrites stale tokens.
 *
 * @param {string} userId
 * @param {Object} tokens - { accessToken, refreshToken, expiresAt, scope }
 */
const saveTokens = async (userId, tokens) => {
  return prisma.hmrcToken.upsert({
    where: { userId },
    update: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
    },
    create: {
      userId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
    },
  });
};

/**
 * Get a valid (non-expired) access token for a user.
 * Automatically refreshes using the refresh token if expired.
 *
 * @param {string} userId
 * @returns {string} A valid access token
 */
const getValidAccessToken = async (userId) => {
  const tokenRecord = await prisma.hmrcToken.findUnique({
    where: { userId },
  });

  if (!tokenRecord) {
    throw new Error(`No HMRC token found for user ${userId}. User must reconnect.`);
  }

  // If token is still valid, return it directly
  if (!isTokenExpired(tokenRecord.expiresAt)) {
    return tokenRecord.accessToken;
  }

  // Token is expired — refresh it
  console.log(`[TokenStore] Access token expired for user ${userId}, refreshing...`);

  try {
    const newTokens = await refreshAccessToken(tokenRecord.refreshToken);

    // Save the new tokens (HMRC issues a new refresh token each time)
    await saveTokens(userId, newTokens);

    console.log(`[TokenStore] Token refreshed successfully for user ${userId}`);
    return newTokens.accessToken;

  } catch (err) {
    console.error(`[TokenStore] Token refresh failed for user ${userId}:`, err.message);
    throw new Error('HMRC session expired. User must reconnect their HMRC account.');
  }
};

/**
 * Check if a user has connected their HMRC account
 * @param {string} userId
 * @returns {boolean}
 */
const isHmrcConnected = async (userId) => {
  const token = await prisma.hmrcToken.findUnique({ where: { userId } });
  return !!token;
};

/**
 * Remove HMRC tokens (disconnect)
 * @param {string} userId
 */
const removeTokens = async (userId) => {
  await prisma.hmrcToken.deleteMany({ where: { userId } });
};

module.exports = { saveTokens, getValidAccessToken, isHmrcConnected, removeTokens };
