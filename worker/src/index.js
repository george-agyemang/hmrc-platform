import { Router } from 'itty-router';

const router = Router();

const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin || 'https://nserewa.pages.dev',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
  'Access-Control-Allow-Credentials': 'true',
});

const json = (data, status = 200, req) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(req?.headers?.get('Origin')) },
  });

const err = (msg, status = 400, req) => json({ error: msg }, status, req);

// DB helpers - use service key for writes, anon for reads
const dbRead = (env, table, query = '') =>
  fetch(`${env.SUPABASE_URL}/rest/v1/${table}${query}`, {
    headers: { 'apikey': env.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}` },
  });

const dbWrite = (env, table, body, method = 'POST') =>
  fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(body),
  });

const getSession = async (req, env) => {
  const cookie = req.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;
  try {
    const parts = match[1].split('.');
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch { return null; }
};

const signJwt = async (payload, secret) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 }));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
};

const hashPassword = async (password) => {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
};

const setCookie = (token) =>
  `session=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${7 * 24 * 3600}`;

router.options('*', (req) => new Response(null, { status: 204, headers: cors(req.headers.get('Origin')) }));

router.get('/health', (req) => json({ status: 'ok' }, 200, req));

// ── Register ──────────────────────────────────────────────────
router.post('/users/register', async (req, env) => {
  try {
    const { email, password, name } = await req.json();
    if (!email || !password) return err('Email and password required', 400, req);
    if (password.length < 8) return err('Password must be at least 8 characters', 400, req);

    const existing = await dbRead(env, 'User', `?email=eq.${encodeURIComponent(email)}&select=id`);
    const existingData = await existing.json();
    if (existingData.length > 0) return err('An account with this email already exists.', 400, req);

    const hash = await hashPassword(password);
    const id = crypto.randomUUID();

   const now = new Date().toISOString();
const res = await dbWrite(env, 'User', { id, email, name: name || '', passwordHash: hash, createdAt: now, updatedAt: now });
    if (!res.ok) {
      const e = await res.text();
      console.error('Supabase error:', e);
      return err('Registration failed', 500, req);
    }

    const user = (await res.json())[0];
    const token = await signJwt({ userId: user.id, email: user.email }, env.JWT_SECRET);

    return new Response(JSON.stringify({ user: { id: user.id, email: user.email, name: user.name } }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', 'Set-Cookie': setCookie(token), ...cors(req.headers.get('Origin')) },
    });
  } catch (e) {
    console.error('Register error:', e);
    return err('Registration failed', 500, req);
  }
});

// ── Login ─────────────────────────────────────────────────────
router.post('/users/login', async (req, env) => {
 try {
    const { email, password } = await req.json();
    if (!email || !password) return err('Email and password required', 400, req);

    const res = await dbRead(env, 'User', `?email=eq.${encodeURIComponent(email)}&select=*`);
    const users = await res.json();
    const user = users[0];
    if (!user) return err('Invalid email or password', 401, req);

    const hash = await hashPassword(password);
    if (hash !== user.passwordHash) return err('Invalid email or password', 401, req);

    const token = await signJwt({ userId: user.id, email: user.email }, env.JWT_SECRET);

    return new Response(JSON.stringify({ user: { id: user.id, email: user.email, name: user.name } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Set-Cookie': setCookie(token), ...cors(req.headers.get('Origin')) },
    });
  } catch (e) {
    return err('Login failed', 500, req);
  }
});

// ── Me ────────────────────────────────────────────────────────
router.get('/users/me', async (req, env) => {
  const session = await getSession(req, env);
  if (!session) return err('Not authenticated', 401, req);

  const res = await dbRead(env, 'User', `?id=eq.${session.userId}&select=id,email,name,createdAt`);
  const users = await res.json();
  if (!users[0]) return err('User not found', 404, req);
  return json({ ...users[0], hmrcConnected: !!session.hmrcConnected }, 200, req);
});

// ── Logout ────────────────────────────────────────────────────
router.post('/users/logout', (req) => new Response(JSON.stringify({ success: true }), {
  headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0', ...cors(req.headers.get('Origin')) },
}));

// ── Auth: HMRC OAuth ──────────────────────────────────────────
router.get('/auth/hmrc', (req, env) => {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  if (!userId) return err('userId required', 400, req);
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.HMRC_CLIENT_ID,
    scope: 'read:vat write:vat read:self-assessment write:self-assessment',
    state,
    redirect_uri: env.HMRC_REDIRECT_URI,
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${env.HMRC_AUTH_URL}?${params}`,
      'Set-Cookie': `oauth_state=${state}:${userId}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=600`,
    },
  });
});

// ── Auth: Callback ────────────────────────────────────────────
router.get('/auth/callback', async (req, env) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const frontendUrl = env.FRONTEND_URL || 'https://nserewa.pages.dev';
  const cookie = req.headers.get('Cookie') || '';
  const stateCookie = cookie.match(/oauth_state=([^;]+)/)?.[1];

  if (!stateCookie || !stateCookie.startsWith(state)) {
    return new Response(null, { status: 302, headers: { Location: `${frontendUrl}/auth/error?reason=invalid_state` } });
  }

  const userId = stateCookie.split(':')[1];

  try {
    const tokenRes = await fetch(env.HMRC_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: env.HMRC_CLIENT_ID,
        client_secret: env.HMRC_CLIENT_SECRET,
        code,
        redirect_uri: env.HMRC_REDIRECT_URI,
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) throw new Error('No access token');

    // Save tokens to DB
    await dbWrite(env, 'HmrcToken', {
      id: crypto.randomUUID(),
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      scope: tokens.scope || '',
      expiresAt: new Date(Date.now() + (tokens.expires_in || 14400) * 1000).toISOString(),
    });

    const token = await signJwt({ userId, hmrcConnected: true, scope: tokens.scope }, env.JWT_SECRET);

    return new Response(null, {
      status: 302,
      headers: { Location: `${frontendUrl}/auth/success`, 'Set-Cookie': setCookie(token) },
    });
  } catch (e) {
    console.error('Callback error:', e);
    return new Response(null, { status: 302, headers: { Location: `${frontendUrl}/auth/error?reason=token_exchange_failed` } });
  }
});

// ── Auth: Status ──────────────────────────────────────────────
router.get('/auth/status', async (req, env) => {
  const session = await getSession(req, env);
  if (!session) return json({ connected: false }, 200, req);
  return json({ connected: true, userId: session.userId, hmrcConnected: !!session.hmrcConnected }, 200, req);
});

// ── Businesses ────────────────────────────────────────────────
router.get('/businesses', async (req, env) => {
  const session = await getSession(req, env);
  if (!session) return err('Not authenticated', 401, req);
  const res = await dbRead(env, 'Business', `?userId=eq.${session.userId}&order=createdAt.desc`);
  return json(await res.json(), 200, req);
});

router.post('/businesses', async (req, env) => {
  const session = await getSession(req, env);
  if (!session) return err('Not authenticated', 401, req);
  const { businessName, businessType, status, vrn, utr, crn } = await req.json();
  if (!businessName || !businessType) return err('businessName and businessType required', 400, req);
  const res = await dbWrite(env, 'Business', {
    id: crypto.randomUUID(), userId: session.userId, businessName, businessType,
    status: status || 'ACTIVE', vrn: vrn || null, utr: utr || null, crn: crn || null,
  });
  if (!res.ok) return err('Failed to create business', 500, req);
  return json((await res.json())[0], 201, req);
});

router.get('/businesses/:id', async (req, env) => {
  const session = await getSession(req, env);
  if (!session) return err('Not authenticated', 401, req);
  const res = await dbRead(env, 'Business', `?id=eq.${req.params.id}&userId=eq.${session.userId}`);
  const biz = (await res.json())[0];
  if (!biz) return err('Business not found', 404, req);
  return json(biz, 200, req);
});

// ── Submissions ───────────────────────────────────────────────
router.get('/submissions/obligations/vat/:businessId', async (req, env) => {
  const session = await getSession(req, env);
  if (!session) return err('Not authenticated', 401, req);
  const bizRes = await dbRead(env, 'Business', `?id=eq.${req.params.businessId}&userId=eq.${session.userId}&select=vrn`);
  const biz = (await bizRes.json())[0];
  if (!biz?.vrn) return err('Business not found or no VRN', 404, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const from = new Date(); from.setFullYear(from.getFullYear() - 1);
  const to = new Date(); to.setFullYear(to.getFullYear() + 1);
  const hmrcRes = await fetch(
    `${env.HMRC_API_BASE_URL}/organisations/vat/${biz.vrn}/obligations?from=${from.toISOString().split('T')[0]}&to=${to.toISOString().split('T')[0]}&status=O`,
    { headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Accept': 'application/vnd.hmrc.1.0+json' } }
  );
  const data = await hmrcRes.json();
  return json({ obligations: data.obligations || [] }, 200, req);
});

router.post('/submissions/vat/nil', async (req, env) => {
  const session = await getSession(req, env);
  if (!session) return err('Not authenticated', 401, req);
  const { businessId, periodKey, periodStart, periodEnd } = await req.json();
  const bizRes = await dbRead(env, 'Business', `?id=eq.${businessId}&userId=eq.${session.userId}&select=vrn`);
  const biz = (await bizRes.json())[0];
  if (!biz?.vrn) return err('Business not found or no VRN', 404, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const payload = { periodKey, vatDueSales: 0, vatDueAcquisitions: 0, totalVatDue: 0, vatReclaimedCurrPeriod: 0, netVatDue: 0, totalValueSalesExVAT: 0, totalValuePurchasesExVAT: 0, totalValueGoodsSuppliedExVAT: 0, totalAcquisitionsExVAT: 0, finalised: true };
  const hmrcRes = await fetch(`${env.HMRC_API_BASE_URL}/organisations/vat/${biz.vrn}/returns`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.hmrc.1.0+json' },
    body: JSON.stringify(payload),
  });
  const hmrcData = await hmrcRes.json();
  const sub = { id: crypto.randomUUID(), businessId, taxType: 'VAT', submissionType: 'NIL', periodKey, periodStart, periodEnd, status: hmrcRes.ok ? 'ACCEPTED' : 'REJECTED', hmrcReceiptId: hmrcData.formBundleNumber || null, payload: JSON.stringify(payload), hmrcResponse: JSON.stringify(hmrcData), submittedAt: new Date().toISOString() };
  await dbWrite(env, 'Submission', sub);
  if (!hmrcRes.ok) return err(hmrcData.message || 'HMRC rejected submission', 400, req);
  return json({ message: 'Nil VAT return submitted', submission: sub }, 201, req);
});

router.get('/submissions/:businessId', async (req, env) => {
  const session = await getSession(req, env);
  if (!session) return err('Not authenticated', 401, req);
  const res = await dbRead(env, 'Submission', `?businessId=eq.${req.params.businessId}&order=createdAt.desc`);
  return json({ submissions: await res.json() }, 200, req);
});

router.all('*', (req) => err('Not found', 404, req));

export default {
  async fetch(request, env, ctx) {
    return router.handle(request, env, ctx);
  },
};
