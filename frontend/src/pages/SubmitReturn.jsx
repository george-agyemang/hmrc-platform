import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDraft } from '../hooks/useDraft'

const API = import.meta.env.VITE_API_URL

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function currency(val) {
  const n = parseFloat(val) || 0
  return n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 })
}

function pounds(val) {
  const n = Math.round(parseFloat(val) || 0)
  return '£' + n.toLocaleString('en-GB')
}

function downloadCsvTemplate() {
  const headers = [
    'Box 1 - VAT due on sales and other outputs',
    'Box 2 - VAT due on acquisitions from other EC Member States',
    'Box 4 - VAT reclaimed on purchases and other inputs',
    'Box 6 - Total value of sales and all other outputs excl. VAT (whole £)',
    'Box 7 - Total value of purchases and all other inputs excl. VAT (whole £)',
    'Box 8 - Total value of all supplies of goods to other EC Member States (whole £)',
    'Box 9 - Total value of all acquisitions of goods from other EC Member States (whole £)',
  ]
  const csv = [headers.join(','), Array(headers.length).fill('').join(',')].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'vat-return-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const emptyBoxes = { box1: '', box2: '', box4: '', box6: '', box7: '', box8: '', box9: '' }

export default function SubmitReturn() {
  const { businessId } = useParams()
  const navigate = useNavigate()
  const token = localStorage.getItem('auth_token')

  const [business, setBusiness]       = useState(null)
  const [obligations, setObligations] = useState([])
  const [selected, setSelected]       = useState(null)
  const [mode, setMode]               = useState('nil')
  const [boxes, setBoxes]             = useState(emptyBoxes)
  const [loading, setLoading]         = useState(true)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState(null)
  const [receipt, setReceipt]         = useState(null)

  const box3 = Math.round(((parseFloat(boxes.box1) || 0) + (parseFloat(boxes.box2) || 0)) * 100) / 100
  const box5 = Math.round(Math.abs(box3 - (parseFloat(boxes.box4) || 0)) * 100) / 100

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
        setBusiness(biz.business ?? biz)
        const obs = obl.obligations ?? []
        setObligations(obs)
        if (obs.length === 1) setSelected(obs[0])
      } catch {
        setError('Failed to load obligations')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [businessId, token])

  const selectPeriod = useCallback((ob) => {
    setSelected(ob)
    setBoxes(emptyBoxes)
    setError(null)
    setReceipt(null)
  }, [])

  function setBox(key, raw) {
    const cleaned = raw.replace(/[^0-9.]/g, '')
    const updated = { ...boxes, [key]: cleaned }
    setBoxes(updated)
    triggerAutoSave(updated)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selected) return
    const isNil = mode === 'nil'
    const confirmMsg = isNil
      ? `Submit a NIL VAT return for period ${selected.periodKey}?\n\nAll values will be £0.00. This cannot be undone.`
      : `Submit this VAT return to HMRC for period ${selected.periodKey}?\n\nPlease check all values before confirming. This cannot be undone.`
    if (!window.confirm(confirmMsg)) return
    setSubmitting(true)
    setError(null)
    try {
      const base = { businessId, periodKey: selected.periodKey, periodStart: selected.start, periodEnd: selected.end }
      const endpoint = isNil ? `${API}/submissions/vat/nil` : `${API}/submissions/vat/full`
      const body = isNil ? base : { ...base, ...boxes }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Submission failed'); return }
      const rcpt = data.receipt ?? (data.submission?.hmrcReceiptId ? { formBundleNumber: data.submission.hmrcReceiptId } : null)
      setReceipt(rcpt)
      setObligations((prev) => prev.filter((o) => o.periodKey !== selected.periodKey))
      setSelected(null)
      setBoxes(emptyBoxes)
      clearDraft()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500 text-sm animate-pulse">
      Loading obligations…
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-6">

        <button onClick={() => navigate('/dashboard')} className="text-sm text-indigo-600 hover:underline">
          ← Back to dashboard
        </button>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h1 className="text-xl font-bold text-gray-900">Submit VAT Return</h1>
          {business && (
            <p className="mt-1 text-sm text-gray-500">
              {business.businessName ?? business.name} · VRN: {business.vrn}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
        )}

        {receipt && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-green-600 text-xl">✓</span>
              <h2 className="font-semibold text-green-800">Return submitted successfully</h2>
            </div>
            <dl className="space-y-1 text-sm text-green-700">
              {receipt.formBundleNumber && (
                <div className="flex justify-between">
                  <dt className="font-medium">Form bundle number</dt>
                  <dd className="font-mono">{receipt.formBundleNumber}</dd>
                </div>
              )}
              {receipt.processingDate && (
                <div className="flex justify-between">
                  <dt className="font-medium">Processing date</dt>
                  <dd>{fmt(receipt.processingDate)}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Outstanding Periods</h2>
          {obligations.length === 0 ? (
            <p className="text-sm text-gray-500">
              {receipt ? 'All obligations are up to date.' : 'No outstanding VAT obligations found.'}
            </p>
          ) : (
            <div className="space-y-3">
              {obligations.map((ob) => (
                <button key={ob.periodKey} type="button" onClick={() => selectPeriod(ob)}
                  className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                    selected?.periodKey === ob.periodKey
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
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
          )}
        </div>

        {selected && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">

            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
              <button type="button" onClick={() => { setMode('nil'); setBoxes(emptyBoxes); setError(null) }}
                className={`flex-1 py-2 transition ${mode === 'nil' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                Nil Return
              </button>
              <button type="button" onClick={() => { setMode('full'); setError(null) }}
                className={`flex-1 py-2 transition border-l border-gray-200 ${mode === 'full' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                Full Return
              </button>
            </div>

            {mode === 'nil' && (
              <>
                <p className="text-xs text-gray-500">
                  All nine boxes will be submitted as £0.00 / £0. Use this only if the business had no VAT activity in this period.
                </p>
                <dl className="divide-y divide-gray-100 text-sm">
                  {[['Box 1','VAT due on sales','£0.00'],['Box 2','VAT due on acquisitions','£0.00'],['Box 3','Total VAT due (auto)','£0.00'],['Box 4','VAT reclaimed','£0.00'],['Box 5','Net VAT (auto)','£0.00'],['Box 6','Total sales excl. VAT','£0'],['Box 7','Total purchases excl. VAT','£0'],['Box 8','Goods to EC','£0'],['Box 9','Acquisitions from EC','£0']].map(([box, label, val]) => (
                    <div key={box} className="flex justify-between py-1.5">
                      <dt className="text-gray-500"><span className="font-semibold text-gray-700">{box}</span> — {label}</dt>
                      <dd className="font-mono text-gray-900">{val}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}

            {mode === 'full' && (
              <>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Spreadsheet template</p>
                    <p className="text-xs text-gray-400 mt-0.5">Download, fill in offline, then enter values below. Upload coming soon.</p>
                  </div>
                  <button type="button" onClick={downloadCsvTemplate}
                    className="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-700 border border-indigo-200 rounded-md px-3 py-1.5 hover:bg-indigo-50 transition">
                    ↓ CSV template
                  </button>
                </div>

                <div className="space-y-3">
                  <BoxInput id="box1" label="Box 1" desc="VAT due on sales and other outputs" value={boxes.box1} onChange={(v) => setBox('box1', v)} placeholder="0.00" />
                  <BoxInput id="box2" label="Box 2" desc="VAT due on acquisitions from other EC Member States" value={boxes.box2} onChange={(v) => setBox('box2', v)} placeholder="0.00" />
                  <AutoBox label="Box 3" desc="Total VAT due (Box 1 + Box 2)" value={currency(box3)} />
                  <BoxInput id="box4" label="Box 4" desc="VAT reclaimed on purchases and other inputs" value={boxes.box4} onChange={(v) => setBox('box4', v)} placeholder="0.00" />
                  <AutoBox label="Box 5" desc="Net VAT to pay or reclaim (|Box 3 − Box 4|)" value={currency(box5)} />
                  <div className="pt-1 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-3">Boxes 6–9: whole pounds only, no pence</p>
                    <div className="space-y-3">
                      <BoxInput id="box6" label="Box 6" desc="Total value of sales and all other outputs excl. VAT" value={boxes.box6} onChange={(v) => setBox('box6', v)} placeholder="0" />
                      <BoxInput id="box7" label="Box 7" desc="Total value of purchases and all other inputs excl. VAT" value={boxes.box7} onChange={(v) => setBox('box7', v)} placeholder="0" />
                      <BoxInput id="box8" label="Box 8" desc="Total value of all supplies of goods to other EC Member States excl. VAT" value={boxes.box8} onChange={(v) => setBox('box8', v)} placeholder="0" />
                      <BoxInput id="box9" label="Box 9" desc="Total value of all acquisitions of goods from other EC Member States excl. VAT" value={boxes.box9} onChange={(v) => setBox('box9', v)} placeholder="0" />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="text-indigo-700">Box 5 (net VAT due)</div>
                  <div className="text-right font-mono font-semibold text-indigo-900">{currency(box5)}</div>
                  <div className="text-indigo-700">Box 6 (total sales)</div>
                  <div className="text-right font-mono font-semibold text-indigo-900">{pounds(boxes.box6)}</div>
                </div>
              </>
            )}

            <div className="flex items-center gap-3 pt-1">
              <div className="flex items-center justify-between pt-2 pb-1">
            <span className="text-xs text-gray-400">
              {draftStatus === 'saving' && (
                <span className="flex items-center gap-1 text-gray-400">
                  <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  Saving…
                </span>
              )}
              {draftStatus === 'saved' && <span className="text-green-600">✓ Draft saved</span>}
              {draftStatus === 'idle' && draftSavedAt && (
                <span>Saved {draftSavedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              )}
              {draftStatus === 'error' && <span className="text-red-500">Save failed</span>}
            </span>
            <button type="button" onClick={() => saveDraft(boxes)} disabled={draftStatus === 'saving' || !selected}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
              Save &amp; continue later
            </button>
          </div>
          <button type="submit" disabled={submitting}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition">
                {submitting ? 'Submitting…' : mode === 'nil' ? 'Submit Nil Return to HMRC' : 'Submit VAT Return to HMRC'}
              </button>
              <button type="button" onClick={() => { setSelected(null); setBoxes(emptyBoxes); setError(null) }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
                Cancel
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}

function BoxInput({ id, label, desc, value, onChange, placeholder }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-12 shrink-0 mt-2.5">
        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="block text-xs text-gray-500 mb-1">{desc}</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
          <input id={id} type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        </div>
      </div>
    </div>
  )
}

function AutoBox({ label, desc, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-12 shrink-0 mt-2.5">
        <span className="text-xs font-bold text-gray-400 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 mb-1">{desc}</p>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-600 flex items-center gap-2">
          <span className="text-xs text-gray-400 uppercase tracking-wide">auto</span>
          <span className="ml-auto">{value}</span>
        </div>
      </div>
    </div>
  )
}
