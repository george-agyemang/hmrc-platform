import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService, businessService, submissionService } from '../services/api.jsx';

const statusColour = {
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  REJECTED: 'bg-red-100 text-red-700',
  ERROR: 'bg-red-100 text-red-700',
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '—';

function SubmissionRow({ s }) {
  const [open, setOpen] = useState(false);

  let payload = null;
  let hmrcResponse = null;
  try { payload = typeof s.payload === 'string' ? JSON.parse(s.payload) : s.payload; } catch {}
  try { hmrcResponse = typeof s.hmrcResponse === 'string' ? JSON.parse(s.hmrcResponse) : s.hmrcResponse; } catch {}

  const vatFields = [
    { label: 'Box 1 — VAT due on sales', key: 'vatDueSales' },
    { label: 'Box 2 — VAT due on acquisitions', key: 'vatDueAcquisitions' },
    { label: 'Box 3 — Total VAT due', key: 'totalVatDue' },
    { label: 'Box 4 — VAT reclaimed', key: 'vatReclaimedCurrPeriod' },
    { label: 'Box 5 — Net VAT', key: 'netVatDue' },
    { label: 'Box 6 — Total sales ex-VAT', key: 'totalValueSalesExVAT' },
    { label: 'Box 7 — Total purchases ex-VAT', key: 'totalValuePurchasesExVAT' },
    { label: 'Box 8 — Goods supplied to EC', key: 'totalValueGoodsSuppliedExVAT' },
    { label: 'Box 9 — Acquisitions from EC', key: 'totalAcquisitionsExVAT' },
  ];

  return (
    <>
      <tr
        key={s.id}
        onClick={() => setOpen(o => !o)}
        className="hover:bg-gray-50 cursor-pointer select-none"
      >
        <td className="px-4 py-3 font-medium">
          <span className="inline-flex items-center gap-1.5">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${s.taxType === 'VAT' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
              {s.taxType}
            </span>
            <span className="text-gray-500 text-xs">{s.submissionType}</span>
          </span>
        </td>
        <td className="px-4 py-3 text-gray-600 text-sm">{fmt(s.periodStart)}–{fmt(s.periodEnd)}</td>
        <td className="px-4 py-3 text-gray-600 text-sm">{fmt(s.submittedAt)}</td>
        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{s.hmrcReceiptId || '—'}</td>
        <td className="px-4 py-3">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColour[s.status]}`}>
            {s.status}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-400 text-xs text-right">
          <span className={`transition-transform inline-block ${open ? 'rotate-180' : ''}`}>▾</span>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={6} className="px-4 pb-4 bg-gray-50 border-b border-gray-100">
            <div className="rounded-xl border border-gray-200 bg-white p-4 mt-1 space-y-4">

              {/* VAT boxes */}
              {payload && s.taxType === 'VAT' && s.submissionType !== 'NIL' && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Return Values</p>
                  <div className="grid grid-cols-3 gap-2">
                    {vatFields.map(({ label, key }) =>
                      payload[key] !== undefined ? (
                        <div key={key} className="bg-gray-50 rounded-lg px-3 py-2">
                          <p className="text-xs text-gray-400">{label}</p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5">
                            £{Number(payload[key]).toFixed(2)}
                          </p>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              )}

              {/* Nil return notice */}
              {s.submissionType === 'NIL' && (
                <div className="text-sm text-gray-400 italic">Nil return — all boxes zero.</div>
              )}

              {/* HMRC response */}
              {hmrcResponse && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">HMRC Response</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {hmrcResponse.formBundleNumber && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-gray-400">Form Bundle Number</p>
                        <p className="font-mono font-semibold text-gray-700 mt-0.5">{hmrcResponse.formBundleNumber}</p>
                      </div>
                    )}
                    {hmrcResponse.processingDate && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-gray-400">Processing Date</p>
                        <p className="font-semibold text-gray-700 mt-0.5">{fmt(hmrcResponse.processingDate)}</p>
                      </div>
                    )}
                    {hmrcResponse.paymentIndicator && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-gray-400">Payment Indicator</p>
                        <p className="font-semibold text-gray-700 mt-0.5">{hmrcResponse.paymentIndicator}</p>
                      </div>
                    )}
                    {hmrcResponse.chargeRefNumber && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-gray-400">Charge Ref</p>
                        <p className="font-mono font-semibold text-gray-700 mt-0.5">{hmrcResponse.chargeRefNumber}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Submission metadata */}
              <div className="flex gap-6 text-xs text-gray-400 pt-1 border-t border-gray-100">
                <span>ID: <span className="font-mono">{s.id}</span></span>
                <span>Submitted: {fmt(s.submittedAt)}</span>
                {s.periodKey && <span>Period key: <span className="font-mono">{s.periodKey}</span></span>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function Dashboard({ user, onLogout }) {
  const [businesses, setBusinesses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [obligations, setObligations] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [hmrcConnected, setHmrcConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([businessService.list(), authService.hmrcStatus()])
      .then(([biz, hmrc]) => {
        setBusinesses(biz);
        setHmrcConnected(hmrc.connected && hmrc.hmrcConnected);
        if (biz.length > 0) loadBusiness(biz[0]);
      })
      .catch(() => setError('Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  const loadBusiness = async (b) => {
    setSelected(b); setObligations([]); setSubmissions([]);
    try { const { submissions: s } = await submissionService.history(b.id); setSubmissions(s); } catch {}
    if (b.vrn) { try { const { obligations: o } = await submissionService.getObligations(b.id); setObligations(o); } catch {} }
  };

  const submitNilVat = async (ob) => {
    setSubLoading(true); setError(''); setSuccess('');
    try {
      await submissionService.submitNilVat({ businessId: selected.id, periodKey: ob.periodKey, periodStart: ob.start, periodEnd: ob.end });
      setSuccess('Nil VAT return submitted successfully.');
      loadBusiness(selected);
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed.');
    } finally {
      setSubLoading(false);
    }
  };

  const handleLogout = async () => { await authService.logout(); onLogout(); navigate('/login'); };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="font-semibold text-gray-900">MTD Platform</span>
        </div>
        <div className="flex items-center gap-4">
          {!hmrcConnected && (
            <button onClick={() => authService.connectHmrc(user?.id)} className="text-sm bg-amber-50 border border-amber-300 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-100">
              ⚠ Connect HMRC
            </button>
          )}
          {hmrcConnected && <span className="text-sm text-emerald-600 font-medium">✓ HMRC Connected</span>}
          <span className="text-sm text-gray-500">{user?.email}</span>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-800">Sign out</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 grid grid-cols-12 gap-6">
        <aside className="col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Businesses</h2>
            <Link to="/businesses/new" className="text-xs text-emerald-600 hover:underline font-medium">+ Add</Link>
          </div>
          {businesses.length === 0
            ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-4 text-center">
                <p className="text-sm text-gray-400 mb-2">No businesses yet</p>
                <Link to="/businesses/new" className="text-sm text-emerald-600 font-medium">Add your first business</Link>
              </div>
            )
            : (
              <div className="space-y-2">
                {businesses.map(b => (
                  <button key={b.id} onClick={() => loadBusiness(b)} className={`w-full text-left rounded-xl px-4 py-3 transition border ${selected?.id === b.id ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                    <p className="font-medium text-sm text-gray-900 truncate">{b.businessName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{b.businessType.replace('_', ' ')}</p>
                  </button>
                ))}
              </div>
            )}
        </aside>

        <main className="col-span-9 space-y-6">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
          {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm">✓ {success}</div>}

          {selected ? (
            <>
              {/* Business card */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">{selected.businessName}</h1>
                    <p className="text-sm text-gray-500 mt-1">{selected.businessType.replace('_', ' ')} · {selected.status}</p>
                    <div className="flex gap-4 mt-3 text-xs text-gray-400">
                      {selected.vrn && <span>VRN: {selected.vrn}</span>}
                      {selected.utr && <span>UTR: {selected.utr}</span>}
                      {selected.crn && <span>CRN: {selected.crn}</span>}
                      {selected.nino && <span>NINO: {selected.nino}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {selected.nino && (
                      <Link to={`/businesses/${selected.id}/itsa`} className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
                        ITSA Return
                      </Link>
                    )}
                    {selected.vrn && (
                      <Link to={`/businesses/${selected.id}/submit`} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
                        VAT Return
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Obligations */}
              {obligations.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h2 className="font-semibold text-gray-900 mb-4">Outstanding VAT Obligations</h2>
                  <div className="space-y-3">
                    {obligations.map(ob => (
                      <div key={ob.periodKey} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">{fmt(ob.start)} – {fmt(ob.end)}</p>
                          <p className="text-xs text-amber-700 mt-0.5">Due: {fmt(ob.due)}</p>
                        </div>
                        <button onClick={() => submitNilVat(ob)} disabled={subLoading || !hmrcConnected} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-lg">
                          {subLoading ? 'Submitting...' : 'Submit Nil Return'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submission history */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Submission History</h2>
                {submissions.length === 0
                  ? <p className="text-sm text-gray-400 text-center py-6">No submissions yet</p>
                  : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Type', 'Period', 'Submitted', 'Receipt', 'Status', ''].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {submissions.map(s => <SubmissionRow key={s.id} s={s} />)}
                      </tbody>
                    </table>
                  )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
              <p className="text-gray-400 mb-4">Select a business or add one to get started.</p>
              <Link to="/businesses/new" className="text-emerald-600 font-medium text-sm">+ Add your first business</Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
