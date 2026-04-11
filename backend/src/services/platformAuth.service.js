// src/services/platformAuth.service.js
// Handles your PLATFORM's own user auth (separate from HMRC OAuth).
// Users log into YOUR platform first, then connect their HMRC account.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const SALT_ROUNDS = 12;

/**
 * Register a new user on the platform
 * @param {string} email
 * @param {string} password
 * @param {string} name
 * @returns {Object} { user, token }
 */
const registerUser = async (email, password, name) => {
  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error('An account with this email already exists.');
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { email, name, passwordHash: hashedPassword },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  const token = generateJwt(user);
  return { user, token };
};

/**
 * Log in an existing user
 * @param {string} email
 * @param {string} password
 * @returns {Object} { user, token }
 */
const loginUser = async (email, password) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    throw new Error('Invalid email or password.');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid email or password.');
  }

  const token = generateJwt(user);

  return {
    user: { id: user.id, email: user.email, name: user.name },
    token,
  };
};

/**
 * Generate a signed JWT for platform sessions
 */
const generateJwt = (user) => {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '7d' }
  );
};

/**
 * Verify a JWT and return the payload
 */
const verifyJwt = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = { registerUser, loginUser, verifyJwt };
