import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'
const taxYearFromDates = (start) => {
  const d = new Date(start), y = d.getFullYear(), m = d.getMonth()
  const sy = m < 3 || (m === 3 && d.getDate() < 6) ? y - 1 : y
  return sy + '-' + String(sy + 1).slice(2)
}
const quarterLabel = (i) => ['Q1','Q2','Q3','Q4'][i] || ('Q'+(i+1))

export default function ITSAReturn() {
  const { businessId } = useParams()
  const navigate = useNavigate()
  const token = localStorage.getItem('auth_token')
  const h = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }

  const [business, setBusiness]       = useState(null)
  const [obligations, setObligations] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [activeObl, setActiveObl]     = useState(null)
  const [view, setView]               = useState('timeline')
  const [working, setWorking]         = useState(false)
  const [lastReceipt, setLastReceipt] = useState(null)
  const [income, setIncome]     = useState({ turnover: '', other: '' })
  const [expenses, setExpenses] = useState({
    costOfGoods:'', staffCosts:'', travelCosts:'', premises:'',
    admin:'', advertising:'', professionalFees:'', interest:'', badDebts:'', other:''
  })

  useEffect(() => { load() }, [businessId])

  async function load() {
    setLoading(true); setError(null)
    try {
      const [bizRes, oblRes] = await Promise.all([
        fetch(API + '/businesses/' + businessId, { headers: h }),
        fetch(API + '/itsa/obligations/' + businessId, { headers: h })
      ])
      const biz = await bizRes.json()
      const obl = await oblRes.json()
      if (!bizRes.ok) throw new Error(biz.error || 'Failed to load business')
      setBusiness(biz)
      const raw = obl?.obligations ?? (obl?.obligationDetails ? [obl] : [])
      setObligations(raw.flatMap(o => o.obligationDetails ?? []))
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function resetForm() {
    setIncome({ turnover:'', other:'' })
    setExpenses({ costOfGoods:'', staffCosts:'', travelCosts:'', premises:'',
      admin:'', advertising:'', professionalFees:'', interest:'', badDebts:'', other:'' })
  }

  function openForm(obl) { setActiveObl(obl); resetForm(); setError(null); setView('form') }

  async function submitQuarterly() {
    if (!activeObl) return
    setWorking(true); setError(null)
    try {
      const taxYear = taxYearFromDates(activeObl.periodStartDate)
      const body = {
        taxYear, periodStartDate: activeObl.periodStartDate, periodEndDate: activeObl.periodEndDate,
        income: { turnover: Number(income.turnover)||0, other: Number(income.other)||0 },
        expenses: Object.fromEntries(Object.entries(expenses).map(([k,v])=>[k,Number(v)||0]))
      }
      const res = await fetch(API + '/itsa/quarterly/' + businessId, { method:'POST', headers:h, body:JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'Submission failed')
      setLastReceipt({ period: fmt(activeObl.periodStartDate) + ' - ' + fmt(activeObl.periodEndDate), taxYear })
      setView('success'); resetForm(); setActiveObl(null)
    } catch(e) { setError(e.message) }
    finally { setWorking(false) }
  }

  const quarters = obligations
    .filter(o => !o.obligationType || o.obligationType === 'Quarterly')
    .sort((a,b) => new Date(a.periodStartDate) - new Date(b.periodStartDate))

  const fulfilledCount = quarters.filter(o => o.status?.toLowerCase() === 'fulfilled').length
  const allDone = quarters.length > 0 && quarters.every(o => o.status?.toLowerCase() === 'fulfilled')

  const stages = quarters.map((o,i) => ({
    label: quarterLabel(i),
    sub: fmt(o.periodStartDate) + ' - ' + fmt(o.periodEndDate),
    due: 'Due ' + fmt(o.dueDate),
    status: o.status?.toLowerCase() === 'fulfilled' ? 'done' : o.status?.toLowerCase() === 'open' ? 'open' : 'locked',
    obl: o
  }))
  stages.push({ label:'EOPS', sub:'End of Period Statement', due:'After Q4', status: allDone ? 'open' : 'locked', obl:null })
  stages.push({ label:'Final', sub:'Final Declaration', due:'After EOPS', status: allDone ? 'open' : 'locked', obl:null })

  const taxYear = quarters[0] ? taxYearFromDates(quarters[0].periodStartDate) : null

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto"/>
        <p className="text-sm text-gray-500">Loading ITSA obligations...</p>
      </div>
    </div>
  )

  if (view === 'success') return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Submitted to HMRC</h2>
          {lastReceipt && <div className="text-sm text-gray-500"><p>{lastReceipt.period}</p><p>Tax year {lastReceipt.taxYear}</p></div>}
          <div className="flex gap-3 justify-center pt-2">
            <button onClick={()=>{setView('timeline');load()}} className="px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition">Back to timeline</button>
            <button onClick={()=>navigate('/dashboard')} className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">Dashboard</button>
          </div>
        </div>
      </div>
    </div>
  )

  if (view === 'form' && activeObl) {
    const net = (Number(income.turnover)||0) + (Number(income.other)||0)
      - Object.values(expenses).reduce((s,v) => s+(Number(v)||0), 0)
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-6">
          <button onClick={()=>{setView('timeline');setError(null)}} className="text-sm text-violet-600 hover:underline">Back to timeline</button>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-violet-600 bg-violet-50 px-2 py-0.5 rounded">Quarterly Update</span>
              <h2 className="text-lg font-bold text-gray-900 mt-2">{fmt(activeObl.periodStartDate)} - {fmt(activeObl.periodEndDate)}</h2>
              <p className="text-xs text-gray-400">Due {fmt(activeObl.dueDate)}</p>
            </div>
            {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">Income</h3>
              <div className="grid grid-cols-2 gap-3">
                {[['turnover','Turnover'],['other','Other income']].map(([k,label]) => (
                  <div key={k}>
                    <label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                      <input type="number" min="0" step="0.01" value={income[k]}
                        onChange={e=>setIncome(p=>({...p,[k]:e.target.value}))}
                        className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">Expenses</h3>
              <div className="grid grid-cols-2 gap-3">
                {[['costOfGoods','Cost of goods'],['staffCosts','Staff costs'],['travelCosts','Travel'],
                  ['premises','Premises'],['admin','Admin'],['advertising','Advertising'],
                  ['professionalFees','Professional fees'],['interest','Interest'],
                  ['badDebts','Bad debts'],['other','Other']].map(([k,label]) => (
                  <div key={k}>
                    <label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                      <input type="number" min="0" step="0.01" value={expenses[k]}
                        onChange={e=>setExpenses(p=>({...p,[k]:e.target.value}))}
                        className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Net profit / loss</span>
              <span className={"text-lg font-bold " + (net >= 0 ? 'text-green-700' : 'text-red-600')}>
                {net < 0 ? '-' : ''}£{Math.abs(net).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}
              </span>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>{setView('timeline');setError(null)}} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={submitQuarterly} disabled={working} className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition">
                {working ? 'Submitting...' : 'Submit quarterly update'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={()=>navigate('/dashboard')} className="text-sm text-violet-600 hover:underline">Back to dashboard</button>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Self Assessment - ITSA</h1>
              {business && <p className="mt-1 text-sm text-gray-500">{business.businessName} · NINO: <span className="font-mono">{business.nino}</span></p>}
            </div>
            {taxYear && <span className="text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200 rounded-full px-3 py-1">{taxYear}</span>}
          </div>
          {quarters.length > 0 && (
            <div className="mt-5">
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>{fulfilledCount} of {quarters.length} quarters submitted</span>
                <span>{Math.round(fulfilledCount/Math.max(quarters.length,1)*100)}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="bg-violet-500 h-1.5 rounded-full transition-all" style={{width:(fulfilledCount/Math.max(quarters.length,1)*100)+'%'}}/>
              </div>
            </div>
          )}
        </div>
        {error && <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>}
        {stages.length === 2 && !loading && <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-500">No ITSA obligations found for this business.</div>}
        <div className="space-y-3">
          {stages.map((s,i) => {
            const isDone=s.status==='done', isOpen=s.status==='open'
            return (
              <div key={i} className={"bg-white rounded-xl border transition-all "+(isDone?'border-green-200 opacity-80':isOpen?'border-violet-300 shadow-sm ring-1 ring-violet-100':'border-gray-200 opacity-60')}>
                <div className="flex items-center gap-4 p-4">
                  <div className={"w-10 h-10 rounded-full flex items-center justify-center flex-none text-sm font-bold "+(isDone?'bg-green-100 text-green-700':isOpen?'bg-violet-100 text-violet-700':'bg-gray-100 text-gray-400')}>
                    {isDone?'✓':s.status==='locked'?'🔒':s.label.length<=2?s.label:'→'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900">{s.label}</span>
                      <span className={"text-xs px-2 py-0.5 rounded-full font-medium "+(isDone?'bg-green-50 text-green-700':isOpen?'bg-violet-50 text-violet-700':'bg-gray-50 text-gray-400')}>
                        {isDone?'Submitted':isOpen?'Open':'Locked'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
                    <p className="text-xs text-gray-400">{s.due}</p>
                  </div>
                  {isOpen && s.obl && <button onClick={()=>openForm(s.obl)} className="flex-none rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition">Submit</button>}
                  {isOpen && !s.obl && <button disabled className="flex-none rounded-lg bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-400 cursor-not-allowed">Coming soon</button>}
                  {isDone && <div className="flex-none w-8 h-8 rounded-full bg-green-100 flex items-center justify-center"><svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg></div>}
                </div>
                {i < stages.length-1 && <div className="ml-9 pl-5 pb-1"><div className={"w-px h-3 "+(isDone?'bg-green-200':'bg-gray-200')}/></div>}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-center text-gray-400 pb-4">Submit each quarterly update in order. EOPS and Final Declaration unlock after all quarters are complete.</p>
      </div>
    </div>
  )
}
