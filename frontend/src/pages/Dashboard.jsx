import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService, businessService, submissionService } from '../services/api.jsx';

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '—';

const TYPE_BADGE = {
  'VAT-NIL':              'bg-slate-100 text-slate-600',
  'VAT-FULL':             'bg-indigo-100 text-indigo-700',
  'ITSA-PERIODIC':        'bg-violet-100 text-violet-700',
  'ITSA-CRYSTALLISATION': 'bg-purple-100 text-purple-800',
};
const STATUS_BADGE = {
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  PENDING:   'bg-yellow-100 text-yellow-700',
  REJECTED:  'bg-red-100 text-red-700',
  ERROR:     'bg-red-100 text-red-700',
};

function PayloadDetail({ payload }) {
  let data;
  try { data = JSON.parse(payload); } catch { return null; }
  const entries = Object.entries(data).filter(([k]) => k !== 'periodKey' && k !== 'finalised');
  if (!entries.length) return null;
  return (
    <tr className="bg-gray-50">
      <td colSpan={6} className="px-4 pb-3 pt-1">
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs">
          {entries.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-gray-100 py-0.5">
              <dt className="text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</dt>
              <dd className="font-mono text-gray-800">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
            </div>
          ))}
        </dl>
      </td>
    </tr>
  );
}

export default function Dashboard({ user, onLogout }) {
  const [businesses, setBusinesses]       = useState([]);
  const [selected, setSelected]           = useState(null);
  const [obligations, setObligations]     = useState([]);
  const [submissions, setSubmissions]     = useState([]);
  const [hmrcConnected, setHmrcConnected] = useState(false);
  const [loading, setLoading]             = useState(true);
  const [subLoading, setSubLoading]       = useState(false);
  const [error, setError]                 = useState('');
  const [success, setSuccess]             = useState('');
  const [expandedRow, setExpandedRow]     = useState(null);
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
    setSelected(b); setObligations([]); setSubmissions([]); setExpandedRow(null);
    let submittedKeys = new Set();
    try {
      const { submissions: s } = await submissionService.history(b.id);
      setSubmissions(s);
      submittedKeys = new Set(s.filter(sub => sub.status === 'ACCEPTED').map(sub => sub.periodKey));
    } catch {}
    if (b.vrn) {
      try {
        const { obligations: o } = await submissionService.getObligations(b.id);
        setObligations((o || []).filter(ob => !submittedKeys.has(ob.periodKey)));
      } catch {}
    }
  };

  const submitNilVat = async (ob) => {
    setSubLoading(true); setError(''); setSuccess('');
    try {
      await submissionService.submitNilVat({ businessId: selected.id, periodKey: ob.periodKey, periodStart: ob.start, periodEnd: ob.end });
      setSuccess('Nil VAT return submitted successfully.');
      loadBusiness(selected);
    } catch (err) { setError(err.response?.data?.error || 'Submission failed.'); }
    finally { setSubLoading(false); }
  };

  const handleLogout = async () => { await authService.logout(); onLogout(); navigate('/login'); };
  const toggleRow = (id) => setExpandedRow(prev => prev === id ? null : id);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center"><span className="text-white font-bold text-sm">8</span></div>
          <span className="font-semibold text-gray-900">Eight Submissions</span>
        </div>
        <div className="flex items-center gap-4">
          {!hmrcConnected && <button onClick={() => authService.connectHmrc(user?.id)} className="text-sm bg-amber-50 border border-amber-300 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-100">⚠ Connect HMRC</button>}
          {hmrcConnected && <span className="text-sm text-emerald-600 font-medium">✓ HMRC Connected</span>}
          <span className="text-sm text-gray-500">{user?.email}</span>
          <Link to="/settings" className="text-sm text-gray-500 hover:text-gray-800">Settings</Link>
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
            ? <div className="bg-white rounded-xl border border-dashed border-gray-300 p-4 text-center"><p className="text-sm text-gray-400 mb-2">No businesses yet</p><Link to="/businesses/new" className="text-sm text-emerald-600 font-medium">Add your first business</Link></div>
            : <div className="space-y-2">{businesses.map(b => (
                <button key={b.id} onClick={() => loadBusiness(b)} className={`w-full text-left rounded-xl px-4 py-3 transition border ${selected?.id===b.id?'bg-emerald-50 border-emerald-300':'bg-white border-gray-200 hover:border-gray-300'}`}>
                  <p className="font-medium text-sm text-gray-900 truncate">{b.businessName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{b.businessType.replace('_',' ')}</p>
                </button>
              ))}</div>}
        </aside>

        <main className="col-span-9 space-y-6">
          {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
          {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm">✓ {success}</div>}

          {selected ? <>
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{selected.businessName}</h1>
                  <p className="text-sm text-gray-500 mt-1">{selected.businessType.replace('_',' ')} · {selected.status}</p>
                  <div className="flex gap-4 mt-3 text-xs text-gray-400">
                    {selected.vrn  && <span>VRN: {selected.vrn}</span>}
                    {selected.utr  && <span>UTR: {selected.utr}</span>}
                    {selected.crn  && <span>CRN: {selected.crn}</span>}
                    {selected.nino && <span>NINO: {selected.nino}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {selected.businessType === 'SOLE_TRADER' && selected.nino && (
                    <Link to={`/businesses/${selected.id}/itsa`} className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">ITSA Return</Link>
                  )}
                  <Link to={`/businesses/${selected.id}/submit`} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">VAT Return</Link>
                </div>
              </div>
            </div>

            {obligations.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Outstanding VAT Obligations</h2>
                <div className="space-y-3">
                  {obligations.map(ob => (
                    <div key={ob.periodKey} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <div><p className="text-sm font-medium">{fmt(ob.start)} – {fmt(ob.end)}</p><p className="text-xs text-amber-700 mt-0.5">Due: {fmt(ob.due)}</p></div>
                      <button onClick={() => submitNilVat(ob)} disabled={subLoading||!hmrcConnected} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-lg">{subLoading?'Submitting...':'Submit Nil Return'}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Submission History</h2>
              {submissions.length === 0
                ? <p className="text-sm text-gray-400 text-center py-6">No submissions yet</p>
                : <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>{['Type','Period','Submitted','Receipt','Status',''].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {submissions.map(s => {
                        const typeKey = `${s.taxType}-${s.submissionType}`;
                        const isExpanded = expandedRow === s.id;
                        return (
                          <>
                            <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow(s.id)}>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${TYPE_BADGE[typeKey] || 'bg-gray-100 text-gray-600'}`}>{s.taxType} {s.submissionType}</span>
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-xs">{s.periodStart ? `${fmt(s.periodStart)}–${fmt(s.periodEnd)}` : s.periodKey}</td>
                              <td className="px-4 py-3 text-gray-600">{fmt(s.submittedAt || s.createdAt)}</td>
                              <td className="px-4 py-3 text-gray-400 font-mono text-xs">{s.hmrcReceiptId || '—'}</td>
                              <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_BADGE[s.status] || ''}`}>{s.status}</span></td>
                              <td className="px-4 py-3 text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</td>
                            </tr>
                            {isExpanded && <PayloadDetail key={`${s.id}-detail`} payload={s.payload} />}
                          </>
                        );
                      })}
                    </tbody>
                  </table>}
            </div>
          </> : (
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
