// src/routes/submissions.js
// Routes for looking up obligations and making submissions

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const prisma = require('../config/db');
const { getOutstandingVatObligations } = require('../services/obligations.service');
const {
  submitNilVatReturn,
  submitDormantCtReturn,
  getSubmissions,
} = require('../services/submission.service');

// ─── Obligations ──────────────────────────────────────────────────────────────

/**
 * GET /submissions/obligations/vat/:businessId
 * Fetch outstanding VAT obligations for a business from HMRC
 */
router.get('/obligations/vat/:businessId', requireAuth, async (req, res) => {
  try {
    const business = await prisma.business.findFirst({
      where: { id: req.params.businessId, userId: req.user.userId },
    });

    if (!business) return res.status(404).json({ error: 'Business not found.' });
    if (!business.vrn) return res.status(400).json({ error: 'Business has no VAT Registration Number.' });

    const obligations = await getOutstandingVatObligations(req.user.userId, req, business.vrn);

    res.json({ obligations });
  } catch (err) {
    console.error('[Obligations] VAT fetch failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Submissions ──────────────────────────────────────────────────────────────

/**
 * POST /submissions/vat/nil
 * Submit a nil VAT return for a business
 *
 * Body: { businessId, periodKey, periodStart, periodEnd }
 */
router.post('/vat/nil', requireAuth, async (req, res) => {
  const { businessId, periodKey, periodStart, periodEnd } = req.body;

  if (!businessId || !periodKey || !periodStart || !periodEnd) {
    return res.status(400).json({
      error: 'businessId, periodKey, periodStart, and periodEnd are required.',
    });
  }

  try {
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: req.user.userId },
    });

    if (!business) return res.status(404).json({ error: 'Business not found.' });
    if (!business.vrn) return res.status(400).json({ error: 'Business has no VAT Registration Number.' });

    // Check for duplicate submission
    const existing = await prisma.submission.findFirst({
      where: {
        businessId,
        periodKey,
        taxType: 'VAT',
        status: { in: ['ACCEPTED', 'SUBMITTED'] },
      },
    });

    if (existing) {
      return res.status(409).json({
        error: 'A nil VAT return for this period has already been submitted.',
        submissionId: existing.id,
      });
    }

    const submission = await submitNilVatReturn(
      req.user.userId,
      req,
      businessId,
      business.vrn,
      periodKey,
      periodStart,
      periodEnd
    );

    res.status(201).json({
      message: 'Nil VAT return submitted successfully.',
      submission,
    });

  } catch (err) {
    console.error('[Submissions] Nil VAT failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /submissions/ct/dormant
 * Submit a dormant company CT return
 *
 * Body: { businessId, periodStart, periodEnd }
 */
router.post('/ct/dormant', requireAuth, async (req, res) => {
  const { businessId, periodStart, periodEnd } = req.body;

  if (!businessId || !periodStart || !periodEnd) {
    return res.status(400).json({ error: 'businessId, periodStart, and periodEnd are required.' });
  }

  try {
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: req.user.userId },
    });

    if (!business) return res.status(404).json({ error: 'Business not found.' });
    if (!business.crn || !business.utr) {
      return res.status(400).json({ error: 'Business must have both a CRN and UTR for Corporation Tax.' });
    }

    const submission = await submitDormantCtReturn(
      req.user.userId,
      req,
      businessId,
      business,
      periodStart,
      periodEnd
    );

    res.status(201).json({
      message: 'Dormant CT return submitted successfully.',
      submission,
    });

  } catch (err) {
    console.error('[Submissions] Dormant CT failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /submissions/:businessId
 * Get submission history for a business
 */
router.get('/:businessId', requireAuth, async (req, res) => {
  try {
    const business = await prisma.business.findFirst({
      where: { id: req.params.businessId, userId: req.user.userId },
    });

    if (!business) return res.status(404).json({ error: 'Business not found.' });

    const submissions = await getSubmissions(req.params.businessId);
    res.json({ submissions });

  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submissions.' });
  }
});

/**
 * GET /submissions/receipt/:submissionId
 * Get details of a single submission
 */
router.get('/receipt/:submissionId', requireAuth, async (req, res) => {
  try {
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.submissionId },
      include: { business: true },
    });

    if (!submission || submission.business.userId !== req.user.userId) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    res.json(submission);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submission.' });
  }
});

module.exports = router;
