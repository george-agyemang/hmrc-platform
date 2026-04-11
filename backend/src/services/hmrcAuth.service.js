// src/services/hmrcAuth.service.js
// Handles all HMRC OAuth 2.0 operations

const axios = require('axios');
const { hmrcConfig } = require('../config/hmrc');

/**
 * Build the HMRC authorization URL to redirect users to
 * @param {string} state - A unique, random value to prevent CSRF attacks
 * @param {string} scope - Space-separated OAuth scopes
 * @returns {string} The full HMRC authorization URL
 */
const buildAuthUrl = (state, scope = hmrcConfig.allScopes) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: hmrcConfig.clientId,
    scope,
    state,
    redirect_uri: hmrcConfig.redirectUri,
  });

  return `${hmrcConfig.authUrl}?${params.toString()}`;
};

/**
 * Exchange an authorization code for access + refresh tokens
 * @param {string} code - The authorization code from HMRC callback
 * @returns {Object} Token response: { accessToken, refreshToken, expiresIn, scope }
 */
const exchangeCodeForTokens = async (code) => {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: hmrcConfig.clientId,
    client_secret: hmrcConfig.clientSecret,
    code,
    redirect_uri: hmrcConfig.redirectUri,
  });

  const response = await axios.post(hmrcConfig.tokenUrl, params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const { access_token, refresh_token, expires_in, scope } = response.data;

  return {
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresIn: expires_in,  // seconds until expiry (typically 14400 = 4 hours)
    scope,
    expiresAt: new Date(Date.now() + expires_in * 1000),
  };
};

/**
 * Refresh an expired access token using the refresh token
 * HMRC refresh tokens are long-lived (18 months)
 * @param {string} refreshToken - The stored refresh token
 * @returns {Object} New token data
 */
const refreshAccessToken = async (refreshToken) => {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: hmrcConfig.clientId,
    client_secret: hmrcConfig.clientSecret,
    refresh_token: refreshToken,
  });

  const response = await axios.post(hmrcConfig.tokenUrl, params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const { access_token, refresh_token, expires_in, scope } = response.data;

  return {
    accessToken: access_token,
    refreshToken: refresh_token,  // HMRC issues a new refresh token each time
    expiresIn: expires_in,
    scope,
    expiresAt: new Date(Date.now() + expires_in * 1000),
  };
};

/**
 * Check if a stored token is expired (with 5 minute buffer)
 * @param {Date} expiresAt
 * @returns {boolean}
 */
const isTokenExpired = (expiresAt) => {
  const bufferMs = 5 * 60 * 1000; // 5 minute buffer
  return new Date(expiresAt).getTime() - bufferMs < Date.now();
};

module.exports = {
  buildAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  isTokenExpired,
};
