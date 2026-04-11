// src/routes/businesses.js
// Manage the businesses/clients attached to a user's account

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const prisma = require('../config/db');

/**
 * GET /businesses
 * List all businesses for the logged-in user
 */
router.get('/', requireAuth, async (req, res) => {
  const businesses = await prisma.business.findMany({
    where: { userId: req.user.userId },
    include: {
      _count: { select: { submissions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(businesses);
});

/**
 * POST /businesses
 * Register a new business
 */
router.post('/', requireAuth, async (req, res) => {
  const { businessName, businessType, status, vrn, utr, crn } = req.body;

  if (!businessName || !businessType) {
    return res.status(400).json({ error: 'businessName and businessType are required.' });
  }

  const validTypes = ['SOLE_TRADER', 'LIMITED_COMPANY', 'PARTNERSHIP'];
  if (!validTypes.includes(businessType)) {
    return res.status(400).json({ error: `businessType must be one of: ${validTypes.join(', ')}` });
  }

  try {
    const business = await prisma.business.create({
      data: {
        userId: req.user.userId,
        businessName,
        businessType,
        status: status || 'ACTIVE',
        vrn: vrn || null,
        utr: utr || null,
        crn: crn || null,
      },
    });
    res.status(201).json(business);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'A business with this VRN, UTR or CRN already exists.' });
    }
    res.status(500).json({ error: 'Failed to create business.' });
  }
});

/**
 * PUT /businesses/:id
 * Update a business record
 */
router.put('/:id', requireAuth, async (req, res) => {
  const business = await prisma.business.findFirst({
    where: { id: req.params.id, userId: req.user.userId },
  });

  if (!business) return res.status(404).json({ error: 'Business not found.' });

  const { businessName, status, vrn, utr, crn } = req.body;

  const updated = await prisma.business.update({
    where: { id: req.params.id },
    data: { businessName, status, vrn, utr, crn },
  });

  res.json(updated);
});

/**
 * GET /businesses/:id
 * Get a single business with recent submissions
 */
router.get('/:id', requireAuth, async (req, res) => {
  const business = await prisma.business.findFirst({
    where: { id: req.params.id, userId: req.user.userId },
    include: {
      submissions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!business) return res.status(404).json({ error: 'Business not found.' });

  res.json(business);
});

module.exports = router;
