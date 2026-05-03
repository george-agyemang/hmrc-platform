import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const BUSINESS_TYPES = [
  { value: 'SOLE_TRADER',     label: 'Sole Trader' },
  { value: 'LIMITED_COMPANY', label: 'Limited Company' },
  { value: 'PARTNERSHIP',     label: 'Partnership' },
]

const API = import.meta.env.VITE_API_URL

export default function AddBusiness() {
  const navigate = useNavigate()
  const token = localStorage.getItem('auth_token')
  const [form, setForm]               = useState({ name: '', type: 'SOLE_TRADER', vrn: '', utr: '', crn: '', nino: '' })
  const [errors, setErrors]           = useState([])
  const [submitting, setSubmitting]   = useState(false)
  const [looking, setLooking]         = useState(false)
  const [lookupResult, setLookupResult] = useState(null)

  const set = (field) => (e) => { setForm((f) => ({ ...f, [field]: e.target.value })); setLookupResult(null) }

  async function handleLookup() {
    const nino = form.nino.trim().toUpperCase()
    if (!nino) { setErrors(['Enter a NINO before looking up']); return }
    setLooking(true); setErrors([]); setLookupResult(null)
    try {
      const res = await fetch(`${API}/businesses/hmrc/details/${nino}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) { setErrors([data.error ?? 'HMRC lookup failed']); return }
      const biz = data.businesses?.[0]
      if (!biz) { setErrors(['No self-employment businesses found for this NINO in HMRC']); return }
      setLookupResult(biz)
      setForm((f) => ({ ...f, name: biz.tradingName || biz.businessName || f.name }))
    } catch { setErrors(['Network error during HMRC lookup']) }
    finally { setLooking(false) }
  }

  async function handleSubmit(e) {
    e.preventDefault(); setErrors([]); setSubmitting(true)
    try {
      const res = await fetch(`${API}/businesses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ businessName: form.name, businessType: form.type.toUpperCase(), vrn: form.vrn.replace(/\s/g,''), utr: form.utr.replace(/\s/g,''), crn: form.crn.replace(/\s/g,''), nino: form.nino.replace(/\s/g,'').toUpperCase() }),
      })
      const data = await res.json()
      if (!res.ok) { setErrors(data.errors ?? [data.error ?? 'Something went wrong']); return }
      navigate('/dashboard')
    } catch { setErrors(['Network error. Please try again.']) }
    finally { setSubmitting(false) }
  }

  const inp = 'block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none'
  const lbl = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start pt-16 px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Add a Business</h1>
          <p className="mt-1 text-sm text-gray-500">Register a business to start submitting VAT and Income Tax returns via MTD.</p>
        </div>
        {errors.length > 0 && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm font-semibold text-red-700 mb-1">Please fix the following:</p>
            <ul className="list-disc list-inside space-y-0.5">{errors.map((e,i) => <li key={i} className="text-sm text-red-600">{e}</li>)}</ul>
          </div>
        )}
        {lookupResult && (
          <div className="mb-6 rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
            ✓ Found: <strong>{lookupResult.tradingName || lookupResult.businessName}</strong>
            {lookupResult.selfEmploymentId && <span className="ml-2 text-xs text-emerald-600 font-mono">({lookupResult.selfEmploymentId})</span>}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={lbl}>Business Type <span className="text-red-500">*</span></label>
            <select value={form.type} onChange={set('type')} className={inp}>
              {BUSINESS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {form.type === 'SOLE_TRADER' && (
            <div>
              <label className={lbl}>National Insurance Number (NINO)</label>
              <div className="flex gap-2">
                <input type="text" value={form.nino} onChange={set('nino')} placeholder="QQ123456A" maxLength={9} className={inp + ' flex-1 uppercase'} />
                <button type="button" onClick={handleLookup} disabled={looking}
                  className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition">
                  {looking ? 'Looking up…' : '↗ Look up HMRC'}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400">Required for ITSA submissions. Click look up to auto-fill business name from HMRC.</p>
            </div>
          )}
          <div>
            <label className={lbl}>Business Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={set('name')} placeholder="e.g. Acme Trading" className={inp} required />
          </div>
          <div>
            <label className={lbl}>VAT Registration Number (VRN)</label>
            <input type="text" value={form.vrn} onChange={set('vrn')} placeholder="123456789" maxLength={9} className={inp} />
            <p className="mt-1 text-xs text-gray-400">9 digits — required for VAT submissions</p>
          </div>
          <div>
            <label className={lbl}>Unique Taxpayer Reference (UTR)</label>
            <input type="text" value={form.utr} onChange={set('utr')} placeholder="1234567890" maxLength={10} className={inp} />
            <p className="mt-1 text-xs text-gray-400">10 digits — required for Income Tax (ITSA)</p>
          </div>
          {form.type === 'LIMITED_COMPANY' && (
            <div>
              <label className={lbl}>Company Registration Number (CRN)</label>
              <input type="text" value={form.crn} onChange={set('crn')} placeholder="12345678" maxLength={8} className={inp} />
            </div>
          )}
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition">{submitting ? 'Adding…' : 'Add Business'}</button>
            <button type="button" onClick={() => navigate('/dashboard')} className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
