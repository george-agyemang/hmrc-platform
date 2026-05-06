import { Router } from 'itty-router';
const router = Router();

// ── CORS ──────────────────────────────────────────────────────
const cors = (req) => ({
  'Access-Control-Allow-Origin': req?.headers?.get('Origin') || 'https://nserewa.pages.dev',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Hmrc-Client-Data',
  'Access-Control-Allow-Credentials': 'true',
});
const json = (data, status = 200, req) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors(req) } });
const err = (msg, status = 400, req) => json({ error: msg }, status, req);

// ── Password hashing (hex, deterministic) ─────────────────────
const hashPassword = async (password) => {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// ── JWT (simple, no library) ──────────────────────────────────
const signJwt = async (payload, secret) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '');
  const body = btoa(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 604800 })).replace(/=/g, '');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${body}.${sigB64}`;
};

const verifyJwt = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
};

const getSession = (req) => {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  return verifyJwt(token);
};

// ── Supabase helpers ──────────────────────────────────────────
const dbRead = (env, table, query = '') => fetch(`${env.SUPABASE_URL}/rest/v1/${table}${query}`, {
  headers: { 'apikey': env.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}` },
});

const dbWrite = (env, table, body, method = 'POST') => fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
  method,
  headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Prefer': 'return=representation' },
  body: JSON.stringify(body),
});

// ── Routes ────────────────────────────────────────────────────
router.options('*', (req) => new Response(null, { status: 204, headers: cors(req) }));
router.get('/health', (req) => json({ status: 'ok' }, 200, req));

// TEMP TEST ROUTE — remove before production
router.post('/submissions/vat/test-save', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const { businessId } = await req.json();
  const now = new Date().toISOString();
  const sub = {
    id: crypto.randomUUID(), businessId, taxType: 'VAT', submissionType: 'FULL',
    periodKey: 'TEST', periodStart: '2024-01-01', periodEnd: '2024-03-31',
    status: 'ACCEPTED', hmrcReceiptId: 'TEST-' + Date.now(),
    payload: { test: true, vatDueSales: 100 },
    hmrcResponse: { formBundleNumber: 'TEST', processingDate: now },
    submittedAt: now, createdAt: now, updatedAt: now,
  };
  const saveRes = await dbWrite(env, 'Submission', sub);
  if (!saveRes.ok) {
    const e = await saveRes.text();
    console.error('Test save error:', e);
    return err('Save failed: ' + e, 500, req);
  }
  return json({ message: 'Test save succeeded', submission: sub }, 201, req);
});

// Register
router.post('/users/register', async (req, env) => {
  try {
    const body = await req.json();
    const { email, password, name } = body;
    if (!email || !password) return err('Email and password required', 400, req);
    if (password.length < 8) return err('Password must be at least 8 characters', 400, req);

    // Check existing
    const checkRes = await dbRead(env, 'User', `?email=eq.${encodeURIComponent(email)}&select=id`);
    const existing = await checkRes.json();
    if (existing.length > 0) return err('An account with this email already exists.', 400, req);

    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const res = await dbWrite(env, 'User', { id, email, name: name || '', passwordHash, createdAt: now, updatedAt: now });
    if (!res.ok) {
      const e = await res.text();
      console.error('Register DB error:', e);
      return err('Registration failed', 500, req);
    }

    const user = (await res.json())[0];
    const token = await signJwt({ userId: user.id, email: user.email }, env.JWT_SECRET);
    return json({ user: { id: user.id, email: user.email, name: user.name }, token }, 201, req);
  } catch (e) {
    console.error('Register error:', e.message);
    return err('Registration failed', 500, req);
  }
});

// Login
router.post('/users/login', async (req, env) => {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return err('Email and password required', 400, req);

    const res = await dbRead(env, 'User', `?email=eq.${encodeURIComponent(email)}&select=*&limit=1`);
    const users = await res.json();
    if (!users || users.length === 0) return err('Invalid email or password', 401, req);

    const user = users[0];
    const passwordHash = await hashPassword(password);

    console.log('Login attempt:', email);
    console.log('Stored hash:', user.passwordHash?.substring(0, 10));
    console.log('Computed hash:', passwordHash?.substring(0, 10));

    if (passwordHash !== user.passwordHash) return err('Invalid email or password', 401, req);

    if (user.mfaEnabled) {
      const mfaToken = await signJwt({ userId: user.id, email: user.email, mfaPending: true }, env.JWT_SECRET, 300);
      return json({ mfaRequired: true, mfaToken }, 200, req);
    }

    const token = await signJwt({ userId: user.id, email: user.email }, env.JWT_SECRET);
    return json({ user: { id: user.id, email: user.email, name: user.name }, token }, 200, req);
  } catch (e) {
    console.error('Login error:', e.message);
    return err('Login failed', 500, req);
  }
});

// Me
router.get('/users/me', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const res = await dbRead(env, 'User', `?id=eq.${session.userId}&select=id,email,name,createdAt&limit=1`);
  const users = await res.json();
  if (!users[0]) return err('User not found', 404, req);
  return json({ ...users[0], hmrcConnected: !!session.hmrcConnected }, 200, req);
});

// Logout
router.post('/users/logout', (req) => json({ success: true }, 200, req));

// Auth status
router.get('/auth/status', (req, env) => {
  const session = getSession(req);
  if (!session) return json({ connected: false }, 200, req);
  return json({ connected: true, userId: session.userId, hmrcConnected: !!session.hmrcConnected }, 200, req);
});

// HMRC OAuth - encode userId in state
router.get('/auth/hmrc', (req, env) => {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  if (!userId) return err('userId required', 400, req);
  const state = btoa(JSON.stringify({ userId, nonce: crypto.randomUUID() }));
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.HMRC_CLIENT_ID,
    scope: 'read:vat write:vat read:self-assessment write:self-assessment',
    state,
    redirect_uri: env.HMRC_REDIRECT_URI,
  });
  return new Response(null, { status: 302, headers: { Location: `${env.HMRC_AUTH_URL}?${params}` } });
});

// HMRC Callback
router.get('/auth/callback', async (req, env) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const frontendUrl = env.FRONTEND_URL || 'https://nserewa.pages.dev';

  let userId;
  try {
    const stateData = JSON.parse(atob(state));
    userId = stateData.userId;
    if (!userId) throw new Error('No userId');
  } catch {
    return new Response(null, { status: 302, headers: { Location: `${frontendUrl}/auth/error?reason=invalid_state` } });
  }

  try {
    const tokenRes = await fetch(env.HMRC_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: env.HMRC_CLIENT_ID, client_secret: env.HMRC_CLIENT_SECRET, code, redirect_uri: env.HMRC_REDIRECT_URI }),
    });
    const tokens = await tokenRes.json();
    console.error('HMRC token response:', JSON.stringify(tokens));
    if (!tokens.access_token) throw new Error('No access token: ' + JSON.stringify(tokens));

    // Save HMRC tokens to DB
    const now = new Date().toISOString();
    const existingToken = await dbRead(env, 'HmrcToken', `?userId=eq.${userId}&select=id`);
    const existingData = await existingToken.json();

    if (existingData.length > 0) {
      await fetch(`${env.SUPABASE_URL}/rest/v1/HmrcToken?userId=eq.${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` },
        body: JSON.stringify({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token || '', scope: tokens.scope || '', expiresAt: new Date(Date.now() + (tokens.expires_in || 14400) * 1000).toISOString(), updatedAt: now }),
      });
    } else {
      await dbWrite(env, 'HmrcToken', { id: crypto.randomUUID(), userId, accessToken: tokens.access_token, refreshToken: tokens.refresh_token || '', scope: tokens.scope || '', expiresAt: new Date(Date.now() + (tokens.expires_in || 14400) * 1000).toISOString(), createdAt: now, updatedAt: now });
    }

    const platformToken = await signJwt({ userId, hmrcConnected: true }, env.JWT_SECRET);
    return new Response(null, { status: 302, headers: { Location: `${frontendUrl}/auth/success?token=${encodeURIComponent(platformToken)}` } });
  } catch (e) {
    console.error('Callback error:', e.message);
    return new Response(null, { status: 302, headers: { Location: `${frontendUrl}/auth/error?reason=token_exchange_failed` } });
  }
});

// Businesses
router.get('/businesses', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const res = await dbRead(env, 'Business', `?userId=eq.${session.userId}&order=createdAt.desc`);
  return json(await res.json(), 200, req);
});

router.post('/businesses', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const { businessName, businessType, status, vrn, utr, crn, nino } = await req.json();
  if (!businessName || !businessType) return err('businessName and businessType required', 400, req);
  const now = new Date().toISOString();
  const res = await dbWrite(env, 'Business', { id: crypto.randomUUID(), userId: session.userId, businessName, businessType, status: status || 'ACTIVE', vrn: vrn || null, utr: utr || null, crn: crn || null, nino: nino || null, createdAt: now, updatedAt: now });
  if (!res.ok) {
    const errText = await res.text();
    console.error('Business create error:', errText);
    return err('Failed to create business: ' + errText, 500, req);
  }
  return json((await res.json())[0], 201, req);
});

// HMRC Business Details lookup by NINO — MUST be before /businesses/:id
router.get('/businesses/hmrc/details/:nino', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const hmrcRes = await fetch(`${env.HMRC_API_BASE_URL}/individuals/business/details/${req.params.nino}/list`, {
    headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Accept': 'application/vnd.hmrc.2.0+json', ...buildFraudHeaders(req) },
  });
  const data = await hmrcRes.json();
  if (!hmrcRes.ok) return err(data.message || 'HMRC lookup failed', hmrcRes.status, req);
  return json(data, 200, req);
});

router.get('/businesses/:id', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const res = await dbRead(env, 'Business', `?id=eq.${req.params.id}&userId=eq.${session.userId}&limit=1`);
  const biz = (await res.json())[0];
  if (!biz) return err('Business not found', 404, req);
  return json(biz, 200, req);
});

// Submissions
router.get('/submissions/obligations/vat/:businessId', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const bizRes = await dbRead(env, 'Business', `?id=eq.${req.params.businessId}&userId=eq.${session.userId}&select=vrn&limit=1`);
  const biz = (await bizRes.json())[0];
  if (!biz?.vrn) return err('Business not found or no VRN', 404, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const from = new Date(); from.setFullYear(from.getFullYear() - 1);
  const to = new Date(); to.setFullYear(to.getFullYear() + 1);
  const hmrcRes = await fetch(`${env.HMRC_API_BASE_URL}/organisations/vat/${biz.vrn}/obligations?from=${from.toISOString().split('T')[0]}&to=${to.toISOString().split('T')[0]}&status=O`, {
    headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Accept': 'application/vnd.hmrc.1.0+json', ...buildFraudHeaders(req) },
  });
  const data = await hmrcRes.json();
  return json({ obligations: data.obligations || [] }, 200, req);
});

router.post('/submissions/vat/nil', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const { businessId, periodKey, periodStart, periodEnd } = await req.json();
  const bizRes = await dbRead(env, 'Business', `?id=eq.${businessId}&userId=eq.${session.userId}&select=vrn&limit=1`);
  const biz = (await bizRes.json())[0];
  if (!biz?.vrn) return err('Business not found or no VRN', 404, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const payload = { periodKey, vatDueSales: 0, vatDueAcquisitions: 0, totalVatDue: 0, vatReclaimedCurrPeriod: 0, netVatDue: 0, totalValueSalesExVAT: 0, totalValuePurchasesExVAT: 0, totalValueGoodsSuppliedExVAT: 0, totalAcquisitionsExVAT: 0, finalised: true };
  const hmrcRes = await fetch(`${env.HMRC_API_BASE_URL}/organisations/vat/${biz.vrn}/returns`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.hmrc.1.0+json', ...buildFraudHeaders(req) }, body: JSON.stringify(payload),
  });
  const hmrcData = await hmrcRes.json();
  const now = new Date().toISOString();
  const sub = { id: crypto.randomUUID(), businessId, taxType: 'VAT', submissionType: 'NIL', periodKey, periodStart, periodEnd, status: hmrcRes.ok ? 'ACCEPTED' : 'REJECTED', hmrcReceiptId: hmrcData.formBundleNumber || null, payload, hmrcResponse: hmrcData, submittedAt: now, createdAt: now, updatedAt: now };
  const saveRes = await dbWrite(env, 'Submission', sub);
  if (!saveRes.ok) { const e = await saveRes.text(); console.error('Nil VAT save error:', e); }
  if (!hmrcRes.ok) return err(hmrcData.message || 'HMRC rejected submission', 400, req);
  return json({ message: 'Nil VAT return submitted', submission: sub }, 201, req);
});

// ── Fraud prevention headers ──────────────────────────────────
const buildFraudHeaders = (req) => {
  let deviceData = {};
  try {
    const raw = req.headers.get('X-Hmrc-Client-Data');
    if (raw) deviceData = JSON.parse(raw);
  } catch { /* ignore */ }

  const { deviceId, timezone, screens, windowSize, userAgent, doNotTrack } = deviceData;
  const now = new Date().toISOString().replace('T', 'T').slice(0, 19) + 'Z';

  return {
    'Gov-Client-Connection-Method': 'WEB_APP_VIA_SERVER',
    'Gov-Client-Device-ID': deviceId || 'unknown',
    'Gov-Client-Timezone': `UTC${timezone || '+00:00'}`,
    'Gov-Client-Screens': screens || 'width=1920&height=1080&scaling-factor=1&colour-depth=24',
    'Gov-Client-Window-Size': windowSize || 'width=1280&height=720',
    'Gov-Client-Browser-JS-User-Agent': userAgent || 'unknown',
    'Gov-Client-Browser-Do-Not-Track': doNotTrack || '0',
    'Gov-Vendor-Version': 'eight-submissions=1.0.0',
    'Gov-Vendor-Product-Name': 'Eight+Submissions',
    'Gov-Client-Public-IP': req.headers.get('CF-Connecting-IP') || 'unknown',
    'Gov-Client-User-IDs': `os=EightSubmissions`,
    'Gov-Client-Local-IPs': '127.0.0.1',
    'Gov-Client-MAC-Addresses': '',
  };
};

// Full 9-box VAT return
router.post('/submissions/vat/full', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const body = await req.json();
  const { businessId, periodKey, periodStart, periodEnd, ...vatBoxes } = body;
  const bizRes = await dbRead(env, 'Business', `?id=eq.${businessId}&userId=eq.${session.userId}&select=vrn&limit=1`);
  const biz = (await bizRes.json())[0];
  if (!biz?.vrn) return err('Business not found or no VRN', 404, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const vatDueSales = Number(vatBoxes.vatDueSales ?? vatBoxes.box1) || 0;
  const vatDueAcquisitions = Number(vatBoxes.vatDueAcquisitions ?? vatBoxes.box2) || 0;
  const vatReclaimedCurrPeriod = Number(vatBoxes.vatReclaimedCurrPeriod ?? vatBoxes.box4) || 0;
  const totalVatDue = Math.round((vatDueSales + vatDueAcquisitions) * 100) / 100;
  const netVatDue = Math.round(Math.abs(totalVatDue - vatReclaimedCurrPeriod) * 100) / 100;
  const payload = {
    periodKey,
    vatDueSales,
    vatDueAcquisitions,
    totalVatDue,
    vatReclaimedCurrPeriod,
    netVatDue,
    totalValueSalesExVAT: Math.round(Number(vatBoxes.totalValueSalesExVAT ?? vatBoxes.box6) || 0),
    totalValuePurchasesExVAT: Math.round(Number(vatBoxes.totalValuePurchasesExVAT ?? vatBoxes.box7) || 0),
    totalValueGoodsSuppliedExVAT: Math.round(Number(vatBoxes.totalValueGoodsSuppliedExVAT ?? vatBoxes.box8) || 0),
    totalAcquisitionsExVAT: Math.round(Number(vatBoxes.totalAcquisitionsExVAT ?? vatBoxes.box9) || 0),
    finalised: true,
  };
  const hmrcRes = await fetch(`${env.HMRC_API_BASE_URL}/organisations/vat/${biz.vrn}/returns`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokens[0].accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.hmrc.1.0+json',
      ...buildFraudHeaders(req),
    },
    body: JSON.stringify(payload),
  });
  const hmrcData = await hmrcRes.json();
  if (!hmrcRes.ok) console.error('HMRC full VAT rejection:', JSON.stringify(hmrcData));
  const now = new Date().toISOString();
  const sub = { id: crypto.randomUUID(), businessId, taxType: 'VAT', submissionType: 'FULL', periodKey, periodStart, periodEnd, status: hmrcRes.ok ? 'ACCEPTED' : 'REJECTED', hmrcReceiptId: hmrcData.formBundleNumber || null, payload, hmrcResponse: hmrcData, submittedAt: now, createdAt: now, updatedAt: now };
  const saveRes = await dbWrite(env, 'Submission', sub);
  if (!saveRes.ok) { const e = await saveRes.text(); console.error('Full VAT save error:', e); }
  if (!hmrcRes.ok) return err(hmrcData.message || 'HMRC rejected submission', 400, req);
  return json({ message: 'VAT return submitted', submission: sub }, 201, req);
});

// ITSA obligations
router.get('/submissions/obligations/itsa/:businessId', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const bizRes = await dbRead(env, 'Business', `?id=eq.${req.params.businessId}&userId=eq.${session.userId}&select=utr,nino&limit=1`);
  const biz = (await bizRes.json())[0];
  if (!biz?.nino) return err('Business not found or no NINO', 404, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const from = new Date(); from.setFullYear(from.getFullYear() - 1);
  const to = new Date(); to.setFullYear(to.getFullYear() + 1);
  const hmrcRes = await fetch(
    `${env.HMRC_API_BASE_URL}/obligations/details/${biz.nino}/income-and-expenditure?from=${from.toISOString().split('T')[0]}&to=${to.toISOString().split('T')[0]}`,
    { headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Accept': 'application/vnd.hmrc.3.0+json', ...buildFraudHeaders(req) } }
  );
  const data = await hmrcRes.json();
  return json({ obligations: data.obligations || [] }, 200, req);
});

// ITSA SE businesses for a client
router.get('/submissions/itsa/businesses/:businessId', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const bizRes = await dbRead(env, 'Business', `?id=eq.${req.params.businessId}&userId=eq.${session.userId}&select=nino&limit=1`);
  const biz = (await bizRes.json())[0];
  if (!biz?.nino) return err('Business not found or no NINO', 404, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const hmrcRes = await fetch(`${env.HMRC_API_BASE_URL}/individuals/business/self-employment/${biz.nino}`, {
    headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Accept': 'application/vnd.hmrc.5.0+json', ...buildFraudHeaders(req) },
  });
  const data = await hmrcRes.json();
  if (!hmrcRes.ok) return err(data.message || 'HMRC lookup failed', hmrcRes.status, req);
  return json(data, 200, req);
});

// ITSA create SE business
router.post('/submissions/itsa/create-se-business/:businessId', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const bizRes = await dbRead(env, 'Business', `?id=eq.${req.params.businessId}&userId=eq.${session.userId}&select=nino,businessName&limit=1`);
  const biz = (await bizRes.json())[0];
  if (!biz?.nino) return err('Business not found or no NINO', 404, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const body = await req.json();
  const hmrcRes = await fetch(`${env.HMRC_API_BASE_URL}/individuals/business/self-employment/${biz.nino}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.hmrc.5.0+json', ...buildFraudHeaders(req) },
    body: JSON.stringify(body),
  });
  const data = await hmrcRes.json();
  if (!hmrcRes.ok) return err(data.message || 'Failed to create SE business', hmrcRes.status, req);
  return json(data, 201, req);
});

// ITSA periodic summary (income/expenses)
router.post('/submissions/itsa/periodic', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const { businessId, selfEmploymentId, fromDate, toDate, incomes, deductions } = await req.json();
  const bizRes = await dbRead(env, 'Business', `?id=eq.${businessId}&userId=eq.${session.userId}&select=nino&limit=1`);
  const biz = (await bizRes.json())[0];
  if (!biz?.nino) return err('Business not found or no NINO', 404, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const payload = { fromDate, toDate, incomes: incomes || {}, deductions: deductions || {} };
  const hmrcRes = await fetch(
    `${env.HMRC_API_BASE_URL}/individuals/business/self-employment/${biz.nino}/${selfEmploymentId}/period`,
    { method: 'POST', headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.hmrc.5.0+json', ...buildFraudHeaders(req) }, body: JSON.stringify(payload) }
  );
  const hmrcData = await hmrcRes.json();
  const now = new Date().toISOString();
  const sub = { id: crypto.randomUUID(), businessId, taxType: 'ITSA', submissionType: 'PERIODIC', periodKey: `${fromDate}_${toDate}`, periodStart: fromDate, periodEnd: toDate, status: hmrcRes.ok ? 'ACCEPTED' : 'REJECTED', hmrcReceiptId: hmrcData.id || null, payload, hmrcResponse: hmrcData, submittedAt: now, createdAt: now, updatedAt: now };
  const saveRes = await dbWrite(env, 'Submission', sub);
  if (!saveRes.ok) { const e = await saveRes.text(); console.error('ITSA periodic save error:', e); }
  if (!hmrcRes.ok) return err(hmrcData.message || 'HMRC rejected periodic submission', 400, req);
  return json({ message: 'Periodic summary submitted', submission: sub }, 201, req);
});

// ITSA trigger calculation
router.post('/submissions/itsa/calculate', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const { businessId, taxYear, finalDeclaration } = await req.json();
  const bizRes = await dbRead(env, 'Business', `?id=eq.${businessId}&userId=eq.${session.userId}&select=nino&limit=1`);
  const biz = (await bizRes.json())[0];
  if (!biz?.nino) return err('Business not found or no NINO', 404, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const hmrcRes = await fetch(`${env.HMRC_API_BASE_URL}/individuals/calculations/${biz.nino}/self-assessment`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.hmrc.8.0+json', ...buildFraudHeaders(req) },
    body: JSON.stringify({ taxYear, finalDeclaration: finalDeclaration || false }),
  });
  const hmrcData = await hmrcRes.json();
  if (!hmrcRes.ok) return err(hmrcData.message || 'Calculation trigger failed', hmrcRes.status, req);
  return json(hmrcData, 200, req);
});

// ITSA get calculation result
router.get('/submissions/itsa/calculate/:businessId/:calculationId', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const bizRes = await dbRead(env, 'Business', `?id=eq.${req.params.businessId}&userId=eq.${session.userId}&select=nino&limit=1`);
  const biz = (await bizRes.json())[0];
  if (!biz?.nino) return err('Business not found or no NINO', 404, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const hmrcRes = await fetch(
    `${env.HMRC_API_BASE_URL}/individuals/calculations/${biz.nino}/self-assessment/${req.params.calculationId}`,
    { headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Accept': 'application/vnd.hmrc.8.0+json', ...buildFraudHeaders(req) } }
  );
  const data = await hmrcRes.json();
  if (!hmrcRes.ok) return err(data.message || 'Failed to get calculation', hmrcRes.status, req);
  return json(data, 200, req);
});

// ITSA crystallise (final declaration)
router.post('/submissions/itsa/crystallise', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const { businessId, taxYear, calculationId } = await req.json();
  const bizRes = await dbRead(env, 'Business', `?id=eq.${businessId}&userId=eq.${session.userId}&select=nino&limit=1`);
  const biz = (await bizRes.json())[0];
  if (!biz?.nino) return err('Business not found or no NINO', 404, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const hmrcRes = await fetch(
    `${env.HMRC_API_BASE_URL}/individuals/calculations/${biz.nino}/self-assessment/${calculationId}/crystallise`,
    { method: 'POST', headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.hmrc.8.0+json', ...buildFraudHeaders(req) }, body: JSON.stringify({ taxYear }) }
  );
  const hmrcData = await hmrcRes.json();
  const now = new Date().toISOString();
  const sub = { id: crypto.randomUUID(), businessId, taxType: 'ITSA', submissionType: 'CRYSTALLISATION', periodKey: taxYear, periodStart: `${taxYear.slice(0,4)}-04-06`, periodEnd: `${taxYear.slice(5)}-04-05`, status: hmrcRes.ok ? 'ACCEPTED' : 'REJECTED', hmrcReceiptId: calculationId, payload: { taxYear, calculationId }, hmrcResponse: hmrcData, submittedAt: now, createdAt: now, updatedAt: now };
  const saveRes = await dbWrite(env, 'Submission', sub);
  if (!saveRes.ok) { const e = await saveRes.text(); console.error('ITSA crystallise save error:', e); }
  if (!hmrcRes.ok) return err(hmrcData.message || 'Crystallisation failed', 400, req);
  return json({ message: 'Final declaration submitted', submission: sub }, 201, req);
});

// Submission history — MUST be last GET /submissions/* route
router.get('/submissions/:businessId', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const res = await dbRead(env, 'Submission', `?businessId=eq.${req.params.businessId}&order=createdAt.desc`);
  return json({ submissions: await res.json() }, 200, req);
});



export default {
  async fetch(request, env, ctx) {
    return router.handle(request, env, ctx);
  },
};

// ── MFA Routes ────────────────────────────────────────────────

// Setup: generate TOTP secret and return QR URI
router.post('/auth/mfa/setup', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  try {
    const { TOTP, Secret } = await import('otpauth');
    const secret = new Secret({ size: 20 });
    const totp = new TOTP({ issuer: 'Eight Submissions', label: session.email, algorithm: 'SHA1', digits: 6, period: 30, secret });
    const uri = totp.toString();
    await fetch(`${env.SUPABASE_URL}/rest/v1/User?id=eq.${session.userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` },
      body: JSON.stringify({ mfaTotpSecret: secret.base32 }),
    });
    return json({ uri, secret: secret.base32 }, 200, req);
  } catch (e) {
    console.error('MFA setup error:', e.message);
    return err('MFA setup failed', 500, req);
  }
});

// Verify setup: confirm code and enable MFA
router.post('/auth/mfa/verify-setup', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  try {
    const { code } = await req.json();
    if (!code) return err('Code required', 400, req);
    const userRes = await dbRead(env, 'User', `?id=eq.${session.userId}&select=mfaTotpSecret&limit=1`);
    const users = await userRes.json();
    if (!users[0]?.mfaTotpSecret) return err('MFA setup not started', 400, req);
    const { TOTP, Secret } = await import('otpauth');
    const totp = new TOTP({ issuer: 'Eight Submissions', label: session.email, algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(users[0].mfaTotpSecret) });
    const delta = totp.validate({ token: code.replace(/\s/g, ''), window: 1 });
    if (delta === null) return err('Invalid code', 401, req);
    await fetch(`${env.SUPABASE_URL}/rest/v1/User?id=eq.${session.userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` },
      body: JSON.stringify({ mfaEnabled: true, mfaType: 'TOTP' }),
    });
    return json({ success: true }, 200, req);
  } catch (e) {
    console.error('MFA verify-setup error:', e.message);
    return err('MFA verification failed', 500, req);
  }
});

// Validate: check TOTP during login, return full session
router.post('/auth/mfa/validate', async (req, env) => {
  try {
    const { mfaToken, code } = await req.json();
    if (!mfaToken || !code) return err('Token and code required', 400, req);
    const payload = verifyJwt(mfaToken, env.JWT_SECRET);
    if (!payload?.mfaPending) return err('Invalid or expired MFA token', 401, req);
    const userRes = await dbRead(env, 'User', `?id=eq.${payload.userId}&select=id,email,name,mfaTotpSecret&limit=1`);
    const users = await userRes.json();
    const user = users[0];
    if (!user?.mfaTotpSecret) return err('MFA not configured', 400, req);
    const { TOTP, Secret } = await import('otpauth');
    const totp = new TOTP({ issuer: 'Eight Submissions', label: user.email, algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(user.mfaTotpSecret) });
    const delta = totp.validate({ token: code.replace(/\s/g, ''), window: 1 });
    if (delta === null) return err('Invalid code', 401, req);
    const token = await signJwt({ userId: user.id, email: user.email }, env.JWT_SECRET);
    return json({ user: { id: user.id, email: user.email, name: user.name }, token }, 200, req);
  } catch (e) {
    console.error('MFA validate error:', e.message);
    return err('MFA validation failed', 500, req);
  }
});

// Disable MFA
router.post('/auth/mfa/disable', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/User?id=eq.${session.userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` },
      body: JSON.stringify({ mfaEnabled: false, mfaType: null, mfaTotpSecret: null }),
    });
    return json({ success: true }, 200, req);
  } catch (e) {
    return err('Failed to disable MFA', 500, req);
  }
});

// ── ITSA v2 Endpoints ────────────────────────────────────────────────────────

// 1. GET /itsa/obligations/:businessId
router.get('/itsa/obligations/:businessId', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  try {
    const { businessId } = req.params;
    const bizRes = await dbRead(env, 'Business', `?id=eq.${businessId}&userId=eq.${session.userId}&limit=1`);
    const bizzes = await bizRes.json();
    if (!bizzes || bizzes.length === 0) return err('Business not found', 404, req);
    const biz = bizzes[0];
    if (!biz.nino) return err('Business has no NINO', 400, req);

    const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
    const tokens = await tokenRes.json();
    if (!tokens || tokens.length === 0) return err('No HMRC token – connect HMRC first', 401, req);

    const hmrcRes = await fetch(
      `${env.HMRC_API_BASE_URL}/obligations/details/${biz.nino}/income-and-expenditure?typeOfBusiness=self-employment&businessId=${biz.hmrcIncomeSourceId || businessId}`,
      { headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Accept': 'application/vnd.hmrc.3.0+json', 'Gov-Test-Scenario': 'OPEN', ...buildFraudHeaders(req) } }
    );
    const data = await hmrcRes.json();
    return json(data, hmrcRes.status, req);
  } catch (e) {
    console.error('ITSA obligations error:', e.message);
    return err('Failed to fetch ITSA obligations', 500, req);
  }
});

// 2. POST /itsa/quarterly/:businessId
router.post('/itsa/quarterly/:businessId', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  try {
    const { businessId } = req.params;
    const body = await req.json();
    const { periodStartDate, periodEndDate, income = {}, expenses = {} } = body;
    if (!periodStartDate || !periodEndDate) return err('periodStartDate and periodEndDate required', 400, req);

    const bizRes = await dbRead(env, 'Business', `?id=eq.${businessId}&userId=eq.${session.userId}&limit=1`);
    const bizzes = await bizRes.json();
    if (!bizzes || bizzes.length === 0) return err('Business not found', 404, req);
    const biz = bizzes[0];
    if (!biz.nino) return err('Business has no NINO', 400, req);

    const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
    const tokens = await tokenRes.json();
    if (!tokens || tokens.length === 0) return err('No HMRC token – connect HMRC first', 401, req);

    const payload = {
      periodStartDate,
      periodEndDate,
      incomes: {
        turnover: { amount: income.turnover ?? 0 },
        other:    { amount: income.other    ?? 0 }
      },
      expenses: {
        costOfGoods:                  { amount: expenses.costOfGoods        ?? 0 },
        staffCosts:                   { amount: expenses.staffCosts         ?? 0 },
        travelCosts:                  { amount: expenses.travelCosts        ?? 0 },
        premisesRunningCosts:         { amount: expenses.premises           ?? 0 },
        adminCosts:                   { amount: expenses.admin              ?? 0 },
        advertisingCosts:             { amount: expenses.advertising        ?? 0 },
        professionalFees:             { amount: expenses.professionalFees   ?? 0 },
        interestOnBankOtherLoans:     { amount: expenses.interest           ?? 0 },
        irrecoverableDebts:           { amount: expenses.badDebts           ?? 0 },
        other:                        { amount: expenses.other              ?? 0 }
      }
    };

    const hmrcRes = await fetch(
      `${env.HMRC_API_BASE_URL}/individuals/business/self-employment/${biz.nino}/${biz.hmrcIncomeSourceId || businessId}/period`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.hmrc.3.0+json', ...buildFraudHeaders(req) },
        body: JSON.stringify(payload)
      }
    );
    const data = await hmrcRes.json();

    if (hmrcRes.ok) {
      await dbWrite(env, 'Submission', {
        id: crypto.randomUUID(), businessId, taxType: 'ITSA',
        periodKey: `${periodStartDate}_${periodEndDate}`,
        periodStart: periodStartDate, periodEnd: periodEndDate,
        submissionType: 'QUARTERLY', hmrcReceiptId: data.periodId || null,
        status: 'ACCEPTED', payload: JSON.stringify(payload),
        hmrcResponse: JSON.stringify(data),
        submittedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
    }
    return json(data, hmrcRes.status, req);
  } catch (e) {
    console.error('ITSA quarterly error:', e.message);
    return err('Failed to submit quarterly update', 500, req);
  }
});

// 3. GET /itsa/calculation/:businessId
router.get('/itsa/calculation/:businessId', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  try {
    const { businessId } = req.params;
    const url = new URL(req.url);
    const taxYear = url.searchParams.get('taxYear') || '2024-25';

    const bizRes = await dbRead(env, 'Business', `?id=eq.${businessId}&userId=eq.${session.userId}&limit=1`);
    const bizzes = await bizRes.json();
    if (!bizzes || bizzes.length === 0) return err('Business not found', 404, req);
    const biz = bizzes[0];
    if (!biz.nino) return err('Business has no NINO', 400, req);

    const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
    const tokens = await tokenRes.json();
    if (!tokens || tokens.length === 0) return err('No HMRC token – connect HMRC first', 401, req);

    // Step 1 – trigger calculation
    const triggerRes = await fetch(
      `${env.HMRC_API_BASE_URL}/individuals/calculations/${biz.nino}/self-assessment/${taxYear}`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.hmrc.5.0+json', ...buildFraudHeaders(req) },
        body: JSON.stringify({ finalDeclaration: false })
      }
    );
    const triggerData = await triggerRes.json();
    if (!triggerRes.ok) return json(triggerData, triggerRes.status, req);
    const calculationId = triggerData.id;

    // Step 2 – retrieve result
    const calcRes = await fetch(
      `${env.HMRC_API_BASE_URL}/individuals/calculations/${biz.nino}/self-assessment/${taxYear}/${calculationId}`,
      { headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Accept': 'application/vnd.hmrc.5.0+json', ...buildFraudHeaders(req) } }
    );
    const calcData = await calcRes.json();
    return json({ calculationId, ...calcData }, calcRes.status, req);
  } catch (e) {
    console.error('ITSA calculation error:', e.message);
    return err('Failed to get tax calculation', 500, req);
  }
});

// 4. POST /itsa/eops/:businessId
router.post('/itsa/eops/:businessId', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  try {
    const { businessId } = req.params;
    const body = await req.json();
    const { taxYear, accountingPeriodStartDate, accountingPeriodEndDate } = body;
    if (!taxYear || !accountingPeriodStartDate || !accountingPeriodEndDate)
      return err('taxYear, accountingPeriodStartDate and accountingPeriodEndDate required', 400, req);

    const bizRes = await dbRead(env, 'Business', `?id=eq.${businessId}&userId=eq.${session.userId}&limit=1`);
    const bizzes = await bizRes.json();
    if (!bizzes || bizzes.length === 0) return err('Business not found', 404, req);
    const biz = bizzes[0];
    if (!biz.nino) return err('Business has no NINO', 400, req);

    const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
    const tokens = await tokenRes.json();
    if (!tokens || tokens.length === 0) return err('No HMRC token – connect HMRC first', 401, req);

    const payload = {
      typeOfBusiness: 'self-employment',
      businessId: biz.hmrcIncomeSourceId || businessId,
      accountingPeriod: { startDate: accountingPeriodStartDate, endDate: accountingPeriodEndDate },
      finalised: true
    };

    const hmrcRes = await fetch(
      `${env.HMRC_API_BASE_URL}/individuals/self-assessment/end-of-period-statement/${biz.nino}`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.hmrc.3.0+json', ...buildFraudHeaders(req) },
        body: JSON.stringify(payload)
      }
    );
    const data = await hmrcRes.json();

    if (hmrcRes.ok) {
      await dbWrite(env, 'Submission', {
        id: crypto.randomUUID(), businessId, taxType: 'ITSA',
        periodKey: taxYear, periodStart: accountingPeriodStartDate, periodEnd: accountingPeriodEndDate,
        submissionType: 'EOPS', hmrcReceiptId: null,
        status: 'ACCEPTED', payload: JSON.stringify(payload),
        hmrcResponse: JSON.stringify(data),
        submittedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
    }
    return json(data, hmrcRes.status, req);
  } catch (e) {
    console.error('ITSA EOPS error:', e.message);
    return err('Failed to submit EOPS', 500, req);
  }
});

// 5. POST /itsa/crystallise/:businessId
router.post('/itsa/crystallise/:businessId', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  try {
    const { businessId } = req.params;
    const body = await req.json();
    const { taxYear, calculationId } = body;
    if (!taxYear || !calculationId) return err('taxYear and calculationId required', 400, req);

    const bizRes = await dbRead(env, 'Business', `?id=eq.${businessId}&userId=eq.${session.userId}&limit=1`);
    const bizzes = await bizRes.json();
    if (!bizzes || bizzes.length === 0) return err('Business not found', 404, req);
    const biz = bizzes[0];
    if (!biz.nino) return err('Business has no NINO', 400, req);

    const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
    const tokens = await tokenRes.json();
    if (!tokens || tokens.length === 0) return err('No HMRC token – connect HMRC first', 401, req);

    const hmrcRes = await fetch(
      `${env.HMRC_API_BASE_URL}/individuals/calculations/${biz.nino}/self-assessment/${taxYear}/${calculationId}/final-declaration`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.hmrc.5.0+json', ...buildFraudHeaders(req) },
        body: JSON.stringify({})
      }
    );
    const data = await hmrcRes.json();

    if (hmrcRes.ok) {
      await dbWrite(env, 'Submission', {
        id: crypto.randomUUID(), businessId, taxType: 'ITSA',
        periodKey: taxYear, periodStart: null, periodEnd: null,
        submissionType: 'CRYSTALLISATION', hmrcReceiptId: calculationId,
        status: 'ACCEPTED', payload: JSON.stringify({ taxYear, calculationId }),
        hmrcResponse: JSON.stringify(data),
        submittedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
    }
    return json(data, hmrcRes.status, req);
  } catch (e) {
    console.error('ITSA crystallise error:', e.message);
    return err('Failed to crystallise', 500, req);
  }
});


router.all('*', (req) => err('Not found', 404, req));
