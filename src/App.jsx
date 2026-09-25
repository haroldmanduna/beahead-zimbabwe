import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { calculateLandedCost, calculatePenalty, calculateMonthly, formatUSD } from './utils/calculations'
import { ArrowRight, Shield, Wallet, Car, Clock, Plus, LogOut, Upload, X, Check, Calculator, Map, FileCheck, Bell, Users, Zap, Target, TrendingDown } from 'lucide-react'

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [view, setView] = useState('landing')
  const [goals, setGoals] = useState([])
  const [deposits, setDeposits] = useState([])
  const [selectedCar, setSelectedCar] = useState(null)
  const [showNewCar, setShowNewCar] = useState(false)
  const [showAgreement, setShowAgreement] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)
  const [loading, setLoading] = useState(true)
  const [authForm, setAuthForm] = useState({ email: '', password: '', fullName: '', phone: '' })
  const [depositForm, setDepositForm] = useState({ goalId: '', amount: '', method: 'bank_transfer', reference: '' })
  const [newCarForm, setNewCarForm] = useState({ make: '', model: '', year: '', price: '', url: '', mileage: '', engine: '' })
  const [calcForm, setCalcForm] = useState({ price: '3250', engine: '1500', year: '2015' })

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
          const refNum = `BA-${Math.floor(100000+Math.random()*900000)}`
          await supabase.from('beahead_profiles').insert({
            id: data.user.id,
            email: authForm.email,
            full_name: authForm.fullName,
            phone: authForm.phone,
            role: 'user',
            bank_account_number: refNum,
          })
          setUser(data.user)
          setProfile({ full_name: authForm.fullName, bank_account_number: refNum })
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

  const handleGoogleAuth = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) alert('Enable Google in Supabase Dashboard > Auth > Providers')
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
      alert('Could not save car.')
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
      saved_amount_usd: 0,
      status: 'active',
      progress_percent: 0,
      escrow_account_number: profile?.bank_account_number || `BA-${Math.floor(100000+Math.random()*900000)}`,
      agreement_signed: true,
      agreement_signed_at: new Date().toISOString(),
      penalty_rate: 0.07,
      monthly_target: calculateMonthly(calc.total, 12),
    }

    const { data, error } = await supabase.from('beahead_goals').insert(goalData).select('*, beahead_cars(*)').single()
    if (error) {
      alert('Could not create plan.')
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

    const { data } = await supabase.from('beahead_deposits').insert(dep).select('*, beahead_goals(*, beahead_cars(*))').single()
    if (data) {
      setDeposits([data, ...deposits])
      setTimeout(async () => {
        await supabase.from('beahead_deposits').update({ verification_status: 'verified', verified_at: new Date().toISOString() }).eq('id', data.id)
        const { data: allDeps } = await supabase.from('beahead_deposits').select('amount_usd').eq('goal_id', dep.goal_id).eq('verification_status','verified')
        const totalSaved = allDeps?.reduce((s,d)=>s+Number(d.amount_usd),0) || 0
        await supabase.from('beahead_goals').update({ saved_amount_usd: totalSaved, progress_percent: (totalSaved/goal.goal_amount_usd)*100 }).eq('id', dep.goal_id)
        loadData(user.id)
      }, 1000)
    }
    setDepositForm({ goalId: '', amount: '', method: 'bank_transfer', reference: '' })
  }

  const handleCancel = async (goal) => {
    const penalty = calculatePenalty(goal.saved_amount_usd || 0)
    if (!confirm(`Cancel ${goal.beahead_cars?.make} ${goal.beahead_cars?.model}?\n\nSaved: ${formatUSD(goal.saved_amount_usd)}\nFee (7%): ${formatUSD(penalty.totalPenalty)}\nYou receive: ${formatUSD((goal.saved_amount_usd||0) - penalty.totalPenalty)}`)) return
    await supabase.from('beahead_goals').update({ status: 'cancelled' }).eq('id', goal.id)
    loadData(user.id)
  }

  const calcPreview = calculateLandedCost({ price_usd: parseFloat(calcForm.price)||0, freight_usd: 1150, duty_rate: 0.55, engine_cc: parseInt(calcForm.engine)||1500, year: parseInt(calcForm.year)||2015, beforward_ref: 'PREVIEW' })

  if (loading) return (
    <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#fafaf9] text-zinc-900 antialiased selection:bg-zinc-900 selection:text-white">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap');`}</style>
      
      <header className="sticky top-0 z-40 bg-[#fafaf9]/80 backdrop-blur-2xl border-b border-zinc-200/60">
        <div className="max-w-[1120px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="BeAhead" className="w-8 h-8 rounded-[10px] object-cover"/>
            <span className="font-semibold text-[15px] tracking-[-0.01em]">BeAhead</span>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:block text-right leading-tight mr-2">
                  <div className="text-[12px] font-medium">{profile?.full_name || 'Account'}</div>
                  <div className="text-[10px] text-zinc-500">{profile?.bank_account_number}</div>
                </div>
                <button onClick={handleLogout} className="w-8 h-8 bg-white border border-zinc-200 rounded-full flex items-center justify-center hover:bg-zinc-50"><LogOut size={13}/></button>
              </div>
            ) : (
              <button onClick={() => setView('auth')} className="bg-zinc-900 text-white px-5 py-2.5 rounded-full text-[13px] font-medium hover:bg-black transition">Get started</button>
            )}
          </div>
        </div>
      </header>

      {view === 'landing' && (
        <div>
          <section className="max-w-[1120px] mx-auto px-6 pt-14 md:pt-20 pb-10">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-start">
              <div>
                <h1 className="font-['Fraunces'] text-[40px] md:text-[60px] font-[700] leading-[0.9] tracking-[-0.04em]">
                  Save for your<br/>BeForward car,<br/><span className="text-zinc-400">month by month.</span>
                </h1>
                <p className="mt-5 text-[15px] leading-[1.6] text-zinc-600 max-w-[460px]">
                  Paste any car from BeForward.jp. We show the full cost to get it to Zimbabwe. Save small amounts monthly in your own account. Import when you're ready.
                </p>
                <div className="mt-7 flex gap-3">
                  <button onClick={() => setView('auth')} className="bg-zinc-900 text-white px-6 py-3 rounded-full text-[13px] font-medium flex items-center gap-2 hover:bg-black transition">
                    Start your plan <ArrowRight size={15}/>
                  </button>
                  <button onClick={() => setShowCalculator(true)} className="bg-white border border-zinc-200 px-5 py-3 rounded-full text-[13px] font-medium flex items-center gap-1.5 hover:border-zinc-300">
                    <Calculator size={14}/> Calculate cost
                  </button>
                </div>
                <div className="mt-8 flex flex-wrap gap-4 text-[11px] text-zinc-500">
                  <span className="flex items-center gap-1.5"><Shield size={12}/> Money stays in your bank</span>
                  <span className="flex items-center gap-1.5"><Wallet size={12}/> No lump sum needed</span>
                  <span className="flex items-center gap-1.5"><Clock size={12}/> Cancel anytime</span>
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-[24px] p-2 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.15)]">
                <div className="bg-zinc-900 rounded-[16px] p-5 text-white">
                  <div className="flex justify-between items-center mb-5">
                    <div className="flex items-center gap-2.5"><div className="w-7 h-7 bg-white/10 rounded-full flex items-center justify-center"><Wallet size={12}/></div><div><div className="text-[10px] text-zinc-400">Total saved</div><div className="text-[14px] font-semibold">$2,850 • 42%</div></div></div>
                    <div className="text-[10px] bg-white text-zinc-900 px-2 py-1 rounded-full font-bold">ACTIVE</div>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-white w-[42%] rounded-full"></div></div>
                  <div className="mt-3 flex justify-between text-[10px] text-zinc-400"><span>$2,850 saved</span><span>$6,687 goal</span></div>
                  <div className="mt-5 grid grid-cols-3 gap-3 text-[11px]">
                    <div className="bg-white/10 rounded-[10px] p-2.5"><div className="text-zinc-400 text-[9px]">Car</div><div className="font-medium mt-0.5">Aqua 2015</div></div>
                    <div className="bg-white/10 rounded-[10px] p-2.5"><div className="text-zinc-400 text-[9px]">Monthly</div><div className="font-medium mt-0.5">$557/mo</div></div>
                    <div className="bg-white/10 rounded-[10px] p-2.5"><div className="text-zinc-400 text-[9px]">Left</div><div className="font-medium mt-0.5">$3,837</div></div>
                  </div>
                </div>
                <div className="p-3.5 flex items-center gap-2 text-[11px] text-zinc-600"><div className="w-6 h-6 bg-zinc-100 rounded-full flex items-center justify-center"><Car size={12}/></div> Toyota Aqua 2015 • 85k km • Hybrid • Your plan</div>
              </div>
            </div>
          </section>

          <section className="max-w-[1120px] mx-auto px-6 pb-6">
            <div className="grid md:grid-cols-3 gap-3">
              {[
                { icon: Calculator, title: 'True cost calculator', desc: 'Car price + freight $1,150 + ZIMRA duty (50-55%) + clearing $350 + service fee. No surprises at Beitbridge.' },
                { icon: Target, title: 'Flexible monthly plans', desc: 'Choose 6, 12, 18 or 24 months. Save $50 or $500. Change anytime. Progress tracked automatically.' },
                { icon: Map, title: 'Import timeline tracker', desc: 'Japan → Durban → Beitbridge → Bulawayo. See exactly where your car is and what documents are needed next.' },
                { icon: FileCheck, title: 'Document checklist', desc: 'Proforma invoice, TT copy, ID, proof of address, ZIMRA forms. We guide you step by step so you don\'t get stuck.' },
                { icon: Bell, title: 'Price drop alerts', desc: 'Save a car, we watch its price on BeForward. If it drops, you get notified instantly to lock it.' },
                { icon: TrendingDown, title: 'Duty estimator', desc: 'Enter engine CC and year, get ZIMRA duty estimate based on real rates. Avoid $2,000 surprises.' },
                { icon: Users, title: 'Group buying', desc: 'Join others buying same model (Aqua, Fit). Share container, split freight, lower costs. Community savings.' },
                { icon: Zap, title: 'Top-up boost', desc: 'Saved 80% but car about to sell? Get a small top-up to secure it now, pay back next month. No bank trip.' },
                { icon: Shield, title: 'Escrow protection', desc: 'Money stays in your bank account until you authorize release. If car deal fails, you get refund. No middleman holding cash.' },
              ].map((f,i)=>(
                <div key={i} className="bg-white border border-zinc-200 rounded-[18px] p-5 hover:border-zinc-300 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.1)] transition">
                  <div className="w-8 h-8 bg-zinc-900 text-white rounded-full flex items-center justify-center mb-3"><f.icon size={14}/></div>
                  <div className="font-medium text-[13px]">{f.title}</div>
                  <div className="text-[12px] leading-[1.5] text-zinc-600 mt-1.5">{f.desc}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="max-w-[1120px] mx-auto px-6 py-10">
            <div className="bg-zinc-900 rounded-[24px] p-7 md:p-10 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[360px] h-[360px] bg-white/[0.04] rounded-full blur-[70px] -translate-y-1/2 translate-x-1/3"></div>
              <div className="relative grid md:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
                <div>
                  <div className="inline-flex bg-white/10 border border-white/10 rounded-full px-3 py-1 text-[10px] tracking-widest mb-4">HOW TOTAL COST WORKS</div>
                  <h3 className="font-['Fraunces'] text-[26px] leading-[0.95]">No hidden fees.<br/>Everything upfront.</h3>
                  <p className="text-[13px] leading-[1.6] text-zinc-400 mt-3 max-w-[360px]">We show car price, freight, duty, clearing and our small service fee before you save a dollar. You know exactly what you'll pay to get it to Zimbabwe.</p>
                </div>
                <div className="bg-white rounded-[18px] p-5 text-zinc-900">
                  <div className="text-[10px] tracking-widest text-zinc-500 font-medium">EXAMPLE • TOYOTA AQUA 2015</div>
                  <div className="mt-3 space-y-2 text-[12px]">
                    <div className="flex justify-between"><span className="text-zinc-500">Car price (BeForward)</span><span className="font-medium">$3,250</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Freight Japan → Durban</span><span className="font-medium">$1,150</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">ZIMRA duty (55% est.)</span><span className="font-medium">$1,787</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Clearing & delivery</span><span className="font-medium">$350</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">BeAhead service fee</span><span className="font-medium">$150</span></div>
                    <div className="h-px bg-zinc-100 my-2"></div>
                    <div className="flex justify-between font-semibold"><span>Total to own</span><span>$6,687</span></div>
                    <div className="text-[11px] text-zinc-500">12 months × $557/mo • Cancel anytime, 7% fee only if you cancel early</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {view === 'auth' && (
        <div className="max-w-[400px] mx-auto px-6 py-14">
          <div className="text-center mb-7">
            <img src="/logo.png" className="w-11 h-11 rounded-[12px] mx-auto mb-3"/>
            <h2 className="font-['Fraunces'] text-[24px] font-[600] tracking-[-0.02em]">Create your account</h2>
            <p className="text-[12px] text-zinc-600 mt-1.5">Start saving for your BeForward car. No fees to sign up.</p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-[20px] p-5">
            <button onClick={handleGoogleAuth} className="w-full bg-white border border-zinc-200 hover:border-zinc-300 py-3 rounded-full text-[12px] font-medium flex items-center justify-center gap-2 transition">
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>
            <div className="flex items-center gap-3 my-4"><div className="h-px bg-zinc-200 flex-1"></div><span className="text-[10px] text-zinc-400">OR</span><div className="h-px bg-zinc-200 flex-1"></div></div>
            <div className="space-y-2.5">
              <input placeholder="Full name" value={authForm.fullName} onChange={e=>setAuthForm({...authForm, fullName:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-full px-4 py-3 text-[12px] focus:bg-white focus:border-zinc-900 focus:outline-none"/>
              <input placeholder="Phone number" value={authForm.phone} onChange={e=>setAuthForm({...authForm, phone:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-full px-4 py-3 text-[12px] focus:bg-white focus:border-zinc-900 focus:outline-none"/>
              <input placeholder="Email" value={authForm.email} onChange={e=>setAuthForm({...authForm, email:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-full px-4 py-3 text-[12px] focus:bg-white focus:border-zinc-900 focus:outline-none"/>
              <input placeholder="Password" type="password" value={authForm.password} onChange={e=>setAuthForm({...authForm, password:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-full px-4 py-3 text-[12px] focus:bg-white focus:border-zinc-900 focus:outline-none"/>
              <button onClick={()=>handleAuth('signup')} className="w-full bg-zinc-900 text-white py-3 rounded-full text-[12px] font-medium mt-1">Create account with email</button>
              <button onClick={()=>handleAuth('login')} className="w-full text-[12px] py-2">Already have an account? Sign in</button>
            </div>
          </div>
        </div>
      )}

      {view === 'dashboard' && (
        <div className="max-w-[1120px] mx-auto px-6 py-7">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-['Fraunces'] text-[22px] font-[600] tracking-[-0.02em]">Your savings</h2>
              <p className="text-[11px] text-zinc-500 mt-1">{profile?.bank_account_number} • Your savings reference</p>
            </div>
            <button onClick={()=>setShowNewCar(true)} className="bg-zinc-900 text-white px-4 py-2.5 rounded-full text-[11px] font-medium flex items-center gap-1.5"><Plus size={13}/> Add car</button>
          </div>

          <div className="grid md:grid-cols-3 gap-3 mb-6">
            <div className="bg-white border border-zinc-200 rounded-[14px] p-4"><div className="text-[10px] text-zinc-500">Total saved</div><div className="text-[20px] font-semibold tracking-tight mt-1">{formatUSD(goals.reduce((s,g)=>s+(g.saved_amount_usd||0),0))}</div></div>
            <div className="bg-white border border-zinc-200 rounded-[14px] p-4"><div className="text-[10px] text-zinc-500">Active plans</div><div className="text-[20px] font-semibold tracking-tight mt-1">{goals.filter(g=>g.status==='active').length}</div></div>
            <div className="bg-zinc-900 text-white rounded-[14px] p-4"><div className="text-[10px] text-zinc-400">Next</div><div className="text-[12px] font-medium mt-1">{goals[0] ? `${Math.round(goals[0].progress_percent||0)}% to ${goals[0].beahead_cars?.make}` : 'Add a car to start'}</div></div>
          </div>

          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-5">
            <div>
              <div className="flex items-center justify-between mb-3"><h3 className="font-medium text-[13px]">Your plans</h3><span className="text-[11px] text-zinc-500">{goals.length} plans</span></div>
              {goals.length===0 ? (
                <div className="bg-white border border-dashed border-zinc-300 rounded-[18px] p-8 text-center">
                  <div className="w-11 h-11 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-3"><Car size={18} className="text-zinc-500"/></div>
                  <div className="font-medium text-[13px]">No plans yet</div>
                  <div className="text-[11px] text-zinc-500 mt-1 max-w-[280px] mx-auto">Paste a BeForward link to create your first savings plan. We calculate full cost to Zimbabwe.</div>
                  <button onClick={()=>setShowNewCar(true)} className="mt-4 bg-zinc-900 text-white px-4 py-2 rounded-full text-[11px] font-medium">Add your first car</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {goals.map(goal => (
                    <div key={goal.id} className="bg-white border border-zinc-200 rounded-[14px] p-4">
                      <div className="flex justify-between"><div><div className="font-medium text-[12px]">{goal.beahead_cars?.make} {goal.beahead_cars?.model} {goal.beahead_cars?.year}</div><div className="text-[10px] text-zinc-500">{formatUSD(goal.goal_amount_usd)} total • {goal.escrow_account_number}</div></div><span className="text-[10px] px-2 py-1 rounded-full bg-zinc-900 text-white">{goal.status}</span></div>
                      <div className="mt-3"><div className="flex justify-between text-[10px] mb-1"><span className="text-zinc-500">{formatUSD(goal.saved_amount_usd||0)} saved</span><span className="font-medium">{Math.round(goal.progress_percent||0)}%</span></div><div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden"><div className="h-full bg-zinc-900 rounded-full" style={{width:`${Math.min(100, goal.progress_percent||0)}%`}}></div></div></div>
                      <div className="mt-3 flex gap-2"><button onClick={()=>setDepositForm({...depositForm, goalId: goal.id})} className="flex-1 bg-zinc-900 text-white text-[11px] py-2 rounded-full">Add money</button><button onClick={()=>handleCancel(goal)} className="flex-1 border border-zinc-200 text-[11px] py-2 rounded-full">Cancel</button></div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-white border border-zinc-200 rounded-[16px] p-4">
                <div className="font-medium text-[12px]">Add money</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">EcoCash, InnBucks, bank transfer or cash</div>
                <form onSubmit={addDeposit} className="mt-3 space-y-2.5">
                  <select value={depositForm.goalId} onChange={e=>setDepositForm({...depositForm, goalId:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2.5 text-[11px] focus:outline-none focus:border-zinc-900" required><option value="">Select plan</option>{goals.filter(g=>g.status==='active').map(g=><option key={g.id} value={g.id}>{g.beahead_cars?.make} {g.beahead_cars?.model}</option>)}</select>
                  <input type="number" placeholder="Amount USD" value={depositForm.amount} onChange={e=>setDepositForm({...depositForm, amount:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2.5 text-[11px] focus:outline-none focus:border-zinc-900" required/>
                  <select value={depositForm.method} onChange={e=>setDepositForm({...depositForm, method:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2.5 text-[11px] focus:outline-none focus:border-zinc-900"><option value="bank_transfer">Bank transfer</option><option value="cash_deposit">Cash at bank</option><option value="ecocash">EcoCash</option><option value="innbucks">InnBucks</option></select>
                  <input placeholder="Reference code" value={depositForm.reference} onChange={e=>setDepositForm({...depositForm, reference:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2.5 text-[11px] focus:outline-none focus:border-zinc-900" required/>
                  <button type="submit" className="w-full bg-zinc-900 text-white py-2.5 rounded-full text-[11px] font-medium">Submit deposit</button>
                </form>
              </div>

              <div className="bg-white border border-zinc-200 rounded-[16px] p-4">
                <div className="font-medium text-[12px] flex items-center gap-1.5"><Bell size={12}/> Attractive features coming</div>
                <div className="mt-2 space-y-2 text-[11px] text-zinc-600">
                  <div className="flex gap-2"><span className="text-zinc-900">•</span> Price drop alerts for saved cars</div>
                  <div className="flex gap-2"><span className="text-zinc-900">•</span> Duty calculator by engine CC & year</div>
                  <div className="flex gap-2"><span className="text-zinc-900">•</span> Import timeline: Japan → Durban → Zim</div>
                  <div className="flex gap-2"><span className="text-zinc-900">•</span> Document checklist so you don't get stuck</div>
                  <div className="flex gap-2"><span className="text-zinc-900">•</span> Group buying to share freight costs</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNewCar && (
        <div className="fixed inset-0 bg-zinc-900/20 backdrop-blur-[10px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[18px] max-w-[400px] w-full shadow-[0_20px_60px_-20px_rgba(0,0,0,0.3)]">
            <div className="p-5">
              <div className="flex justify-between items-center mb-4"><div className="font-medium text-[13px]">Add a car to save for</div><button onClick={()=>setShowNewCar(false)} className="w-6 h-6 bg-zinc-100 rounded-full flex items-center justify-center"><X size={12}/></button></div>
              <form onSubmit={handleCreateCar} className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <input placeholder="Make (Toyota)" value={newCarForm.make} onChange={e=>setNewCarForm({...newCarForm, make:e.target.value})} className="bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2.5 text-[11px] focus:outline-none focus:border-zinc-900" required/>
                  <input placeholder="Model (Aqua)" value={newCarForm.model} onChange={e=>setNewCarForm({...newCarForm, model:e.target.value})} className="bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2.5 text-[11px] focus:outline-none focus:border-zinc-900" required/>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <input placeholder="Year" type="number" value={newCarForm.year} onChange={e=>setNewCarForm({...newCarForm, year:e.target.value})} className="bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2.5 text-[11px] focus:outline-none focus:border-zinc-900" required/>
                  <input placeholder="Price USD" type="number" value={newCarForm.price} onChange={e=>setNewCarForm({...newCarForm, price:e.target.value})} className="bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2.5 text-[11px] focus:outline-none focus:border-zinc-900" required/>
                </div>
                <input placeholder="BeForward link (paste here)" value={newCarForm.url} onChange={e=>setNewCarForm({...newCarForm, url:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2.5 text-[11px] focus:outline-none focus:border-zinc-900"/>
                <div className="grid grid-cols-2 gap-2.5">
                  <input placeholder="Mileage (optional)" type="number" value={newCarForm.mileage} onChange={e=>setNewCarForm({...newCarForm, mileage:e.target.value})} className="bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2.5 text-[11px] focus:outline-none focus:border-zinc-900"/>
                  <input placeholder="Engine CC (e.g. 1500)" type="number" value={newCarForm.engine} onChange={e=>setNewCarForm({...newCarForm, engine:e.target.value})} className="bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2.5 text-[11px] focus:outline-none focus:border-zinc-900"/>
                </div>
                <button type="submit" className="w-full bg-zinc-900 text-white py-3 rounded-full text-[11px] font-medium mt-2">Calculate total cost →</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showAgreement && selectedCar && (
        <div className="fixed inset-0 bg-zinc-900/20 backdrop-blur-[10px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[18px] max-w-[400px] w-full shadow-[0_20px_60px_-20px_rgba(0,0,0,0.3)]">
            <div className="p-5">
              <h3 className="font-medium text-[14px]">Create savings plan for {selectedCar.make} {selectedCar.model}?</h3>
              {(() => { const calc = calculateLandedCost(selectedCar); return (
                <div className="mt-4 space-y-3">
                  <div className="bg-zinc-50 rounded-[12px] p-3 space-y-1.5">
                    {calc.breakdown.map((b,i)=><div key={i} className="flex justify-between text-[11px]"><span className="text-zinc-600">{b.label}</span><span className="font-medium">{formatUSD(b.value)}</span></div>)}
                    <div className="h-px bg-zinc-200 my-1.5"></div>
                    <div className="flex justify-between font-medium text-[12px]"><span>Total needed</span><span>{formatUSD(calc.total)}</span></div>
                    <div className="text-[10px] text-zinc-500">{formatUSD(calculateMonthly(calc.total))}/month for 12 months • Cancel anytime</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={()=>setShowAgreement(false)} className="flex-1 border border-zinc-200 py-2.5 rounded-full text-[11px] font-medium">Cancel</button>
                    <button onClick={createGoal} className="flex-1 bg-zinc-900 text-white py-2.5 rounded-full text-[11px] font-medium">Create plan</button>
                  </div>
                </div>
              )})()}
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-zinc-200 mt-12">
        <div className="max-w-[1120px] mx-auto px-6 py-6 flex justify-between items-center">
          <div className="flex items-center gap-2"><img src="/logo.png" className="w-5 h-5 rounded-[6px]"/><span className="font-medium text-[11px]">BeAhead</span><span className="text-[10px] text-zinc-500">• Bulawayo • Pilot</span></div>
          <div className="text-[10px] text-zinc-500">No fake partnerships. Real product. Real savings reference.</div>
        </div>
      </footer>
    </div>
  )
}
