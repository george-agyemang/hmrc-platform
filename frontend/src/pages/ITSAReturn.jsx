import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const taxYearFromDates = (start) => {
  const d = new Date(start)
  const y = d.getFullYear()
  const m = d.getMonth()
  const startYear = m < 3 || (m === 3 && d.getDate() < 6) ? y - 1 : y
  return `${startYear}-${String(startYear + 1).slice(2)}`
}

const quarterLabel = (idx) => ['Q1', 'Q2', 'Q3', 'Q4'][idx] ?? `Q${idx + 1}`

const STAGE_ORDER = ['Q1', 'Q2', 'Q3', 'Q4', 'EOPS', 'Final Declaration']

export default function ITSAReturn() {
  const { businessId } = useParams()
  const navigate = useNavigate()
  const token = localStorage.getItem('auth_token')
  const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const [business, setBusiness]           = useState(null)
  const [obligations, setObligations]     = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [activeObl, setActiveObl]         = useState(null)   // obligation being edited
  const [view, setView]                   = useState('timeline') // 'timeline' | 'form' | 'success'
  const [working, setWorking]             = useState(false)
  const [lastReceipt, setLastReceipt]     = useState(null)

  // Income & expense form state
  const [income, setIncome]     = useState({ turnover: '', other: '' })
  const [expenses, setExpenses] = useState({
    costOfGoods: '', staffCosts: '', travelCosts: '', premises: '',
    admin: '', advertising: '', professionalFees: '', interest: '',
    badDebts: '', other: ''
  })

  useEffect(() => { load() }, [businessId])

  async function load() {
    setLoading(true); setError(null)
    try {
      const [bizRes, oblRes] = await Promise.all([
        fetch(`${API}/businesses/${businessId}`, { headers: h }),
        fetch(`${API}/itsa/obligations/${businessId}`, { headers: h })
      ])
      const biz = await bizRes.json()
      const obl = await oblRes.json()
      if (!bizRes.ok) throw new Error(biz.error || 'Failed to load business')
      setBusiness(biz)
      // HMRC returns { obligations: [{ obligationDetails: [...] }] }
      const details = obl?.obligations?.[0]?.obligationDetails ?? obl?.obligationDetails ?? []
      setObligations(details)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitQuarterly() {
    if (!activeObl) return
    setWorking(true); setError(null)
    try {
      const taxYear = taxYearFromDates(activeObl.periodStartDate)
      const body = {
        taxYear,
        periodStartDate: activeObl.periodStartDate,
        periodEndDate:   activeObl.periodEndDate,
        income:   { turnover: Number(income.turnover) || 0, other: Number(income.other) || 0 },
        expenses: Object.fromEntries(
          Object.entries(expenses).map(([k, v]) => [k, Number(v) || 0])
        )
      }
      const res = await fetch(`${API}/itsa/quarterly/${businessId}`, {
        method: 'POST', headers: h, body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'Submission failed')
      setLastReceipt({ type: 'Quarterly update', period: `${fmt(activeObl.periodStartDate)} – ${fmt(activeObl.periodEndDate)}`, taxYear })
      setView('success')
      resetForm()
    } catch (e) {
      setError(e.message)
    } finally {
      setWorking(false)
    }
  }

  function resetForm() {
    setIncome({ turnover: '', other: '' })
    setExpenses({ costOfGoods: '', staffCosts: '', travelCosts: '', premises: '',
      admin: '', advertising: '', professionalFees: '', interest: '', badDebts: '', other: '' })
    setActiveObl(null)
  }

  function openForm(obl) {
    setActiveObl(obl)
    resetForm()
    setError(null)
    setView('form')
  }

  // Map obligations to timeline slots
  const quarterObligations = obligations.filter(o =>
    !o.obligationType || o.obligationType === 'Quarterly'
  ).sort((a, b) => new Date(a.periodStartDate) - new Date(b.periodStartDate))

  const fulfilledCount = quarterObligations.filter(o => o.status === 'Fulfilled').length
  const openQuarters   = quarterObligations.filter(o => o.status === 'Open')
  const allQuartersDone = quarterObligations.length > 0 && openQuarters.length === 0

  const stages = quarterObligations.map((o, i) => ({
    label: quarterLabel(i),
    sub: `${fmt(o.periodStartDate)} – ${fmt(o.periodEndDate)}`,
    due: `Due ${fmt(o.dueDate)}`,
    status: o.status === 'Fulfilled' ? 'done' : o.status === 'Open' ? 'open' : 'locked',
    obl: o
  }))

  // EOPS unlocks after all 4 quarters done
  stages.push({
    label: 'EOPS',
    sub: 'End of Period Statement',
    due: 'After Q4',
    status: allQuartersDone ? 'open' : 'locked',
    obl: null
  })
  // Final Declaration unlocks after EOPS (simplified: same gate for now)
  stages.push({
    label: 'Final',
    sub: 'Final Declaration',
    due: 'After EOPS',
    status: allQuartersDone ? 'open' : 'locked',
    obl: null
  })

  const taxYear = quarterObligations[0]
    ? taxYearFromDates(quarterObligations[0].periodStartDate)
    : '—'

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500">Loading ITSA obligations…</p>
      </div>
    </div>
  )

  // ── Success ───────────────────────────────────────────────────────────────────
  if (view === 'success') return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Submitted to HMRC</h2>
          {lastReceipt && (
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">{lastReceipt.type}</span></p>
              <p>{lastReceipt.period}</p>
              <p className="text-gray-400">Tax year {lastReceipt.taxYear}</p>
            </div>
          )}
          <div className="pt-2 flex gap-3 justify-center">
            <button onClick={() => { setView('timeline'); load() }}
              className="px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition">
              Back to timeline
            </button>
            <button onClick={() => navigate('/dashboard')}
              className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
              Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Quarterly Form ────────────────────────────────────────────────────────────
  if (view === 'form' && activeObl) {
    const netProfit = (Number(income.turnover) || 0) + (Number(income.other) || 0)
      - Object.values(expenses).reduce((s, v) => s + (Number(v) || 0), 0)

    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-6">
          <button onClick={() => { setView('timeline'); setError(null) }}
            className="text-sm text-violet-600 hover:underline flex items-center gap-1">
            ← Back to timeline
          </button>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-violet-600 bg-violet-50 px-2 py-0.5 rounded">
                  Quarterly Update
                </span>
                <span className="text-xs text-gray-400">Tax year {taxYearFromDates(activeObl.periodStartDate)}</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {fmt(activeObl.periodStartDate)} – {fmt(activeObl.periodEndDate)}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Due {fmt(activeObl.dueDate)}</p>
            </div>

            {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

            {/* Income */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">Income</h3>
              <div className="grid grid-cols-2 gap-3">
                {[['turnover', 'Turnover'], ['other', 'Other income']].map(([k, label]) => (
                  <div key={k}>
                    <label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                      <input type="number" min="0" step="0.01" value={income[k]}
                        onChange={e => setIncome(p => ({ ...p, [k]: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Expenses */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">Expenses</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['costOfGoods', 'Cost of goods'], ['staffCosts', 'Staff costs'],
                  ['travelCosts', 'Travel'], ['premises', 'Premises'],
                  ['admin', 'Admin'], ['advertising', 'Advertising'],
                  ['professionalFees', 'Professional fees'], ['interest', 'Interest'],
                  ['badDebts', 'Bad debts'], ['other', 'Other expenses']
                ].map(([k, label]) => (
                  <div key={k}>
                    <label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                      <input type="number" min="0" step="0.01" value={expenses[k]}
                        onChange={e => setExpenses(p => ({ ...p, [k]: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Net profit summary */}
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Net profit / loss</span>
              <span className={`text-lg font-bold ${netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {netProfit < 0 ? '-' : ''}£{Math.abs(netProfit).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => { setView('timeline'); setError(null) }}
                className="flex-none rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={submitQuarterly} disabled={working}
                className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition">
                {working ? 'Submitting to HMRC…' : 'Submit quarterly update →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Timeline ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/dashboard')}
            className="text-sm text-violet-600 hover:underline flex items-center gap-1">
            ← Dashboard
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Self Assessment — ITSA</h1>
              {business && (
                <p className="mt-1 text-sm text-gray-500">
                  {business.businessName} · NINO: <span className="font-mono">{business.nino}</span>
                </p>
              )}
            </div>
            {taxYear !== '—' && (
              <span className="flex-none text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200 rounded-full px-3 py-1">
                {taxYear}
              </span>
            )}
          </div>

          {/* Progress bar */}
          {stages.length > 0 && (
            <div className="mt-5">
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>{fulfilledCount} of {quarterObligations.length} quarters submitted</span>
                <span>{Math.round((fulfilledCount / Math.max(quarterObligations.length, 1)) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="bg-violet-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(fulfilledCount / Math.max(quarterObligations.length, 1)) * 100}%` }} />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
        )}

        {/* Timeline stages */}
        {stages.length === 0 && !loading && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-gray-500 text-sm">No ITSA obligations found for this business.</p>
            <p className="text-xs text-gray-400 mt-1">Check that the business is enrolled for MTD Income Tax.</p>
          </div>
        )}

        <div className="space-y-3">
          {stages.map((s, i) => {
            const isDone   = s.status === 'done'
            const isOpen   = s.status === 'open'
            const isLocked = s.status === 'locked'

            return (
              <div key={i}
                className={`bg-white rounded-xl border transition-all ${
                  isDone   ? 'border-green-200 opacity-80' :
                  isOpen   ? 'border-violet-300 shadow-sm ring-1 ring-violet-100' :
                             'border-gray-200 opacity-60'
                }`}>
                <div className="flex items-center gap-4 p-4">
                  {/* Stage icon */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-none text-sm font-bold ${
                    isDone   ? 'bg-green-100 text-green-700' :
                    isOpen   ? 'bg-violet-100 text-violet-700' :
                               'bg-gray-100 text-gray-400'
                  }`}>
                    {isDone ? '✓' : isLocked ? '🔒' : s.label.length <= 2 ? s.label : '→'}
                  </div>

                  {/* Stage info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900">{s.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isDone   ? 'bg-green-50 text-green-700' :
                        isOpen   ? 'bg-violet-50 text-violet-700' :
                                   'bg-gray-50 text-gray-400'
                      }`}>
                        {isDone ? 'Submitted' : isOpen ? 'Open' : 'Locked'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{s.sub}</p>
                    {s.due && <p className="text-xs text-gray-400">{s.due}</p>}
                  </div>

                  {/* Action */}
                  {isOpen && s.obl && (
                    <button onClick={() => openForm(s.obl)}
                      className="flex-none rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition">
                      Submit
                    </button>
                  )}
                  {isOpen && !s.obl && s.label === 'EOPS' && (
                    <button disabled
                      className="flex-none rounded-lg bg-gray-200 px-4 py-2 text-xs font-semibold text-gray-400 cursor-not-allowed">
                      Coming soon
                    </button>
                  )}
                  {isOpen && !s.obl && s.label === 'Final' && (
                    <button disabled
                      className="flex-none rounded-lg bg-gray-200 px-4 py-2 text-xs font-semibold text-gray-400 cursor-not-allowed">
                      Coming soon
                    </button>
                  )}
                  {isDone && (
                    <div className="flex-none w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Connector line */}
                {i < stages.length - 1 && (
                  <div className="ml-9 pl-5 pb-1">
                    <div className={`w-px h-3 ${isDone ? 'bg-green-200' : 'bg-gray-200'}`} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Info note */}
        <p className="text-xs text-center text-gray-400 pb-4">
          Submit each quarterly update in order. EOPS and Final Declaration unlock after all quarters are complete.
        </p>

      </div>
    </div>
  )
}
