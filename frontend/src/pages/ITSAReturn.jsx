import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const currency = (v) => (parseFloat(v) || 0).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })

function authHeaders(token) { return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }

function taxYearFrom(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr); const y = d.getFullYear(); const m = d.getMonth() + 1
  const startYear = m < 4 || (m === 4 && d.getDate() < 6) ? y - 1 : y
  return `${startYear}-${String(startYear + 1).slice(2)}`
}

const STEPS = ['Obligations', 'Income & Expenses', 'Calculation', 'Declaration']

function StepIndicator({ step }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const active = i === step; const complete = i < step
        return (
          <div key={label} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition ${active ? 'bg-violet-600 text-white' : complete ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-400'}`}>
              <span>{complete ? '✓' : i + 1}</span><span>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`w-6 h-px ${complete ? 'bg-violet-300' : 'bg-gray-200'}`} />}
          </div>
        )
      })}
    </div>
  )
}

function NumInput({ id, label, hint, value, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
        <input id={id} type="text" inputMode="decimal" value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00"
          className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
      </div>
    </div>
  )
}

export default function ITSAReturn() {
  const { businessId } = useParams(); const navigate = useNavigate()
  const token = localStorage.getItem('auth_token')
  const [business, setBusiness]                     = useState(null)
  const [step, setStep]                             = useState(0)
  const [loading, setLoading]                       = useState(true)
  const [error, setError]                           = useState(null)
  const [working, setWorking]                       = useState(false)
  const [obligations, setObligations]               = useState([])
  const [seBusinesses, setSeBusinesses]             = useState([])
  const [selectedObligation, setSelectedObligation] = useState(null)
  const [selectedSeBiz, setSelectedSeBiz]           = useState(null)
  const [income, setIncome]                         = useState({ turnover: '', other: '' })
  const [expenses, setExpenses]                     = useState({ consolidated: '' })
  const [useDetailed, setUseDetailed]               = useState(false)
  const [detailedExp, setDetailedExp]               = useState({ costOfGoods: '', staffCosts: '', travelCosts: '', premisesRunningCosts: '', professionalFees: '', otherExpenses: '' })
  const [calculationId, setCalculationId]           = useState(null)
  const [taxYear, setTaxYear]                       = useState(null)
  const [calculation, setCalculation]               = useState(null)
  const [receipt, setReceipt]                       = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const h = { Authorization: `Bearer ${token}` }
        const [bizRes, oblRes, seRes] = await Promise.all([
          fetch(`${API}/businesses/${businessId}`, { headers: h }),
          fetch(`${API}/submissions/obligations/itsa/${businessId}`, { headers: h }),
          fetch(`${API}/submissions/itsa/businesses/${businessId}`, { headers: h }),
        ])
        const biz = await bizRes.json(); setBusiness(biz.business ?? biz)
        const obl = await oblRes.json()
        const flat = (obl.obligations || []).flatMap(o =>
          (o.obligationDetails || []).map(d => ({
            businessId: o.businessId, typeOfBusiness: o.typeOfBusiness,
            fromDate: d.inboundCorrespondenceFromDate, toDate: d.inboundCorrespondenceToDate,
            dueDate: d.inboundCorrespondenceDueDate, periodKey: d.periodKey, status: d.status,
          }))
        ).filter(d => d.status === 'Open' || d.status === 'O')
        setObligations(flat)
        if (flat.length === 1) setSelectedObligation(flat[0])
        const se = await seRes.json(); const seList = se.seBusinesses || []
        setSeBusinesses(seList)
        if (seList.length === 1) setSelectedSeBiz(seList[0])
      } catch { setError('Failed to load ITSA data. Ensure this business has a NINO set and HMRC is connected.') }
      finally { setLoading(false) }
    }
    load()
  }, [businessId, token])

  function proceedToForm() {
    if (!selectedObligation) { setError('Select a period first'); return }
    if (seBusinesses.length > 0 && !selectedSeBiz) { setError('Select a self-employment business first'); return }
    setTaxYear(taxYearFrom(selectedObligation.fromDate)); setError(null); setStep(1)
  }

  async function submitPeriodic() {
    setWorking(true); setError(null)
    try {
      const expPayload = useDetailed ? detailedExp : { consolidated: expenses.consolidated }
      const res = await fetch(`${API}/submissions/itsa/periodic`, {
        method: 'POST', headers: authHeaders(token),
        body: JSON.stringify({ businessId, selfEmploymentId: selectedSeBiz?.selfEmploymentId || selectedObligation.businessId, periodId: selectedObligation.periodKey, fromDate: selectedObligation.fromDate, toDate: selectedObligation.toDate, income, expenses: expPayload }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Periodic submission failed'); return }
      const calcRes = await fetch(`${API}/submissions/itsa/calculate`, { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ businessId, taxYear }) })
      const calcData = await calcRes.json()
      if (!calcRes.ok) { setError(calcData.error ?? 'Calculation trigger failed'); return }
      setCalculationId(calcData.calculationId)
      const resultRes = await fetch(`${API}/submissions/itsa/calculate/${businessId}/${calcData.calculationId}`, { headers: { Authorization: `Bearer ${token}` } })
      const resultData = await resultRes.json()
      setCalculation(resultData.calculation ?? resultData)
      setStep(2)
    } catch { setError('Network error. Please try again.') }
    finally { setWorking(false) }
  }

  async function submitDeclaration() {
    if (!window.confirm(`Submit your final Self Assessment declaration for ${taxYear}?\n\nThis is your legal declaration that the information is correct and complete. This cannot be undone.`)) return
    setWorking(true); setError(null)
    try {
      const res = await fetch(`${API}/submissions/itsa/crystallise`, { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ businessId, calculationId, taxYear }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Final declaration failed'); return }
      setReceipt(data.submission); setStep(3)
    } catch { setError('Network error. Please try again.') }
    finally { setWorking(false) }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500 text-sm animate-pulse">Loading ITSA obligations…</div>

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/dashboard')} className="text-sm text-violet-600 hover:underline">← Back to dashboard</button>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h1 className="text-xl font-bold text-gray-900">Self Assessment — ITSA Return</h1>
          {business && <p className="mt-1 text-sm text-gray-500">{business.businessName ?? business.name} · NINO: {business.nino}</p>}
          <div className="mt-4"><StepIndicator step={step} /></div>
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>}

        {step === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Open ITSA Periods</h2>
            {obligations.length === 0
              ? <p className="text-sm text-gray-500">No open ITSA obligations found. HMRC may not have outstanding periods for this individual, or the NINO may not be linked to a self-employment business in the sandbox.</p>
              : <div className="space-y-3">{obligations.map((ob, i) => (
                  <button key={i} type="button" onClick={() => setSelectedObligation(ob)}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition ${selectedObligation === ob ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{fmt(ob.fromDate)} → {fmt(ob.toDate)}<span className="ml-2 font-mono text-xs text-gray-400">{ob.periodKey}</span></p>
                        <p className="text-xs text-gray-500 mt-0.5">{ob.typeOfBusiness?.replace('-', ' ')}</p>
                      </div>
                      {ob.dueDate && <span className="text-xs text-orange-600 font-medium">Due {fmt(ob.dueDate)}</span>}
                    </div>
                  </button>
                ))}</div>}
            {seBusinesses.length > 1 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Self-Employment Business</h3>
                <div className="space-y-2">{seBusinesses.map((b, i) => (
                  <button key={i} type="button" onClick={() => setSelectedSeBiz(b)}
                    className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition ${selectedSeBiz === b ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <p className="font-medium">{b.tradingName || b.businessName}</p>
                    <p className="text-xs text-gray-400 font-mono">{b.selfEmploymentId}</p>
                  </button>
                ))}</div>
              </div>
            )}
            <button onClick={proceedToForm} disabled={!selectedObligation}
              className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40 transition">
              Continue to Income & Expenses →
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Income & Expenses · {taxYear}</h2>
              <span className="text-xs text-gray-400 font-mono">{fmt(selectedObligation.fromDate)} – {fmt(selectedObligation.toDate)}</span>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Income</p>
              <NumInput id="turnover" label="Turnover / Gross Income" hint="Total receipts from self-employment before expenses" value={income.turnover} onChange={(v) => setIncome(p => ({ ...p, turnover: v }))} />
              <NumInput id="other-income" label="Other Income" value={income.other} onChange={(v) => setIncome(p => ({ ...p, other: v }))} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Expenses</p>
                <button type="button" onClick={() => setUseDetailed(d => !d)} className="text-xs text-violet-600 hover:underline">
                  {useDetailed ? 'Use consolidated (single total)' : 'Break down by category'}
                </button>
              </div>
              {!useDetailed
                ? <NumInput id="consolidated" label="Total Expenses (consolidated)" hint="All allowable business expenses combined." value={expenses.consolidated} onChange={(v) => setExpenses(p => ({ ...p, consolidated: v }))} />
                : <div className="space-y-3">
                    {[['costOfGoods','Cost of goods / stock'],['staffCosts','Staff costs'],['travelCosts','Car, van & travel'],['premisesRunningCosts','Premises & running costs'],['professionalFees','Professional fees'],['otherExpenses','Other expenses']].map(([key, label]) => (
                      <NumInput key={key} id={key} label={label} value={detailedExp[key]} onChange={(v) => setDetailedExp(p => ({ ...p, [key]: v }))} />
                    ))}
                  </div>}
            </div>
            <div className="rounded-lg bg-violet-50 border border-violet-100 px-4 py-3 grid grid-cols-2 gap-2 text-sm">
              <div className="text-violet-700">Total income</div>
              <div className="text-right font-mono font-semibold text-violet-900">{currency((parseFloat(income.turnover) || 0) + (parseFloat(income.other) || 0))}</div>
              <div className="text-violet-700">Total expenses</div>
              <div className="text-right font-mono font-semibold text-violet-900">{currency(useDetailed ? Object.values(detailedExp).reduce((s, v) => s + (parseFloat(v) || 0), 0) : parseFloat(expenses.consolidated) || 0)}</div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => { setStep(0); setError(null) }} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">← Back</button>
              <button onClick={submitPeriodic} disabled={working} className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition">
                {working ? 'Submitting & calculating…' : 'Submit & Trigger Calculation →'}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Tax Calculation · {taxYear}</h2>
            {calculation ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm space-y-2">
                  <div className="flex justify-between"><span className="text-gray-600">Calculation ID</span><span className="font-mono text-xs text-gray-500">{calculationId}</span></div>
                  {calculation.taxYear && <div className="flex justify-between"><span className="text-gray-600">Tax Year</span><span className="font-semibold">{calculation.taxYear}</span></div>}
                  {calculation.totalIncomeTaxNicsCharged !== undefined && (
                    <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2 mt-2">
                      <span className="text-gray-900">Tax & NICs due</span>
                      <span className="text-violet-800">{currency(calculation.totalIncomeTaxNicsCharged)}</span>
                    </div>
                  )}
                  {calculation.incomeTaxAmount !== undefined && <div className="flex justify-between"><span className="text-gray-600">Income Tax</span><span>{currency(calculation.incomeTaxAmount)}</span></div>}
                  {calculation.nationalInsuranceContributions !== undefined && <div className="flex justify-between"><span className="text-gray-600">NICs</span><span>{currency(calculation.nationalInsuranceContributions)}</span></div>}
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                  <strong>Before declaring:</strong> Review the calculation above. Once submitted, you are making a legal declaration that your return is correct and complete.
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4">
                <p>Calculation triggered (ID: <span className="font-mono text-xs">{calculationId}</span>).</p>
                <p className="mt-1 text-xs text-gray-400">Proceed to declare when ready.</p>
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => { setStep(1); setError(null) }} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">← Back</button>
              <button onClick={submitDeclaration} disabled={working} className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition">
                {working ? 'Submitting declaration…' : 'Submit Final Declaration →'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-6 space-y-3">
            <div className="flex items-center gap-2"><span className="text-green-600 text-2xl">✓</span><h2 className="font-semibold text-green-800 text-lg">Final Declaration Submitted</h2></div>
            <p className="text-sm text-green-700">Your Self Assessment return for tax year <strong>{taxYear}</strong> has been crystallised with HMRC.</p>
            {receipt && (
              <dl className="space-y-1 text-sm text-green-700">
                {receipt.hmrcReceiptId && <div className="flex justify-between"><dt className="font-medium">Transaction reference</dt><dd className="font-mono">{receipt.hmrcReceiptId}</dd></div>}
                <div className="flex justify-between"><dt className="font-medium">Submitted</dt><dd>{fmt(receipt.createdAt)}</dd></div>
              </dl>
            )}
            <button onClick={() => navigate('/dashboard')} className="mt-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 transition">Back to dashboard</button>
          </div>
        )}
      </div>
    </div>
  )
}
