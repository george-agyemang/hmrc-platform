// src/services/obligations.service.js
// Fetches filing obligations from HMRC — what's due and when.
// Supports VAT and ITSA obligation lookups.

const { hmrcGet } = require('./hmrcClient.service');

/**
 * Get VAT obligations for a business (what periods are due to be filed)
 *
 * @param {string} userId - Platform user ID (for token lookup)
 * @param {Object} req - Express request (for fraud headers)
 * @param {string} vrn - VAT Registration Number
 * @param {string} from - Date string YYYY-MM-DD
 * @param {string} to - Date string YYYY-MM-DD
 * @param {string} status - 'O' (open/outstanding) or 'F' (fulfilled)
 * @returns {Array} Array of obligation periods
 */
const getVatObligations = async (userId, req, vrn, from, to, status = 'O') => {
  const path = `/organisations/vat/${vrn}/obligations?from=${from}&to=${to}&status=${status}`;

  const data = await hmrcGet(userId, req, path);

  // Normalise the HMRC response into a cleaner shape
  return (data.obligations || []).map((ob) => ({
    periodKey: ob.periodKey,
    start: ob.start,
    end: ob.end,
    due: ob.due,
    status: ob.status, // 'O' = outstanding, 'F' = fulfilled
    received: ob.received || null,
  }));
};

/**
 * Get ITSA (Income Tax Self Assessment) obligations
 * Used for sole traders and landlords
 *
 * @param {string} userId
 * @param {Object} req
 * @param {string} nino - National Insurance Number
 * @param {string} taxYear - e.g. "2023-24"
 * @returns {Array} Obligations
 */
const getItsaObligations = async (userId, req, nino, taxYear) => {
  const path = `/individuals/self-assessment/obligations/${nino}/${taxYear}`;

  const data = await hmrcGet(userId, req, path);

  return (data.obligations || []).map((ob) => ({
    periodKey: ob.periodKey,
    start: ob.start,
    end: ob.end,
    due: ob.due,
    status: ob.status,
  }));
};

/**
 * Helper: Get current and next VAT obligation periods
 * Returns only open obligations, sorted by due date
 *
 * @param {string} userId
 * @param {Object} req
 * @param {string} vrn
 * @returns {Array}
 */
const getOutstandingVatObligations = async (userId, req, vrn) => {
  // Look back 1 year and forward 1 year
  const from = new Date();
  from.setFullYear(from.getFullYear() - 1);

  const to = new Date();
  to.setFullYear(to.getFullYear() + 1);

  const obligations = await getVatObligations(
    userId,
    req,
    vrn,
    from.toISOString().split('T')[0],
    to.toISOString().split('T')[0],
    'O'
  );

  // Sort by due date ascending (most urgent first)
  return obligations.sort((a, b) => new Date(a.due) - new Date(b.due));
};

module.exports = {
  getVatObligations,
  getItsaObligations,
  getOutstandingVatObligations,
};
