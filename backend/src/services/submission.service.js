// src/services/submission.service.js
// Builds and submits nil/dormant returns to HMRC.
// Each submission is recorded in the database for audit trail.

const { hmrcPost } = require('./hmrcClient.service');
const prisma = require('../config/db');

// ─── Payload Builders ─────────────────────────────────────────────────────────

/**
 * Build a nil VAT return payload (all boxes = 0)
 * HMRC MTD VAT API v1.0 schema
 *
 * @param {string} periodKey - From the obligations API e.g. "23AA"
 * @param {boolean} finalised - Must be true to submit (prevents accidental sends)
 * @returns {Object} HMRC-compatible VAT return payload
 */
const buildNilVatReturn = (periodKey, finalised = true) => ({
  periodKey,
  vatDueSales: 0,               // Box 1
  vatDueAcquisitions: 0,        // Box 2
  totalVatDue: 0,               // Box 3 (= Box 1 + Box 2)
  vatReclaimedCurrPeriod: 0,    // Box 4
  netVatDue: 0,                 // Box 5 (= abs(Box 3 - Box 4))
  totalValueSalesExVAT: 0,      // Box 6
  totalValuePurchasesExVAT: 0,  // Box 7
  totalValueGoodsSuppliedExVAT: 0, // Box 8
  totalAcquisitionsExVAT: 0,    // Box 9
  finalised,
});

/**
 * Build a dormant company CT600 payload.
 * NOTE: Corporation Tax MTD API is still in development by HMRC.
 * This payload follows the expected schema based on HMRC's draft spec.
 * Verify against https://developer.service.hmrc.gov.uk when CT goes live.
 *
 * @param {string} crn - Company Registration Number
 * @param {string} utr - Unique Taxpayer Reference
 * @param {string} periodStart - YYYY-MM-DD
 * @param {string} periodEnd - YYYY-MM-DD
 * @returns {Object}
 */
const buildDormantCtReturn = (crn, utr, periodStart, periodEnd) => ({
  companyRegistrationNumber: crn,
  utr,
  accountingPeriodStartDate: periodStart,
  accountingPeriodEndDate: periodEnd,
  companyIsDormant: true,
  companysProfit: 0,
  totalCorporationTaxChargeable: 0,
  corporationTaxOutstanding: 0,
  finalised: true,
});

// ─── Submission Functions ─────────────────────────────────────────────────────

/**
 * Submit a nil VAT return to HMRC and record it in the database
 *
 * @param {string} userId - Platform user ID (for token lookup)
 * @param {Object} req - Express request (for fraud headers)
 * @param {string} businessId - Platform business ID
 * @param {string} vrn - VAT Registration Number
 * @param {string} periodKey - From obligations API
 * @param {string} periodStart - YYYY-MM-DD
 * @param {string} periodEnd - YYYY-MM-DD
 * @returns {Object} Submission record
 */
const submitNilVatReturn = async (userId, req, businessId, vrn, periodKey, periodStart, periodEnd) => {
  const payload = buildNilVatReturn(periodKey);

  // Create a pending record before sending (audit trail)
  const submission = await prisma.submission.create({
    data: {
      businessId,
      taxType: 'VAT',
      periodKey,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      submissionType: 'NIL',
      status: 'PENDING',
      payload,
    },
  });

  try {
    // Submit to HMRC
    const hmrcResponse = await hmrcPost(
      userId,
      req,
      `/organisations/vat/${vrn}/returns`,
      payload
    );

    // Update record with HMRC's confirmation
    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: 'ACCEPTED',
        hmrcReceiptId: hmrcResponse.formBundleNumber,
        hmrcResponse,
        submittedAt: new Date(),
      },
    });

    console.log(`[Submission] Nil VAT submitted. Receipt: ${hmrcResponse.formBundleNumber}`);
    return updated;

  } catch (err) {
    const errorData = err.response?.data || { message: err.message };

    // Record the failure
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: 'REJECTED',
        hmrcResponse: errorData,
      },
    });

    console.error('[Submission] VAT submission failed:', errorData);
    throw new Error(errorData.message || 'HMRC rejected the submission.');
  }
};

/**
 * Submit a dormant company return to HMRC
 *
 * @param {string} userId
 * @param {Object} req
 * @param {string} businessId
 * @param {Object} business - { crn, utr }
 * @param {string} periodStart
 * @param {string} periodEnd
 * @returns {Object} Submission record
 */
const submitDormantCtReturn = async (userId, req, businessId, business, periodStart, periodEnd) => {
  const payload = buildDormantCtReturn(business.crn, business.utr, periodStart, periodEnd);

  const submission = await prisma.submission.create({
    data: {
      businessId,
      taxType: 'CORP_TAX',
      periodKey: `${periodStart}_${periodEnd}`,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      submissionType: 'DORMANT',
      status: 'PENDING',
      payload,
    },
  });

  try {
    const hmrcResponse = await hmrcPost(
      userId,
      req,
      `/organisations/corporation-tax/${business.utr}/return`,
      payload
    );

    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: 'ACCEPTED',
        hmrcReceiptId: hmrcResponse.formBundleNumber,
        hmrcResponse,
        submittedAt: new Date(),
      },
    });

    console.log(`[Submission] Dormant CT submitted. Receipt: ${hmrcResponse.formBundleNumber}`);
    return updated;

  } catch (err) {
    const errorData = err.response?.data || { message: err.message };

    await prisma.submission.update({
      where: { id: submission.id },
      data: { status: 'REJECTED', hmrcResponse: errorData },
    });

    throw new Error(errorData.message || 'HMRC rejected the dormant CT submission.');
  }
};

/**
 * Get submission history for a business
 */
const getSubmissions = async (businessId, limit = 20) => {
  return prisma.submission.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
};

module.exports = {
  buildNilVatReturn,
  buildDormantCtReturn,
  submitNilVatReturn,
  submitDormantCtReturn,
  getSubmissions,
};
