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


// ── HMRC Fraud Prevention Headers ─────────────────────────────
const buildFraudHeaders = (req) => {
  const clientIp = req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || '0.0.0.0';
  const workerIp = '0.0.0.0'; // Cloudflare Worker — no fixed outbound IP

  // Parse device data sent by the frontend
  let client = {};
  try { client = JSON.parse(req.headers.get('X-Hmrc-Client-Data') || '{}'); } catch {}

  const deviceId   = client.deviceId  || crypto.randomUUID();
  const timezone   = client.timezone  || 'UTC+00:00';
  const screens    = client.screens   || 'width=1920&height=1080&scaling-factor=1&colour-depth=24';
  const winSize    = client.windowSize|| 'width=1280&height=720';
  const doNotTrack = client.doNotTrack || 'false';
  const now = new Date().toISOString();

  // User agent must NOT be percent-encoded
  let userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  try { if (client.userAgent) userAgent = decodeURIComponent(client.userAgent); } catch {}

  // User ID from platform session
  const userId = client.platformUserId || 'nserewa-user';

  return {
    'Gov-Client-Connection-Method':      'WEB_APP_VIA_SERVER',
    'Gov-Client-Device-ID':              deviceId,
    'Gov-Client-Timezone':               timezone,
    'Gov-Client-Screens':                screens,
    'Gov-Client-Window-Size':            winSize,
    'Gov-Client-Browser-JS-User-Agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Gov-Client-Browser-Do-Not-Track':   doNotTrack,
    'Gov-Client-Public-IP': req.headers.get('CF-Connecting-IP') || 'unknown',
    'Gov-Client-Public-IP-Timestamp': new Date().toISOString(),
    'Gov-Vendor-Forwarded': `for=${req.headers.get('CF-Connecting-IP') || 'unknown'}`,
    'Gov-Client-Public-IP-Timestamp':    now,
    'Gov-Client-User-IDs': 'gg=EightSubmissions',
    'Gov-Vendor-Version':                'eight-submissions-frontend=1.0.0&eight-submissions-backend=1.0.0',
    'Gov-Vendor-Public-IP':              workerIp,
    'Gov-Vendor-Forwarded':              `by=${workerIp}&for=${clientIp}`,
    'Gov-Vendor-Product-Name':           'Eight%20Submissions',
    'Gov-Vendor-License-IDs': 'hmrc-application-id=zyqLKNddsLVjFrXDFtxQhnFtoW0H',
  };
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
  const from = new Date(); from.setMonth(from.getMonth() - 12);
  const to = new Date();
  const hmrcRes = await fetch(`${env.HMRC_API_BASE_URL}/organisations/vat/${biz.vrn}/obligations?from=${from.toISOString().split('T')[0]}&to=${to.toISOString().split('T')[0]}&status=O`, {
    headers: { ...buildFraudHeaders(req), 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Accept': 'application/vnd.hmrc.1.0+json' },
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
    method: 'POST', headers: { ...buildFraudHeaders(req), 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.hmrc.1.0+json' }, body: JSON.stringify(payload),
  });
  const hmrcData = await hmrcRes.json();
  const now = new Date().toISOString();
  const sub = { id: crypto.randomUUID(), businessId, taxType: 'VAT', submissionType: 'NIL', periodKey, periodStart, periodEnd, status: hmrcRes.ok ? 'ACCEPTED' : 'REJECTED', hmrcReceiptId: hmrcData.formBundleNumber || null, payload: JSON.stringify(payload), hmrcResponse: JSON.stringify(hmrcData), submittedAt: now, createdAt: now, updatedAt: now };
  await dbWrite(env, 'Submission', sub);
  if (!hmrcRes.ok) return err(hmrcData.message || 'HMRC rejected submission', 400, req);
  return json({ message: 'Nil VAT return submitted', submission: sub }, 201, req);
});

router.post('/submissions/vat/full', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);

  const { businessId, periodKey, periodStart, periodEnd,
          box1, box2, box4, box6, box7, box8, box9 } = await req.json();

  const vatDueSales            = Math.round((parseFloat(box1) || 0) * 100) / 100;
  const vatDueAcquisitions     = Math.round((parseFloat(box2) || 0) * 100) / 100;
  const totalVatDue            = Math.round((vatDueSales + vatDueAcquisitions) * 100) / 100;
  const vatReclaimedCurrPeriod = Math.round((parseFloat(box4) || 0) * 100) / 100;
  const netVatDue              = Math.round(Math.abs(totalVatDue - vatReclaimedCurrPeriod) * 100) / 100;
  const totalValueSalesExVAT         = Math.round(parseFloat(box6) || 0);
  const totalValuePurchasesExVAT     = Math.round(parseFloat(box7) || 0);
  const totalValueGoodsSuppliedExVAT = Math.round(parseFloat(box8) || 0);
  const totalAcquisitionsExVAT       = Math.round(parseFloat(box9) || 0);

  const bizRes = await dbRead(env, 'Business', `?id=eq.${businessId}&userId=eq.${session.userId}&select=vrn&limit=1`);
  const biz = (await bizRes.json())[0];
  if (!biz?.vrn) return err('Business not found or no VRN', 404, req);

  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);

  const payload = {
    periodKey,
    vatDueSales, vatDueAcquisitions, totalVatDue,
    vatReclaimedCurrPeriod, netVatDue,
    totalValueSalesExVAT, totalValuePurchasesExVAT,
    totalValueGoodsSuppliedExVAT, totalAcquisitionsExVAT,
    finalised: true,
  };

  const hmrcRes = await fetch(`${env.HMRC_API_BASE_URL}/organisations/vat/${biz.vrn}/returns`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokens[0].accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.hmrc.1.0+json',
    },
    body: JSON.stringify(payload),
  });

  const hmrcData = await hmrcRes.json();
  const now = new Date().toISOString();
  const sub = {
    id: crypto.randomUUID(), businessId,
    taxType: 'VAT', submissionType: 'FULL',
    periodKey, periodStart, periodEnd,
    status: hmrcRes.ok ? 'ACCEPTED' : 'REJECTED',
    hmrcReceiptId: hmrcData.formBundleNumber || null,
    payload: JSON.stringify(payload),
    hmrcResponse: JSON.stringify(hmrcData),
    submittedAt: now, createdAt: now, updatedAt: now,
  };
  await dbWrite(env, 'Submission', sub);
  if (!hmrcRes.ok) return err(hmrcData.message || 'HMRC rejected submission', 400, req);
  return json({ message: 'VAT return submitted', receipt: hmrcData, submission: sub }, 201, req);
});

router.get('/submissions/:businessId', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const res = await dbRead(env, 'Submission', `?businessId=eq.${req.params.businessId}&order=createdAt.desc`);
  return json({ submissions: await res.json() }, 200, req);
});


// ── Business Details — HMRC lookup by NINO (Business Details MTD 2.0) ─────────
router.get('/businesses/hmrc/details/:nino', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const hmrcRes = await fetch(
    `${env.HMRC_API_BASE_URL}/individuals/business/details/${req.params.nino}/list`,
    { headers: { ...buildFraudHeaders(req), 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Accept': 'application/vnd.hmrc.2.0+json' } }
  );
  const data = await hmrcRes.json();
  if (!hmrcRes.ok) return err(data.message || 'HMRC lookup failed', hmrcRes.status, req);
  return json({ businesses: data.listOfBusinesses || data.businessDetails || [] }, 200, req);
});

// ── ITSA — HMRC Self-Employment business list (Self Employment Business MTD 5.0) ─
router.get('/submissions/itsa/businesses/:businessId', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const bizRes = await dbRead(env, 'Business', `?id=eq.${req.params.businessId}&userId=eq.${session.userId}&select=nino&limit=1`);
  const biz = (await bizRes.json())[0];
  if (!biz?.nino) return err('Business not found or no NINO set', 404, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const hmrcRes = await fetch(
    `${env.HMRC_API_BASE_URL}/individuals/business/self-employment/${biz.nino}`,
    { headers: { ...buildFraudHeaders(req), 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Accept': 'application/vnd.hmrc.5.0+json' } }
  );
  const data = await hmrcRes.json();
  if (!hmrcRes.ok) return err(data.message || 'Failed to fetch SE businesses', hmrcRes.status, req);
  return json({ seBusinesses: data.businessDetails || [] }, 200, req);
});

// ── ITSA — Obligations (Obligations MTD 3.0) ───────────────────────────────────
router.get('/submissions/obligations/itsa/:businessId', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const bizRes = await dbRead(env, 'Business', `?id=eq.${req.params.businessId}&userId=eq.${session.userId}&select=nino&limit=1`);
  const biz = (await bizRes.json())[0];
  if (!biz?.nino) return err('Business not found or no NINO set', 404, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const hmrcRes = await fetch(
    `${env.HMRC_API_BASE_URL}/obligations/details/${biz.nino}/income-and-expenditure?typeOfBusiness=self-employment&status=Open`,
    { headers: { ...buildFraudHeaders(req), 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Accept': 'application/vnd.hmrc.3.0+json' } }
  );
  const data = await hmrcRes.json();
  if (!hmrcRes.ok) return err(data.message || 'Failed to fetch ITSA obligations', hmrcRes.status, req);
  return json({ obligations: data.obligations || [] }, 200, req);
});

// ── ITSA — Submit Periodic Update (Self Employment Business MTD 5.0) ───────────
router.post('/submissions/itsa/periodic', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const { businessId, selfEmploymentId, periodId, fromDate, toDate, income, expenses } = await req.json();
  const bizRes = await dbRead(env, 'Business', `?id=eq.${businessId}&userId=eq.${session.userId}&select=nino&limit=1`);
  const biz = (await bizRes.json())[0];
  if (!biz?.nino) return err('Business not found or no NINO set', 404, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const hmrcExpenses = (expenses.consolidated !== undefined && expenses.consolidated !== '')
    ? { consolidatedExpenses: { amount: parseFloat(expenses.consolidated) || 0 } }
    : {
        costOfGoods:              { amount: parseFloat(expenses.costOfGoods) || 0 },
        paymentsToSubContractors: { amount: 0 },
        wagesAndStaffCosts:       { amount: parseFloat(expenses.staffCosts) || 0 },
        carVanTravelExpenses:     { amount: parseFloat(expenses.travelCosts) || 0 },
        premisesRunningCosts:     { amount: parseFloat(expenses.premisesRunningCosts) || 0 },
        professionalFees:         { amount: parseFloat(expenses.professionalFees) || 0 },
        otherExpenses:            { amount: parseFloat(expenses.otherExpenses) || 0 },
      };
  const payload = {
    incomes:  { turnover: { amount: parseFloat(income.turnover) || 0 }, other: { amount: parseFloat(income.other) || 0 } },
    expenses: hmrcExpenses,
  };
  const hmrcRes = await fetch(
    `${env.HMRC_API_BASE_URL}/individuals/business/self-employment/${biz.nino}/${selfEmploymentId}/period/${periodId}`,
    { method: 'PUT', headers: { ...buildFraudHeaders(req), 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.hmrc.5.0+json' }, body: JSON.stringify(payload) }
  );
  const hmrcData = await hmrcRes.json();
  const now = new Date().toISOString();
  const sub = { id: crypto.randomUUID(), businessId, taxType: 'ITSA', submissionType: 'PERIODIC', periodKey: periodId, periodStart: fromDate, periodEnd: toDate, status: hmrcRes.ok ? 'ACCEPTED' : 'REJECTED', hmrcReceiptId: hmrcData.transactionReference || null, payload: JSON.stringify(payload), hmrcResponse: JSON.stringify(hmrcData), submittedAt: now, createdAt: now, updatedAt: now };
  await dbWrite(env, 'Submission', sub);
  if (!hmrcRes.ok) return err(hmrcData.message || 'HMRC rejected periodic submission', 400, req);
  return json({ message: 'Periodic update submitted', submission: sub }, 201, req);
});

// ── ITSA — Trigger Calculation (Individual Calculations MTD 8.0) ───────────────
router.post('/submissions/itsa/calculate', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const { businessId, taxYear } = await req.json();
  const bizRes = await dbRead(env, 'Business', `?id=eq.${businessId}&userId=eq.${session.userId}&select=nino&limit=1`);
  const biz = (await bizRes.json())[0];
  if (!biz?.nino) return err('Business not found or no NINO set', 404, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const hmrcRes = await fetch(
    `${env.HMRC_API_BASE_URL}/individuals/calculations/${biz.nino}/self-assessment`,
    { method: 'POST', headers: { ...buildFraudHeaders(req), 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.hmrc.8.0+json' }, body: JSON.stringify({ taxYear }) }
  );
  const data = await hmrcRes.json();
  if (!hmrcRes.ok) return err(data.message || 'Calculation trigger failed', hmrcRes.status, req);
  return json({ calculationId: data.calculationId, taxYear }, 200, req);
});

// ── ITSA — Get Calculation Result (Individual Calculations MTD 8.0) ────────────
router.get('/submissions/itsa/calculate/:businessId/:calculationId', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const bizRes = await dbRead(env, 'Business', `?id=eq.${req.params.businessId}&userId=eq.${session.userId}&select=nino&limit=1`);
  const biz = (await bizRes.json())[0];
  if (!biz?.nino) return err('Business not found or no NINO set', 404, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const hmrcRes = await fetch(
    `${env.HMRC_API_BASE_URL}/individuals/calculations/${biz.nino}/self-assessment/${req.params.calculationId}`,
    { headers: { ...buildFraudHeaders(req), 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Accept': 'application/vnd.hmrc.8.0+json' } }
  );
  const data = await hmrcRes.json();
  if (!hmrcRes.ok) return err(data.message || 'Failed to get calculation', hmrcRes.status, req);
  return json({ calculation: data }, 200, req);
});

// ── ITSA — Final Declaration / Crystallisation (Individual Calculations MTD 8.0)
router.post('/submissions/itsa/crystallise', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const { businessId, calculationId, taxYear } = await req.json();
  const bizRes = await dbRead(env, 'Business', `?id=eq.${businessId}&userId=eq.${session.userId}&select=nino&limit=1`);
  const biz = (await bizRes.json())[0];
  if (!biz?.nino) return err('Business not found or no NINO set', 404, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const hmrcRes = await fetch(
    `${env.HMRC_API_BASE_URL}/individuals/calculations/${biz.nino}/self-assessment/${calculationId}/final-declaration`,
    { method: 'POST', headers: { ...buildFraudHeaders(req), 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.hmrc.8.0+json' }, body: JSON.stringify({}) }
  );
  const hmrcData = await hmrcRes.json();
  const now = new Date().toISOString();
  const sub = { id: crypto.randomUUID(), businessId, taxType: 'ITSA', submissionType: 'CRYSTALLISATION', periodKey: taxYear, periodStart: null, periodEnd: null, status: hmrcRes.ok ? 'ACCEPTED' : 'REJECTED', hmrcReceiptId: hmrcData.transactionReference || null, payload: JSON.stringify({ calculationId, taxYear }), hmrcResponse: JSON.stringify(hmrcData), submittedAt: now, createdAt: now, updatedAt: now };
  await dbWrite(env, 'Submission', sub);
  if (!hmrcRes.ok) return err(hmrcData.message || 'Final declaration failed', 400, req);
  return json({ message: 'Final declaration submitted', submission: sub }, 201, req);
});


// ── ITSA — Create SE Business source (Self Employment Business MTD 5.0)
router.post('/submissions/itsa/create-se-business/:businessId', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const bizRes = await dbRead(env, 'Business', `?id=eq.${req.params.businessId}&userId=eq.${session.userId}&select=nino&limit=1`);
  const biz = (await bizRes.json())[0];
  if (!biz?.nino) return err('Business not found or no NINO set', 404, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const { tradingName, commencementDate, accountingType } = await req.json();
  const payload = {
    accountingPeriod: { start: commencementDate || '2023-04-06', end: '2024-04-05' },
    accountingType: accountingType || 'CASH',
    commencementDate: commencementDate || '2023-04-06',
    tradingName: tradingName || 'Self Employment Business',
  };
  const hmrcRes = await fetch(
    `${env.HMRC_API_BASE_URL}/individuals/business/self-employment/${biz.nino}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens[0].accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.hmrc.5.0+json',
      },
      body: JSON.stringify(payload),
    }
  );
  const data = await hmrcRes.json();
  if (!hmrcRes.ok) return err(data.message || 'Failed to create SE business', hmrcRes.status, req);
  return json({ message: 'SE business created', selfEmploymentId: data.selfEmploymentId, data }, 201, req);
});

router.all('*', (req) => err('Not found', 404, req));

export default {
  async fetch(request, env, ctx) {
    return router.handle(request, env, ctx);
  },
};
