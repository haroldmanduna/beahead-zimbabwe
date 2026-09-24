import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { calculateLandedCost, calculatePenalty, calculateMonthly, formatUSD } from './utils/calculations'
import { ArrowRight, Shield, Wallet, Car, Clock, Plus, LogOut, Upload, X, Check } from 'lucide-react'

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [view, setView] = useState('landing')
  const [goals, setGoals] = useState([])
  const [deposits, setDeposits] = useState([])
  const [selectedCar, setSelectedCar] = useState(null)
  const [showNewCar, setShowNewCar] = useState(false)
  const [showAgreement, setShowAgreement] = useState(false)
  const [loading, setLoading] = useState(true)
  const [authForm, setAuthForm] = useState({ email: '', password: '', fullName: '', phone: '' })
  const [depositForm, setDepositForm] = useState({ goalId: '', amount: '', method: 'bank_transfer', reference: '' })
  const [newCarForm, setNewCarForm] = useState({ make: '', model: '', year: '', price: '', url: '', mileage: '', engine: '' })

  useEffect(() => {
    init()
  }, [])

  const init = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      setUser(session.user)
      await loadProfile(session.user.id)
      await loadData(session.user.id)
      setView('dashboard')
    }
    setLoading(false)
  }

  const loadProfile = async (userId) => {
    const { data } = await supabase.from('beahead_profiles').select('*').eq('id', userId).single()
    if (data) setProfile(data)
  }

  const loadData = async (userId) => {
    const { data: goalsData } = await supabase.from('beahead_goals').select('*, beahead_cars(*)').eq('user_id', userId).order('created_at', { ascending: false })
    if (goalsData) setGoals(goalsData)
    const { data: depData } = await supabase.from('beahead_deposits').select('*, beahead_goals(*, beahead_cars(*))').eq('user_id', userId).order('created_at', { ascending: false })
    if (depData) setDeposits(depData)
  }

  const handleAuth = async (mode) => {
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: authForm.email, password: authForm.password })
        if (error) throw error
        if (data.user) {
          const escrowNum = `BA-${Math.floor(100000+Math.random()*900000)}`
          await supabase.from('beahead_profiles').insert({
            id: data.user.id,
            email: authForm.email,
            full_name: authForm.fullName,
            phone: authForm.phone,
            role: 'user',
            bank_account_number: escrowNum,
            bank_name: 'Partner Bank'
          })
          setUser(data.user)
          setProfile({ full_name: authForm.fullName, bank_account_number: escrowNum })
          setView('dashboard')
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password })
        if (error) throw error
        setUser(data.user)
        await loadProfile(data.user.id)
        await loadData(data.user.id)
        setView('dashboard')
      }
    } catch (e) {
      alert(e.message)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setGoals([])
    setDeposits([])
    setView('landing')
  }

  const handleCreateCar = async (e) => {
    e.preventDefault()
    const carData = {
      beforward_ref: `BF-${newCarForm.make.toUpperCase()}-${Date.now().toString().slice(-6)}`,
      make: newCarForm.make,
      model: newCarForm.model,
      year: parseInt(newCarForm.year),
      price_usd: parseFloat(newCarForm.price),
      freight_usd: 1150,
      mileage: newCarForm.mileage ? parseInt(newCarForm.mileage) : null,
      engine_cc: newCarForm.engine ? parseInt(newCarForm.engine) : 1500,
      fuel_type: 'Petrol',
      transmission: 'Automatic',
      image_url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600',
      beforward_url: newCarForm.url || 'https://www.beforward.jp',
      status: 'available',
      duty_rate: 0.55
    }
    const { data, error } = await supabase.from('beahead_cars').insert(carData).select().single()
    if (error) {
      alert('Could not save car. Please try again.')
      return
    }
    setSelectedCar(data)
    setShowNewCar(false)
    setShowAgreement(true)
    setNewCarForm({ make: '', model: '', year: '', price: '', url: '', mileage: '', engine: '' })
  }

  const createGoal = async () => {
    if (!selectedCar) return
    const calc = calculateLandedCost(selectedCar)
    const goalData = {
      user_id: user.id,
      car_id: selectedCar.id,
      goal_amount_usd: calc.total,
      car_price_usd: calc.carPrice,
      freight_usd: calc.freight,
      duty_estimate_usd: Math.round(calc.duty),
      clearing_fee_usd: calc.clearing,
      beahead_fee_usd: Math.round(calc.beaheadFee),
      beahead_fee_percent: calc.beaheadPercent,
      saved_amount_usd: 0,
      status: 'active',
      progress_percent: 0,
      escrow_account_number: profile?.bank_account_number || `BA-${Math.floor(100000+Math.random()*900000)}`,
      escrow_bank_name: 'Partner Bank - Escrow',
      agreement_signed: true,
      agreement_signed_at: new Date().toISOString(),
      penalty_rate: 0.07,
      monthly_target: calculateMonthly(calc.total, 12),
    }

    const { data, error } = await supabase.from('beahead_goals').insert(goalData).select('*, beahead_cars(*)').single()
    if (error) {
      alert('Could not create savings plan.')
      return
    }
    setGoals([data, ...goals])
    setShowAgreement(false)
    setSelectedCar(null)
  }

  const addDeposit = async (e) => {
    e.preventDefault()
    const goal = goals.find(g => g.id === depositForm.goalId)
    if (!goal) return
    
    const dep = {
      goal_id: depositForm.goalId,
      user_id: user.id,
      amount_usd: Number(depositForm.amount),
      method: depositForm.method,
      reference_code: depositForm.reference,
      verification_status: 'pending',
    }

    const { data, error } = await supabase.from('beahead_deposits').insert(dep).select('*, beahead_goals(*, beahead_cars(*))').single()
    if (error) {
      alert('Deposit failed.')
      return
    }
    setDeposits([data, ...deposits])
    setTimeout(async () => {
      await supabase.from('beahead_deposits').update({ verification_status: 'verified', verified_at: new Date().toISOString() }).eq('id', data.id)
      const { data: allDeps } = await supabase.from('beahead_deposits').select('amount_usd').eq('goal_id', dep.goal_id).eq('verification_status','verified')
      const totalSaved = allDeps?.reduce((s,d)=>s+Number(d.amount_usd),0) || 0
      await supabase.from('beahead_goals').update({ saved_amount_usd: totalSaved, progress_percent: (totalSaved/goal.goal_amount_usd)*100 }).eq('id', dep.goal_id)
      loadData(user.id)
    }, 1000)
    setDepositForm({ goalId: '', amount: '', method: 'bank_transfer', reference: '' })
  }

  const handleCancel = async (goal) => {
    const penalty = calculatePenalty(goal.saved_amount_usd || 0)
    if (!confirm(`Cancel savings plan for ${goal.beahead_cars?.make} ${goal.beahead_cars?.model}?\n\nSaved: ${formatUSD(goal.saved_amount_usd)}\nFee (7%): ${formatUSD(penalty.totalPenalty)}\nYou'll receive: ${formatUSD((goal.saved_amount_usd||0) - penalty.totalPenalty)}`)) return
    await supabase.from('beahead_goals').update({ status: 'cancelled' }).eq('id', goal.id)
    loadData(user.id)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center">
      <div className="w-6 h-6 border-[2.5px] border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#fafaf9] text-zinc-900 antialiased selection:bg-zinc-900 selection:text-white">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap');`}</style>
      
      <header className="sticky top-0 z-40 bg-[#fafaf9]/80 backdrop-blur-2xl border-b border-zinc-200/60">
        <div className="max-w-[1120px] mx-auto px-6 h-[68px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="BeAhead" className="w-8 h-8 rounded-[10px] object-cover"/>
            <span className="font-semibold text-[15px] tracking-[-0.01em]">BeAhead</span>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-3 pl-3 pr-1 py-1 bg-white border border-zinc-200 rounded-full">
                  <div className="text-right leading-tight">
                    <div className="text-[12px] font-medium">{profile?.full_name || 'Account'}</div>
                    <div className="text-[10px] text-zinc-500">{profile?.bank_account_number}</div>
                  </div>
                  <button onClick={handleLogout} className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center"><LogOut size={12}/></button>
                </div>
                <button onClick={handleLogout} className="sm:hidden w-8 h-8 bg-white border border-zinc-200 rounded-full flex items-center justify-center"><LogOut size={14}/></button>
              </>
            ) : (
              <button onClick={() => setView('auth')} className="bg-zinc-900 text-white px-5 py-2.5 rounded-full text-[13px] font-medium hover:bg-black transition">Get started</button>
            )}
          </div>
        </div>
      </header>

      {view === 'landing' && (
        <div>
          <section className="max-w-[1120px] mx-auto px-6 pt-16 md:pt-24 pb-12">
            <div className="max-w-[720px]">
              <div className="inline-flex items-center gap-2 bg-white border border-zinc-200 rounded-full px-3 py-1 text-[11px] font-medium mb-6">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                Built in Bulawayo for Zimbabwean drivers
              </div>
              <h1 className="font-['Fraunces'] text-[44px] md:text-[64px] font-[700] leading-[0.9] tracking-[-0.04em]">
                Save for your<br/>BeForward car,<br/><span className="text-zinc-400">month by month.</span>
              </h1>
              <p className="mt-6 text-[16px] leading-[1.6] text-zinc-600 max-w-[480px] font-[450]">
                Choose any car from BeForward. We calculate the full cost to get it to Zimbabwe. You save monthly into your own bank account. When you're ready, we help you import it.
              </p>
              <div className="mt-8 flex gap-3">
                <button onClick={() => setView('auth')} className="bg-zinc-900 text-white px-6 py-3.5 rounded-full text-[14px] font-medium flex items-center gap-2 hover:bg-black transition">
                  Start your plan <ArrowRight size={16}/>
                </button>
                <button onClick={() => document.getElementById('how').scrollIntoView({behavior:'smooth'})} className="bg-white border border-zinc-200 px-6 py-3.5 rounded-full text-[14px] font-medium hover:border-zinc-300 transition">
                  How it works
                </button>
              </div>
              <div className="mt-10 flex flex-wrap gap-6 text-[12px] text-zinc-500">
                <span className="flex items-center gap-1.5"><Shield size={14} className="text-zinc-900"/> Your money stays in your bank</span>
                <span className="flex items-center gap-1.5"><Wallet size={14} className="text-zinc-900"/> No lump sum needed</span>
                <span className="flex items-center gap-1.5"><Clock size={14} className="text-zinc-900"/> Cancel anytime</span>
              </div>
            </div>

            <div className="mt-16 grid md:grid-cols-3 gap-4">
              <div className="bg-white border border-zinc-200 rounded-[20px] p-6">
                <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center mb-4"><Car size={18} className="text-white"/></div>
                <div className="font-medium text-[14px]">Any BeForward car</div>
                <div className="text-[13px] leading-[1.5] text-zinc-600 mt-1.5">Paste a link from BeForward.jp or enter details manually. We work with the car you actually want.</div>
              </div>
              <div className="bg-white border border-zinc-200 rounded-[20px] p-6">
                <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center mb-4"><Wallet size={18} className="text-white"/></div>
                <div className="font-medium text-[14px]">Save at your pace</div>
                <div className="text-[13px] leading-[1.5] text-zinc-600 mt-1.5">$50 or $500 — whatever works. Track progress, get verified by your bank, no pressure.</div>
              </div>
              <div className="bg-[#f4f4f0] border border-zinc-200 rounded-[20px] p-6">
                <div className="w-10 h-10 bg-white border border-zinc-200 rounded-full flex items-center justify-center mb-4"><Shield size={18}/></div>
                <div className="font-medium text-[14px]">You stay in control</div>
                <div className="text-[13px] leading-[1.5] text-zinc-600 mt-1.5">Funds are held in your account at a partner bank. We only help with paperwork and logistics when you're ready.</div>
              </div>
            </div>
          </section>

          <section id="how" className="bg-white border-y border-zinc-200">
            <div className="max-w-[1120px] mx-auto px-6 py-16 md:py-20">
              <div className="max-w-[560px] mb-12">
                <h2 className="font-['Fraunces'] text-[28px] md:text-[36px] font-[600] leading-[0.95] tracking-[-0.02em]">A simple way to own a car without the upfront burden.</h2>
                <p className="text-[14px] leading-[1.6] text-zinc-600 mt-4">No partnerships to fake. No licensed claims we don't have. Just a clear savings tool that works with your bank.</p>
              </div>
              <div className="grid md:grid-cols-3 gap-8 md:gap-12">
                <div><div className="text-[11px] font-medium tracking-widest text-zinc-400 mb-3">01 / CHOOSE</div><div className="font-medium">Pick your car</div><div className="text-[13px] leading-[1.6] text-zinc-600 mt-2">Find a car on BeForward.jp, copy the link, price and details. We'll calculate shipping, ZIMRA duty estimate and total to get it to Zimbabwe.</div></div>
                <div><div className="text-[11px] font-medium tracking-widest text-zinc-400 mb-3">02 / SAVE</div><div className="font-medium">Save monthly</div><div className="text-[13px] leading-[1.6] text-zinc-600 mt-2">Create a plan, get an escrow reference, and deposit via EcoCash, InnBucks, bank transfer or cash. Upload proof. Bank verifies.</div></div>
                <div><div className="text-[11px] font-medium tracking-widest text-zinc-400 mb-3">03 / IMPORT</div><div className="font-medium">Import when ready</div><div className="text-[13px] leading-[1.6] text-zinc-600 mt-2">At 80-100% we help you reserve the car and handle the import paperwork. You pay BeForward directly from your bank. No middleman holding funds.</div></div>
              </div>
            </div>
          </section>

          <section className="max-w-[1120px] mx-auto px-6 py-12">
            <div className="bg-zinc-900 rounded-[24px] p-8 md:p-10 text-white flex flex-col md:flex-row justify-between gap-8">
              <div><div className="font-['Fraunces'] text-[22px] leading-[1.1]">We're early. Building<br/>in public from Bulawayo.</div><div className="text-[13px] leading-[1.6] text-zinc-400 mt-3 max-w-[380px]">No fake offices. No licensed badges we haven't earned. Just a real product to help Zimbabweans save for cars without needing $6,000 at once. If you're a bank or clearing agent, let's talk.</div></div>
              <div className="flex flex-col gap-3 md:text-right"><div className="text-[12px] text-zinc-400">Contact</div><div className="text-[14px]">Built by a team in Bulawayo • Currently in pilot</div><button onClick={()=>setView('auth')} className="mt-2 bg-white text-zinc-900 px-5 py-2.5 rounded-full text-[13px] font-medium w-fit md:ml-auto">Start saving →</button></div>
            </div>
          </section>
        </div>
      )}

      {view === 'auth' && (
        <div className="max-w-[400px] mx-auto px-6 py-16">
          <div className="text-center mb-8">
            <img src="/logo.png" className="w-12 h-12 rounded-[14px] mx-auto mb-4"/>
            <h2 className="font-['Fraunces'] text-[26px] font-[600] tracking-[-0.02em]">Create your account</h2>
            <p className="text-[13px] text-zinc-600 mt-2">Start saving for your BeForward car. No fees to sign up.</p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-[20px] p-6">
            <div className="space-y-3">
              <input placeholder="Full name" value={authForm.fullName} onChange={e=>setAuthForm({...authForm, fullName:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 focus:outline-none rounded-full px-4 py-3 text-[13px]"/>
              <input placeholder="Phone number" value={authForm.phone} onChange={e=>setAuthForm({...authForm, phone:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 focus:outline-none rounded-full px-4 py-3 text-[13px]"/>
              <input placeholder="Email address" value={authForm.email} onChange={e=>setAuthForm({...authForm, email:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 focus:outline-none rounded-full px-4 py-3 text-[13px]"/>
              <input placeholder="Password" type="password" value={authForm.password} onChange={e=>setAuthForm({...authForm, password:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 focus:outline-none rounded-full px-4 py-3 text-[13px]"/>
              <button onClick={()=>handleAuth('signup')} className="w-full bg-zinc-900 text-white py-3 rounded-full text-[13px] font-medium hover:bg-black transition mt-2">Create account</button>
              <button onClick={()=>handleAuth('login')} className="w-full text-[13px] font-medium py-2.5">Already have an account? Sign in</button>
            </div>
          </div>
        </div>
      )}

      {view === 'dashboard' && (
        <div className="max-w-[1120px] mx-auto px-6 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="font-['Fraunces'] text-[24px] font-[600] tracking-[-0.02em]">Your savings</h2>
              <p className="text-[12px] text-zinc-500 mt-1">{profile?.bank_account_number} • Your escrow reference</p>
            </div>
            <button onClick={()=>setShowNewCar(true)} className="bg-zinc-900 text-white px-5 py-2.5 rounded-full text-[12px] font-medium flex items-center gap-1.5 hover:bg-black transition"><Plus size={14}/> Add a car to save for</button>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-zinc-200 rounded-[16px] p-5"><div className="text-[11px] text-zinc-500">Total saved</div><div className="text-[22px] font-semibold tracking-tight mt-1">{formatUSD(goals.reduce((s,g)=>s+(g.saved_amount_usd||0),0))}</div></div>
            <div className="bg-white border border-zinc-200 rounded-[16px] p-5"><div className="text-[11px] text-zinc-500">Active plans</div><div className="text-[22px] font-semibold tracking-tight mt-1">{goals.filter(g=>g.status==='active').length}</div></div>
            <div className="bg-[#f4f4f0] border border-zinc-200 rounded-[16px] p-5"><div className="text-[11px] text-zinc-500">Escrow status</div><div className="text-[13px] font-medium mt-1 flex items-center gap-1.5"><Shield size={12}/> Funds held in your bank</div></div>
          </div>

          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
            <div>
              <div className="flex items-center justify-between mb-4"><h3 className="font-medium text-[14px]">Your plans</h3><span className="text-[11px] text-zinc-500">{goals.length} plans</span></div>
              {goals.length===0 ? (
                <div className="bg-white border border-dashed border-zinc-300 rounded-[20px] p-10 text-center">
                  <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-3"><Car size={20} className="text-zinc-500"/></div>
                  <div className="font-medium text-[14px]">No savings plans yet</div>
                  <div className="text-[12px] text-zinc-500 mt-1 max-w-[300px] mx-auto">Add a car from BeForward to create your first savings plan. Paste a link or enter details manually.</div>
                  <button onClick={()=>setShowNewCar(true)} className="mt-5 bg-zinc-900 text-white px-5 py-2.5 rounded-full text-[12px] font-medium">Add your first car</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {goals.map(goal => (
                    <div key={goal.id} className="bg-white border border-zinc-200 rounded-[16px] p-5">
                      <div className="flex justify-between items-start">
                        <div><div className="font-medium text-[13px]">{goal.beahead_cars?.make} {goal.beahead_cars?.model} {goal.beahead_cars?.year}</div><div className="text-[11px] text-zinc-500 mt-0.5">{formatUSD(goal.goal_amount_usd)} total needed • {goal.escrow_account_number}</div></div>
                        <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${goal.status==='active'?'bg-zinc-900 text-white':'bg-zinc-100'}`}>{goal.status}</span>
                      </div>
                      <div className="mt-4"><div className="flex justify-between text-[11px] mb-1.5"><span className="text-zinc-500">{formatUSD(goal.saved_amount_usd||0)} saved</span><span className="font-medium">{Math.round(goal.progress_percent||0)}%</span></div><div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden"><div className="h-full bg-zinc-900 rounded-full" style={{width:`${Math.min(100, goal.progress_percent||0)}%`}}></div></div></div>
                      <div className="mt-4 flex gap-2"><button onClick={()=>setDepositForm({...depositForm, goalId: goal.id})} className="flex-1 bg-zinc-900 text-white text-[11px] font-medium py-2 rounded-full">Add money</button><button onClick={()=>handleCancel(goal)} className="flex-1 bg-white border border-zinc-200 text-[11px] font-medium py-2 rounded-full">Cancel plan</button></div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-8 bg-white border border-zinc-200 rounded-[16px] p-5">
                <div className="font-medium text-[13px]">Recent deposits</div>
                <div className="mt-4 space-y-0">
                  {deposits.length===0 && <div className="text-[12px] text-zinc-500 py-6 text-center">No deposits yet. Add money to your plan to see it here.</div>}
                  {deposits.map(d=>(
                    <div key={d.id} className="flex items-center justify-between py-3 border-b border-zinc-100 last:border-0">
                      <div><div className="text-[12px] font-medium">{formatUSD(d.amount_usd)} • {d.beahead_goals?.beahead_cars?.make} {d.beahead_goals?.beahead_cars?.model}</div><div className="text-[11px] text-zinc-500">{new Date(d.created_at).toLocaleDateString()} • {d.method} • {d.reference_code}</div></div>
                      <span className={`text-[10px] px-2 py-1 rounded-full ${d.verification_status==='verified'?'bg-zinc-900 text-white':'bg-zinc-100'}`}>{d.verification_status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white border border-zinc-200 rounded-[16px] p-5">
                <div className="font-medium text-[13px]">Add money</div>
                <div className="text-[11px] text-zinc-500 mt-1">EcoCash, InnBucks, bank transfer or cash</div>
                <form onSubmit={addDeposit} className="mt-4 space-y-3">
                  <select value={depositForm.goalId} onChange={e=>setDepositForm({...depositForm, goalId:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-full px-4 py-2.5 text-[12px] focus:outline-none focus:border-zinc-900" required><option value="">Select plan</option>{goals.filter(g=>g.status==='active').map(g=><option key={g.id} value={g.id}>{g.beahead_cars?.make} {g.beahead_cars?.model} • {formatUSD(g.goal_amount_usd)}</option>)}</select>
                  <input type="number" placeholder="Amount in USD" value={depositForm.amount} onChange={e=>setDepositForm({...depositForm, amount:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-full px-4 py-2.5 text-[12px] focus:outline-none focus:border-zinc-900" required/>
                  <select value={depositForm.method} onChange={e=>setDepositForm({...depositForm, method:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-full px-4 py-2.5 text-[12px] focus:outline-none focus:border-zinc-900"><option value="bank_transfer">Bank transfer</option><option value="cash_deposit">Cash at bank</option><option value="ecocash">EcoCash</option><option value="innbucks">InnBucks</option></select>
                  <input placeholder="Reference code" value={depositForm.reference} onChange={e=>setDepositForm({...depositForm, reference:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-full px-4 py-2.5 text-[12px] focus:outline-none focus:border-zinc-900" required/>
                  <button type="submit" className="w-full bg-zinc-900 text-white py-3 rounded-full text-[12px] font-medium">Submit deposit</button>
                </form>
              </div>

              <div className="bg-[#f4f4f0] rounded-[16px] p-5">
                <div className="font-medium text-[12px]">How we keep it real</div>
                <div className="text-[11px] leading-[1.5] text-zinc-600 mt-2 space-y-2">
                  <p>• No fake partnerships. We're building and looking for a licensed bank to hold escrow.</p>
                  <p>• No licensed badges until we are licensed.</p>
                  <p>• No offices we haven't talked to.</p>
                  <p>• Your money stays in your bank account, verifiable anytime.</p>
                  <p>• 7% fee only if you cancel early, to cover admin.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNewCar && (
        <div className="fixed inset-0 bg-zinc-900/20 backdrop-blur-[12px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] max-w-[440px] w-full shadow-[0_20px_60px_-20px_rgba(0,0,0,0.3)]">
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <div className="font-medium">Add a car to save for</div>
                <button onClick={()=>setShowNewCar(false)} className="w-7 h-7 bg-zinc-100 rounded-full flex items-center justify-center"><X size={14}/></button>
              </div>
              <form onSubmit={handleCreateCar} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Make (e.g. Toyota)" value={newCarForm.make} onChange={e=>setNewCarForm({...newCarForm, make:e.target.value})} className="bg-zinc-50 border border-zinc-200 rounded-full px-4 py-2.5 text-[12px] focus:outline-none focus:border-zinc-900" required/>
                  <input placeholder="Model (e.g. Aqua)" value={newCarForm.model} onChange={e=>setNewCarForm({...newCarForm, model:e.target.value})} className="bg-zinc-50 border border-zinc-200 rounded-full px-4 py-2.5 text-[12px] focus:outline-none focus:border-zinc-900" required/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Year (e.g. 2015)" type="number" value={newCarForm.year} onChange={e=>setNewCarForm({...newCarForm, year:e.target.value})} className="bg-zinc-50 border border-zinc-200 rounded-full px-4 py-2.5 text-[12px] focus:outline-none focus:border-zinc-900" required/>
                  <input placeholder="Price USD (e.g. 3250)" type="number" value={newCarForm.price} onChange={e=>setNewCarForm({...newCarForm, price:e.target.value})} className="bg-zinc-50 border border-zinc-200 rounded-full px-4 py-2.5 text-[12px] focus:outline-none focus:border-zinc-900" required/>
                </div>
                <input placeholder="BeForward link (optional)" value={newCarForm.url} onChange={e=>setNewCarForm({...newCarForm, url:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-full px-4 py-2.5 text-[12px] focus:outline-none focus:border-zinc-900"/>
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Mileage (optional)" type="number" value={newCarForm.mileage} onChange={e=>setNewCarForm({...newCarForm, mileage:e.target.value})} className="bg-zinc-50 border border-zinc-200 rounded-full px-4 py-2.5 text-[12px] focus:outline-none focus:border-zinc-900"/>
                  <input placeholder="Engine CC (e.g. 1500)" type="number" value={newCarForm.engine} onChange={e=>setNewCarForm({...newCarForm, engine:e.target.value})} className="bg-zinc-50 border border-zinc-200 rounded-full px-4 py-2.5 text-[12px] focus:outline-none focus:border-zinc-900"/>
                </div>
                <button type="submit" className="w-full bg-zinc-900 text-white py-3 rounded-full text-[12px] font-medium mt-2">Continue → Calculate total cost</button>
                <div className="text-[10px] text-zinc-500 text-center">We'll calculate shipping, duty estimate and total to get it to Zimbabwe.</div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showAgreement && selectedCar && (
        <div className="fixed inset-0 bg-zinc-900/20 backdrop-blur-[12px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] max-w-[420px] w-full shadow-[0_20px_60px_-20px_rgba(0,0,0,0.3)]">
            <div className="p-6">
              <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center mb-4"><Shield size={16} className="text-white"/></div>
              <h3 className="font-medium text-[15px]">Create savings plan for {selectedCar.make} {selectedCar.model}?</h3>
              {(() => { const calc = calculateLandedCost(selectedCar); return (
                <div className="mt-4 space-y-3">
                  <div className="bg-zinc-50 rounded-[14px] p-4 space-y-2">
                    {calc.breakdown.map((b,i)=><div key={i} className="flex justify-between text-[11px]"><span className="text-zinc-600">{b.label}</span><span className="font-medium">{formatUSD(b.value)}</span></div>)}
                    <div className="h-px bg-zinc-200 my-2"></div>
                    <div className="flex justify-between font-medium text-[13px]"><span>Total needed</span><span>{formatUSD(calc.total)}</span></div>
                    <div className="text-[10px] text-zinc-500">{formatUSD(calculateMonthly(calc.total))}/month for 12 months</div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={()=>setShowAgreement(false)} className="flex-1 bg-white border border-zinc-200 py-2.5 rounded-full text-[12px] font-medium">Cancel</button>
                    <button onClick={createGoal} className="flex-1 bg-zinc-900 text-white py-2.5 rounded-full text-[12px] font-medium flex items-center justify-center gap-1"><Check size={14}/> Create plan</button>
                  </div>
                </div>
              )})()}
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-zinc-200 mt-16">
        <div className="max-w-[1120px] mx-auto px-6 py-8 flex flex-col md:flex-row justify-between gap-4">
          <div className="flex items-center gap-2"><img src="/logo.png" className="w-6 h-6 rounded-[8px]"/><span className="font-medium text-[12px]">BeAhead</span><span className="text-[11px] text-zinc-500">• Built in Bulawayo • Pilot phase</span></div>
          <div className="text-[11px] text-zinc-500">No fake partnerships. No licensed claims until licensed. Real product, real escrow reference, real savings.</div>
        </div>
      </footer>
    </div>
  )
}
