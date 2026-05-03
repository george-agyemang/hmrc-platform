import pathlib

path = pathlib.Path('worker/src/index.js')
src = path.read_text()

new_routes = '''
// ── Business Details — HMRC lookup by NINO (Business Details MTD 2.0) ─────────
router.get('/businesses/hmrc/details/:nino', async (req, env) => {
  const session = getSession(req);
  if (!session) return err('Not authenticated', 401, req);
  const tokenRes = await dbRead(env, 'HmrcToken', `?userId=eq.${session.userId}&select=accessToken&limit=1`);
  const tokens = await tokenRes.json();
  if (!tokens[0]) return err('HMRC not connected', 401, req);
  const hmrcRes = await fetch(
    `${env.HMRC_API_BASE_URL}/individuals/business/details/${req.params.nino}/list`,
    { headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Accept': 'application/vnd.hmrc.2.0+json' } }
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
    { headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Accept': 'application/vnd.hmrc.5.0+json' } }
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
    { headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Accept': 'application/vnd.hmrc.3.0+json' } }
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
    { method: 'PUT', headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.hmrc.5.0+json' }, body: JSON.stringify(payload) }
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
    { method: 'POST', headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.hmrc.8.0+json' }, body: JSON.stringify({ taxYear }) }
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
    { headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Accept': 'application/vnd.hmrc.8.0+json' } }
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
    { method: 'POST', headers: { 'Authorization': `Bearer ${tokens[0].accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.hmrc.8.0+json' }, body: JSON.stringify({}) }
  );
  const hmrcData = await hmrcRes.json();
  const now = new Date().toISOString();
  const sub = { id: crypto.randomUUID(), businessId, taxType: 'ITSA', submissionType: 'CRYSTALLISATION', periodKey: taxYear, periodStart: null, periodEnd: null, status: hmrcRes.ok ? 'ACCEPTED' : 'REJECTED', hmrcReceiptId: hmrcData.transactionReference || null, payload: JSON.stringify({ calculationId, taxYear }), hmrcResponse: JSON.stringify(hmrcData), submittedAt: now, createdAt: now, updatedAt: now };
  await dbWrite(env, 'Submission', sub);
  if (!hmrcRes.ok) return err(hmrcData.message || 'Final declaration failed', 400, req);
  return json({ message: 'Final declaration submitted', submission: sub }, 201, req);
});

'''

marker = "router.all('*', (req) => err('Not found', 404, req));"
assert marker in src, "ERROR: marker not found in index.js"
path.write_text(src.replace(marker, new_routes + marker, 1))
print("Done — 7 ITSA routes injected.")
