// src/middleware/fraudPrevention.js
// HMRC requires specific fraud prevention headers on ALL API calls
// https://developer.service.hmrc.gov.uk/guides/fraud-prevention/

const { v4: uuidv4 } = require('uuid');

/**
 * Builds the required HMRC fraud prevention headers.
 * These headers provide device/session context to HMRC for fraud detection.
 * They are MANDATORY - submissions will be rejected without them.
 *
 * @param {Object} req - Express request object
 * @param {string} connectionMethod - 'WEB_APP_VIA_SERVER' or 'MOBILE_APP_DIRECT'
 * @returns {Object} Headers object to merge into your HMRC API request
 */
const buildFraudPreventionHeaders = (req, connectionMethod = 'WEB_APP_VIA_SERVER') => {
  const now = new Date().toISOString();
  const requestId = uuidv4();

  // Extract real client IP (handles proxies/load balancers)
  const clientIp =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket.remoteAddress ||
    '0.0.0.0';

  return {
    // How the user is interacting with your service
    'Gov-Client-Connection-Method': connectionMethod,

    // Unique identifier for this specific request
    'Gov-Client-Device-ID': requestId,

    // Timezone of the originating device
    'Gov-Client-Timezone': 'UTC+00:00',

    // The IP address of the client device
    'Gov-Client-Public-IP': clientIp,

    // Port used by client (best effort)
    'Gov-Client-Public-Port': req.socket.remotePort?.toString() || '443',

    // Your vendor/application information
    // Update these with your actual platform details
    'Gov-Vendor-Version': encodeURIComponent('hmrc-platform=1.0.0'),
    'Gov-Vendor-License-IDs': '',  // Leave blank unless you have a license

    // The local IP addresses of the originating device
    'Gov-Client-Local-IPs': clientIp,
    'Gov-Client-Local-IPs-Timestamp': now,

    // Public IP timestamp
    'Gov-Client-Public-IP-Timestamp': now,

    // User agent string from the browser/device
    'Gov-Client-Browser-Plugins': '',
    'Gov-Client-Browser-JS-User-Agent': req.headers['user-agent'] || '',
    'Gov-Client-Browser-Do-Not-Track': req.headers['dnt'] || '1',

    // Screen info (sent from frontend via your API, placeholder here)
    'Gov-Client-Screens': 'width=1920&height=1080&scaling-factor=1&colour-depth=24',

    // Windows info - not applicable for web
    'Gov-Client-Window-Size': 'width=1280&height=800',

    // Unique request ID for audit trail
    'Gov-Client-Request-ID': requestId,
  };
};

/**
 * Express middleware that attaches fraud prevention header builder to req
 * so it can be used in route handlers when calling HMRC APIs
 */
const fraudPreventionMiddleware = (req, res, next) => {
  req.buildFraudHeaders = (connectionMethod) =>
    buildFraudPreventionHeaders(req, connectionMethod);
  next();
};

module.exports = { fraudPreventionMiddleware, buildFraudPreventionHeaders };
