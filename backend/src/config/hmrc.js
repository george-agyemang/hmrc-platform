// src/config/hmrc.js
// Central config for all HMRC API settings

const hmrcConfig = {
  clientId: process.env.HMRC_CLIENT_ID,
  clientSecret: process.env.HMRC_CLIENT_SECRET,
  redirectUri: process.env.HMRC_REDIRECT_URI,

  baseUrl: process.env.HMRC_API_BASE_URL || 'https://test-api.service.hmrc.gov.uk',
  authUrl: process.env.HMRC_AUTH_URL || 'https://test-api.service.hmrc.gov.uk/oauth/authorize',
  tokenUrl: process.env.HMRC_TOKEN_URL || 'https://test-api.service.hmrc.gov.uk/oauth/token',

  // OAuth scopes per tax type
  scopes: {
    VAT: 'read:vat write:vat',
    ITSA: 'read:self-assessment write:self-assessment',
    CORP_TAX: 'read:corporation-tax-returns write:corporation-tax-returns',
  },

  // All scopes combined for full access
  get allScopes() {
    return Object.values(this.scopes).join(' ');
  },
};

// Validate critical config on startup
const validateConfig = () => {
  const required = ['clientId', 'clientSecret', 'redirectUri'];
  const missing = required.filter((key) => !hmrcConfig[key]);
  if (missing.length > 0) {
    throw new Error(`Missing HMRC config: ${missing.join(', ')}. Check your .env file.`);
  }
};

module.exports = { hmrcConfig, validateConfig };
