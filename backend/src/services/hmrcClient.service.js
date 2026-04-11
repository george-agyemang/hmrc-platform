// src/services/hmrcClient.service.js
// Authenticated HMRC API client.
// Automatically injects the Bearer token and fraud prevention headers
// on every request — never call HMRC APIs directly, always use this.

const axios = require('axios');
const { hmrcConfig } = require('../config/hmrc');
const { getValidAccessToken } = require('./tokenStore.service');
const { buildFraudPreventionHeaders } = require('../middleware/fraudPrevention');

/**
 * Create an authenticated Axios instance for a given user.
 * Fetches and refreshes tokens automatically.
 *
 * @param {string} userId - Platform user ID
 * @param {Object} req - Express request (for fraud prevention headers)
 * @returns {AxiosInstance}
 */
const createHmrcClient = async (userId, req) => {
  const accessToken = await getValidAccessToken(userId);
  const fraudHeaders = buildFraudPreventionHeaders(req);

  return axios.create({
    baseURL: hmrcConfig.baseUrl,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.hmrc.1.0+json',
      ...fraudHeaders,
    },
  });
};

/**
 * Make a GET request to HMRC API
 */
const hmrcGet = async (userId, req, path) => {
  const client = await createHmrcClient(userId, req);
  const response = await client.get(path);
  return response.data;
};

/**
 * Make a POST request to HMRC API
 */
const hmrcPost = async (userId, req, path, data) => {
  const client = await createHmrcClient(userId, req);
  const response = await client.post(path, data);
  return response.data;
};

module.exports = { createHmrcClient, hmrcGet, hmrcPost };
