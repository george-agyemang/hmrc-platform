import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

const API = import.meta.env.VITE_API_URL

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function SubmitReturn() {
  const { businessId } = useParams()
  const navigate = useNavigate()
  const { token } = useAuth()
  const [business, setBusiness] = useState(null)
  const [obligations, setObligations] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [receipt, setReceipt] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const headers = { Authorization: `Bearer ${token}` }
        const [bizRes, oblRes] = await Promise.all([
          fetch(`${API}/businesses/${businessId}`, { headers }),
          fetch(`${API}/submissions/obligations/vat/${businessId}`, { headers }),
        ])
        const biz = await bizRes.json()
        const obl = await oblRes.json()
        setBusiness(biz.business)
        const obs = obl.obligations ?? []
        setObligations(obs)
        if (obs.length === 1) setSelected(obs[0])
      } catch { setError('Failed to load obligations') }
      finally { setLoading(false) }
    }
    load()
  }, [businessId, token])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selected) return
    if (!window.confirm(`Submit a NIL VAT return for period ${selected.periodKey}?\n\nAll values will be £0.00. This cannot be undone.`)) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${API}/submissions/vat/nil`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ businessId, periodKey: selected.periodKey, periodStart: selected.start, periodEnd: selected.end }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Submission failed'); return }
      setReceipt(data.receipt)
      setObligations((prev) => prev.filter((o) => o.periodKey !== selected.periodKey))
      setSelected(null)
    } catch { setError('Network error. Please try again.') }
    finally { setSubmitting(false) }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500 text-sm animate-pulse">Loading obligations…</div>

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/dashboard')} className="text-sm text-indigo-600 hover:underline">← Back to dashboard</button>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h1 className="text-xl font-bold text-gray-900">Submit VAT Return</h1>
          {business && <p className="mt-1 text-sm text-gray-500">{business.name} · VRN: {business.vrn}</p>}
        </div>
        {error && <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>}
        {receipt && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-6">
            <div className="flex items-center gap-2 mb-3"><span className="text-green-600 text-xl">✓</span><h2 className="font-semibold text-green-800">Return submitted successfully</h2></div>
            <dl className="space-y-1 text-sm text-green-700">
              <div className="flex justify-between"><dt className="font-medium">Form bundle number</dt><dd className="font-mono">{receipt.formBundleNumber}</dd></div>
              <div className="flex justify-between"><dt className="font-medium">Processing date</dt><dd>{fmt(receipt.processingDate)}</dd></div>
            </dl>
          </div>
        )}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Outstanding Periods</h2>
          {obligations.length === 0 && <p className="text-sm text-gray-500">{receipt ? 'All obligations are up to date.' : 'No outstanding VAT obligations found.'}</p>}
          <div className="space-y-3">
            {obligations.map((ob) => (
              <button key={ob.periodKey} type="button" onClick={() => setSelected(ob)}
                className={`w-full text-left rounded-xl border px-4 py-3 transition ${selected?.periodKey === ob.periodKey ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Period: <span className="font-mono">{ob.periodKey}</span></p>
                    <p className="text-xs text-gray-500 mt-0.5">{fmt(ob.start)} → {fmt(ob.end)}</p>
                  </div>
                  {ob.due && <span className="text-xs text-orange-600 font-medium">Due {fmt(ob.due)}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
        {selected && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Nil Return — All boxes £0.00</h2>
            <dl className="divide-y divide-gray-100 text-sm">
              {[['Box 1 — VAT due on sales','£0.00'],['Box 2 — VAT due on acquisitions','£0.00'],['Box 3 — Total VAT due','£0.00'],['Box 4 — VAT reclaimed','£0.00'],['Box 5 — Net VAT','£0.00'],['Box 6 — Total sales (ex. VAT)','£0'],['Box 7 — Total purchases (ex. VAT)','£0'],['Box 8 — Goods to EU','£0'],['Box 9 — Acquisitions from EU','£0']].map(([l,v]) => (
                <div key={l} className="flex justify-between py-1.5"><dt className="text-gray-600">{l}</dt><dd className="font-mono text-gray-900">{v}</dd></div>
              ))}
            </dl>
            <div className="flex items-center gap-3 pt-2">
              <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition">
                {submitting ? 'Submitting…' : 'Submit Nil Return to HMRC'}
              </button>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
