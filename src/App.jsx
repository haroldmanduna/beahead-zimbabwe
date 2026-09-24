import { useState, useEffect } from 'react'
import { supabase, checkTables } from './lib/supabase'
import { calculateLandedCost, calculatePenalty, calculateMonthly, formatUSD } from './utils/calculations'
import { Car, Shield, Wallet, MapPin, CheckCircle, TrendingUp, Users, DollarSign, FileText, Upload, LogOut, Building2, Clock, Phone, Star, ArrowRight, Lock, Award, Zap } from 'lucide-react'

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [view, setView] = useState('landing')
  const [cars, setCars] = useState([])
  const [goals, setGoals] = useState([])
  const [deposits, setDeposits] = useState([])
  const [selectedCar, setSelectedCar] = useState(null)
  const [showAgreement, setShowAgreement] = useState(false)
  const [loading, setLoading] = useState(true)
  const [authForm, setAuthForm] = useState({ email: '', password: '', fullName: '', phone: '' })
  const [depositForm, setDepositForm] = useState({ goalId: '', amount: '', method: 'bank_transfer', reference: '' })

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
    const { data: carsData } = await supabase.from('beahead_cars').select('*').eq('status','available').order('price_usd', {ascending: true})
    if (carsData) setCars(carsData)
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
          const escrowNum = `ESC-${Math.floor(100000+Math.random()*900000)}`
          await supabase.from('beahead_profiles').insert({
            id: data.user.id,
            email: authForm.email,
            full_name: authForm.fullName,
            phone: authForm.phone,
            role: 'user',
            bank_account_number: escrowNum,
            bank_name: 'EmpowerBank'
          })
          setUser(data.user)
          setProfile({ full_name: authForm.fullName, bank_account_number: escrowNum, bank_name: 'EmpowerBank' })
          await loadData(data.user.id)
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
      escrow_account_number: profile?.bank_account_number || `ESC-${Math.floor(100000+Math.random()*900000)}`,
      escrow_bank_name: 'EmpowerBank - Escrow Division',
      agreement_signed: true,
      agreement_signed_at: new Date().toISOString(),
      penalty_rate: 0.07,
      monthly_target: calculateMonthly(calc.total, 12),
      bdc_office: 'Thuthuka Mall, Shop F4, Bulawayo',
    }

    const { data, error } = await supabase.from('beahead_goals').insert(goalData).select('*, beahead_cars(*)').single()
    if (error) {
      alert('Unable to create savings plan. Please try again.')
      return
    }
    if (data) {
      setGoals([data, ...goals])
      await supabase.from('beahead_commissions').insert({
        goal_id: data.id,
        user_id: user.id,
        type: 'referral',
        amount_usd: 5,
        recipient: 'BeAhead',
        notes: 'New escrow account'
      })
    }
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
      alert('Deposit failed. Please check your reference code.')
      return
    }
    if (data) {
      setDeposits([data, ...deposits])
      setTimeout(async () => {
        await supabase.from('beahead_deposits').update({ verification_status: 'verified', verified_at: new Date().toISOString() }).eq('id', data.id)
        const { data: allDeps } = await supabase.from('beahead_deposits').select('amount_usd').eq('goal_id', dep.goal_id).eq('verification_status','verified')
        const totalSaved = allDeps?.reduce((s,d)=>s+Number(d.amount_usd),0) || 0
        await supabase.from('beahead_goals').update({ saved_amount_usd: totalSaved, progress_percent: (totalSaved/goal.goal_amount_usd)*100 }).eq('id', dep.goal_id)
        loadData(user.id)
      }, 1200)
    }
    setDepositForm({ goalId: '', amount: '', method: 'bank_transfer', reference: '' })
  }

  const handleCancel = async (goal) => {
    const penalty = calculatePenalty(goal.saved_amount_usd || 0)
    if (!confirm(`Cancel your savings plan for ${goal.beahead_cars?.make} ${goal.beahead_cars?.model}?\n\nYou've saved ${formatUSD(goal.saved_amount_usd)}.\nEarly cancellation fee: ${formatUSD(penalty.totalPenalty)} (7%)\nYou'll receive: ${formatUSD((goal.saved_amount_usd||0) - penalty.totalPenalty)}\n\nThis fee covers bank administration and reservation costs.`)) return
    
    await supabase.from('beahead_goals').update({ status: 'cancelled', cancellation_reason: 'User requested' }).eq('id', goal.id)
    await supabase.from('beahead_commissions').insert([
      { goal_id: goal.id, user_id: user.id, type: 'penalty_bank', amount_usd: penalty.bank, recipient: 'Bank' },
      { goal_id: goal.id, user_id: user.id, type: 'penalty_beahead', amount_usd: penalty.beahead, recipient: 'BeAhead' },
      { goal_id: goal.id, user_id: user.id, type: 'penalty_beforward', amount_usd: penalty.beforward, recipient: 'BDC Zimbabwe' },
    ])
    loadData(user.id)
  }

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <div className="mt-4 text-sm font-medium text-zinc-600">Loading BeAhead...</div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-zinc-900 antialiased">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-zinc-100">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-900 text-white rounded-[10px] flex items-center justify-center font-bold text-[14px]">B</div>
            <div className="font-semibold text-[15px] tracking-tight">BeAhead</div>
            <div className="hidden md:flex items-center gap-2 ml-6 pl-6 border-l border-zinc-200">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500"><Shield size={12}/> Licensed Escrow Partner</div>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500"><MapPin size={12}/> Bulawayo</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <div className="text-[13px] font-medium leading-none">{profile?.full_name || 'Account'}</div>
                  <div className="text-[11px] text-zinc-500">{profile?.bank_account_number}</div>
                </div>
                <button onClick={handleLogout} className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center"><LogOut size={14}/></button>
              </div>
            ) : (
              <>
                <button onClick={() => setView('landing')} className="hidden md:block text-[13px] font-medium px-4 py-2">How it works</button>
                <button onClick={() => setView('auth')} className="bg-zinc-900 text-white px-5 py-2.5 rounded-full text-[13px] font-medium hover:bg-black transition">Start saving</button>
              </>
            )}
          </div>
        </div>
      </header>

      {view === 'landing' && (
        <div>
          <section className="max-w-[1200px] mx-auto px-6 lg:px-8 pt-16 pb-12 md:pt-24 md:pb-20">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-zinc-900 text-white rounded-full pl-1 pr-3 py-1 text-[11px] font-medium mb-6">
                  <span className="bg-white text-zinc-900 rounded-full px-2.5 py-0.5 text-[10px] font-bold">NEW</span>
                  Now partnering with BDC Zimbabwe — Thuthuka Mall, Bulawayo
                </div>
                <h1 className="text-[42px] md:text-[56px] font-[750] leading-[0.95] tracking-[-0.03em]">Own a car<br/>without paying<br/><span className="text-zinc-400">all at once.</span></h1>
                <p className="mt-6 text-[16px] leading-[1.6] text-zinc-600 max-w-[480px]">Pick your exact car from Japan. Save monthly in your own USD escrow account. We handle shipping, ZIMRA duty and delivery to Bulawayo. No lump sum needed.</p>
                
                <div className="mt-8 flex items-center gap-4">
                  <button onClick={() => setView('auth')} className="bg-zinc-900 text-white px-7 py-3.5 rounded-full text-[14px] font-medium flex items-center gap-2 hover:bg-black transition">Choose your car <ArrowRight size={16}/></button>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      <img src="https://i.pravatar.cc/100?img=11" className="w-7 h-7 rounded-full border-2 border-white"/>
                      <img src="https://i.pravatar.cc/100?img=32" className="w-7 h-7 rounded-full border-2 border-white"/>
                      <img src="https://i.pravatar.cc/100?img=8" className="w-7 h-7 rounded-full border-2 border-white"/>
                    </div>
                    <div className="text-[12px] leading-tight"><div className="font-medium">Trusted by 200+ savers</div><div className="text-zinc-500 flex items-center gap-1"><Star size={10} className="fill-amber-400 text-amber-400"/> 4.9/5 rating</div></div>
                  </div>
                </div>

                <div className="mt-10 grid grid-cols-3 gap-6 border-t border-zinc-100 pt-8 max-w-[420px]">
                  <div><div className="text-[20px] font-semibold tracking-tight">600+</div><div className="text-[11px] text-zinc-500 leading-tight mt-1">Cars imported monthly via BeForward to Zim</div></div>
                  <div><div className="text-[20px] font-semibold tracking-tight">3%</div><div className="text-[11px] text-zinc-500 leading-tight mt-1">Flat service fee, no hidden costs</div></div>
                  <div><div className="text-[20px] font-semibold tracking-tight">100%</div><div className="text-[11px] text-zinc-500 leading-tight mt-1">Money held in your bank, not us</div></div>
                </div>
              </div>

              <div className="relative">
                <div className="bg-white rounded-[28px] border border-zinc-200 p-2.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.15)]">
                  <div className="bg-zinc-900 rounded-[20px] p-6 text-white">
                    <div className="flex justify-between items-center mb-7">
                      <div className="flex items-center gap-2"><div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center"><Wallet size={14}/></div><div><div className="text-[11px] text-zinc-400">Escrow balance</div><div className="text-[15px] font-semibold">$4,550.00</div></div></div>
                      <div className="bg-white text-zinc-900 text-[10px] font-bold px-2.5 py-1 rounded-full">VERIFIED</div>
                    </div>
                    <div className="space-y-2.5 text-[13px]">
                      <div className="flex justify-between"><span className="text-zinc-400">Toyota Aqua 2015</span><span>$3,250</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Shipping & Duty</span><span>$3,347</span></div>
                      <div className="border-t border-white/10 my-3"></div>
                      <div className="flex justify-between font-medium"><span>Total needed</span><span className="text-[18px]">$6,697</span></div>
                    </div>
                    <div className="mt-7">
                      <div className="flex justify-between text-[11px] mb-2.5"><span className="text-zinc-400">Saving progress</span><span>68% • $4,550 saved</span></div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-white w-[68%] rounded-full"></div></div>
                      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-400"><Clock size={11}/> Next: $200 on 30 Sep • Auto-verified by bank</div>
                    </div>
                  </div>
                  <div className="px-4 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5"><img src="https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=100" className="w-9 h-9 rounded-full object-cover"/><div className="leading-tight"><div className="text-[12px] font-medium">Toyota Aqua • 2015 • Hybrid</div><div className="text-[11px] text-zinc-500">85,000 km • Reserved in Bulawayo</div></div></div>
                    <div className="w-6 h-6 bg-zinc-900 rounded-full flex items-center justify-center"><CheckCircle size={12} className="text-white"/></div>
                  </div>
                </div>
                <div className="absolute -bottom-6 -right-6 bg-white border border-zinc-200 rounded-2xl px-4 py-3 shadow-lg hidden md:flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center"><Lock size={14} className="text-green-600"/></div>
                  <div className="leading-tight"><div className="text-[11px] font-semibold">Bank-grade escrow</div><div className="text-[10px] text-zinc-500">Funds locked & protected</div></div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border-y border-zinc-100">
            <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-14">
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-[22px] font-semibold tracking-tight">How it works</h2>
                <div className="hidden md:flex items-center gap-2 text-[12px] text-zinc-500"><Award size={14}/> Licensed partner: BDC Zimbabwe • EmpowerBank Escrow</div>
              </div>
              <div className="grid md:grid-cols-4 gap-5">
                {[
                  { step: '01', title: 'Choose your exact car', desc: 'Browse Toyota Aqua, Honda Fit, Belta and more. See full landed cost upfront — car, shipping, ZIMRA duty, delivery. No surprises.', icon: Car },
                  { step: '02', title: 'Save in your own account', desc: 'Money goes to your USD escrow account at EmpowerBank. Not to us. You get an account number and can verify via bank.', icon: Shield },
                  { step: '03', title: 'We verify & track', desc: 'Deposit via EcoCash, InnBucks or bank transfer. Upload proof. Bank verifies within hours. Track progress in real time.', icon: Zap },
                  { step: '04', title: 'We deliver to Bulawayo', desc: 'At 80% we reserve your car. At 100% bank pays BeForward directly. BDC handles clearance at Beitbridge to your door.', icon: CheckCircle },
                ].map((s) => (
                  <div key={s.step} className="group relative bg-[#fcfcfc] border border-zinc-100 rounded-[20px] p-6 hover:bg-white hover:border-zinc-200 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)] transition-all">
                    <div className="flex items-start justify-between mb-5">
                      <div className="w-9 h-9 bg-zinc-900 text-white rounded-full flex items-center justify-center text-[12px] font-medium">{s.step}</div>
                      <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center group-hover:bg-zinc-900 group-hover:text-white transition"><s.icon size={14}/></div>
                    </div>
                    <div className="font-medium text-[14px]">{s.title}</div>
                    <div className="text-[12.5px] leading-[1.6] text-zinc-600 mt-2">{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="max-w-[1200px] mx-auto px-6 lg:px-8 py-14">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-zinc-900 text-white rounded-[24px] p-7">
                <div className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center mb-4"><Building2 size={16}/></div>
                <div className="font-medium">Why banks partner with us</div>
                <div className="text-[12.5px] leading-[1.6] text-zinc-400 mt-2">We bring verified savers who lock USD for 12 months. Low acquisition cost, float interest, and right to offer top-up loans for duty. No extra work.</div>
              </div>
              <div className="bg-white border border-zinc-200 rounded-[24px] p-7">
                <div className="w-9 h-9 bg-zinc-100 rounded-full flex items-center justify-center mb-4"><MapPin size={16}/></div>
                <div className="font-medium">Why BDC Bulawayo works with us</div>
                <div className="text-[12.5px] leading-[1.6] text-zinc-600 mt-2">We bring a new segment — people who can't pay cash today. They keep their clearing fee and handle delivery from Beitbridge. We bring ready buyers.</div>
              </div>
              <div className="bg-white border border-zinc-200 rounded-[24px] p-7">
                <div className="w-9 h-9 bg-zinc-100 rounded-full flex items-center justify-center mb-4"><Shield size={16}/></div>
                <div className="font-medium">Why customers trust us</div>
                <div className="text-[12.5px] leading-[1.6] text-zinc-600 mt-2">Money stays in your bank account, verifiable anytime. QR certificate, live car link, no hidden fees, and free switch if your car sells while you save.</div>
              </div>
            </div>
          </section>
        </div>
      )}

      {view === 'auth' && (
        <div className="max-w-[440px] mx-auto px-6 py-16">
          <div className="bg-white border border-zinc-200 rounded-[24px] p-8 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.15)]">
            <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center mb-5"><Lock size={16} className="text-white"/></div>
            <h2 className="text-[22px] font-semibold tracking-tight">Create your escrow account</h2>
            <p className="text-[13px] leading-[1.5] text-zinc-600 mt-2">Your savings go to your own USD account at EmpowerBank. We never hold your money.</p>
            <div className="mt-7 space-y-3.5">
              <input placeholder="Full name as on ID" value={authForm.fullName} onChange={e=>setAuthForm({...authForm, fullName:e.target.value})} className="w-full bg-[#f9f9f9] border border-zinc-200 focus:bg-white focus:border-zinc-900 focus:outline-none rounded-full px-4 py-3 text-[13px] transition"/>
              <input placeholder="Phone number (EcoCash)" value={authForm.phone} onChange={e=>setAuthForm({...authForm, phone:e.target.value})} className="w-full bg-[#f9f9f9] border border-zinc-200 focus:bg-white focus:border-zinc-900 focus:outline-none rounded-full px-4 py-3 text-[13px] transition"/>
              <input placeholder="Email address" value={authForm.email} onChange={e=>setAuthForm({...authForm, email:e.target.value})} className="w-full bg-[#f9f9f9] border border-zinc-200 focus:bg-white focus:border-zinc-900 focus:outline-none rounded-full px-4 py-3 text-[13px] transition"/>
              <input placeholder="Create password" type="password" value={authForm.password} onChange={e=>setAuthForm({...authForm, password:e.target.value})} className="w-full bg-[#f9f9f9] border border-zinc-200 focus:bg-white focus:border-zinc-900 focus:outline-none rounded-full px-4 py-3 text-[13px] transition"/>
              <button onClick={()=>handleAuth('signup')} className="w-full bg-zinc-900 text-white py-3.5 rounded-full text-[13px] font-medium hover:bg-black transition mt-2">Create account</button>
              <button onClick={()=>handleAuth('login')} className="w-full bg-white border border-zinc-200 py-3.5 rounded-full text-[13px] font-medium hover:bg-zinc-50 transition">Already have an account? Sign in</button>
              <div className="text-[10.5px] leading-[1.5] text-zinc-500 text-center pt-2">By creating an account you agree to our escrow terms. 7% fee applies only if you cancel early.</div>
            </div>
          </div>
        </div>
      )}

      {view === 'dashboard' && (
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-8">
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-full pl-3 pr-4 py-2">
              <div className="w-6 h-6 bg-zinc-900 rounded-full flex items-center justify-center text-white text-[10px] font-bold">{profile?.full_name?.[0] || 'U'}</div>
              <div className="leading-tight"><div className="text-[12px] font-medium">{profile?.full_name || 'Your account'}</div><div className="text-[10px] text-zinc-500">{profile?.bank_account_number} • EmpowerBank Escrow</div></div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-600"><Phone size={12}/> BDC Bulawayo: Thuthuka Mall, Shop F4</div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white border border-zinc-200 rounded-[18px] p-5"><div className="text-[11px] text-zinc-500 font-medium">Total saved</div><div className="text-[22px] font-semibold tracking-tight mt-1">{formatUSD(goals.reduce((s,g)=>s+(g.saved_amount_usd||0),0))}</div><div className="text-[11px] text-zinc-500 mt-1">Across {goals.length} plans</div></div>
            <div className="bg-white border border-zinc-200 rounded-[18px] p-5"><div className="text-[11px] text-zinc-500 font-medium">Active plans</div><div className="text-[22px] font-semibold tracking-tight mt-1">{goals.filter(g=>g.status==='active').length}</div><div className="text-[11px] text-green-600 mt-1">● All in good standing</div></div>
            <div className="bg-zinc-900 text-white rounded-[18px] p-5"><div className="text-[11px] text-zinc-400 font-medium">Next milestone</div><div className="text-[14px] font-medium mt-1">{goals[0] ? `${Math.round(goals[0].progress_percent||0)}% to ${goals[0].beahead_cars?.make} ${goals[0].beahead_cars?.model}` : 'No active plan'}</div><div className="text-[11px] text-zinc-400 mt-1">{goals[0] ? `${formatUSD((goals[0].goal_amount_usd||0) - (goals[0].saved_amount_usd||0))} remaining` : 'Choose a car to start'}</div></div>
            <div className="bg-white border border-zinc-200 rounded-[18px] p-5"><div className="text-[11px] text-zinc-500 font-medium">Escrow protection</div><div className="text-[13px] font-medium mt-1 flex items-center gap-1.5"><Shield size={12}/> Funds secured by bank</div><div className="text-[11px] text-zinc-500 mt-1">Verified & locked</div></div>
          </div>

          <div className="grid lg:grid-cols-[1.6fr_0.9fr] gap-8">
            <div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-[15px] tracking-tight">Available cars from Japan</h3>
                <div className="text-[11px] text-zinc-500">{cars.length} cars • Updated today • Full landed cost included</div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {cars.map(car => {
                  const calc = calculateLandedCost(car)
                  return (
                    <div key={car.id} className="group bg-white border border-zinc-200 rounded-[20px] overflow-hidden hover:border-zinc-300 hover:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.15)] transition-all">
                      <div className="relative"><img src={car.image_url} alt={car.make} className="w-full h-[160px] object-cover"/><div className="absolute top-3 left-3 bg-white/90 backdrop-blur rounded-full px-2.5 py-1 text-[10px] font-medium">{car.year} • {car.mileage?.toLocaleString()} km</div><div className="absolute top-3 right-3 bg-zinc-900 text-white rounded-full px-2.5 py-1 text-[10px] font-medium">{car.fuel_type}</div></div>
                      <div className="p-5">
                        <div className="flex justify-between items-start"><div><div className="font-semibold text-[14px]">{car.make} {car.model}</div><div className="text-[11px] text-zinc-500 mt-0.5">{car.engine_cc}cc • {car.transmission} • {car.beforward_ref}</div></div><div className="text-right"><div className="font-semibold text-[14px]">{formatUSD(car.price_usd)}</div><div className="text-[10px] text-zinc-500">Car price</div></div></div>
                        <div className="mt-4 bg-[#f9f9f9] rounded-[12px] p-3 flex justify-between items-center"><div><div className="text-[11px] text-zinc-500">Total to own (landed)</div><div className="font-semibold text-[13px]">{formatUSD(calc.total)}</div></div><div className="text-right"><div className="text-[11px] text-zinc-500">Per month</div><div className="text-[12px] font-medium">{formatUSD(calculateMonthly(calc.total))}/mo</div></div></div>
                        <button onClick={()=>{setSelectedCar(car); setShowAgreement(true)}} className="mt-4 w-full bg-zinc-900 text-white py-2.5 rounded-full text-[12.5px] font-medium group-hover:bg-black transition flex items-center justify-center gap-1.5">Start saving for this car <ArrowRight size={14}/></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-5">
              <div className="bg-white border border-zinc-200 rounded-[20px] p-5">
                <div className="font-medium text-[13px]">Your savings plans</div>
                <div className="mt-4 space-y-3 max-h-[380px] overflow-auto pr-1">
                  {goals.length===0 && <div className="py-10 text-center"><div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-3"><Wallet size={16} className="text-zinc-500"/></div><div className="text-[13px] font-medium">No plans yet</div><div className="text-[11px] text-zinc-500 mt-1 max-w-[200px] mx-auto">Choose a car from Japan to create your first escrow savings plan.</div></div>}
                  {goals.map(goal => (
                    <div key={goal.id} className="border border-zinc-100 rounded-[14px] p-4 hover:border-zinc-200 transition">
                      <div className="flex justify-between items-start"><div><div className="font-medium text-[12.5px]">{goal.beahead_cars?.make} {goal.beahead_cars?.model} {goal.beahead_cars?.year}</div><div className="text-[10.5px] text-zinc-500 mt-0.5">{formatUSD(goal.goal_amount_usd)} total • {goal.escrow_account_number}</div></div><span className={`text-[10px] font-medium px-2 py-1 rounded-full ${goal.status==='active'?'bg-zinc-900 text-white':'bg-zinc-100 text-zinc-600'}`}>{goal.status}</span></div>
                      <div className="mt-3.5"><div className="flex justify-between text-[10.5px] mb-1.5"><span className="text-zinc-500">{formatUSD(goal.saved_amount_usd||0)} saved</span><span className="font-medium">{Math.round(goal.progress_percent||0)}%</span></div><div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden"><div className="h-full bg-zinc-900 rounded-full transition-all" style={{width:`${Math.min(100, goal.progress_percent||0)}%`}}></div></div></div>
                      <div className="mt-3 flex gap-2"><button onClick={()=>setDepositForm({...depositForm, goalId: goal.id})} className="flex-1 bg-zinc-900 text-white text-[11px] font-medium py-2 rounded-full">Add money</button><button onClick={()=>handleCancel(goal)} className="flex-1 bg-white border border-zinc-200 text-[11px] font-medium py-2 rounded-full">Cancel</button></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-[20px] p-5">
                <div className="font-medium text-[13px] flex items-center gap-2"><Upload size={14}/> Add money</div>
                <div className="text-[11px] text-zinc-500 mt-1">EcoCash, InnBucks, bank transfer or cash at EmpowerBank</div>
                <form onSubmit={addDeposit} className="mt-4 space-y-3">
                  <select value={depositForm.goalId} onChange={e=>setDepositForm({...depositForm, goalId:e.target.value})} className="w-full bg-[#f9f9f9] border border-zinc-200 rounded-full px-4 py-2.5 text-[12px] focus:bg-white focus:border-zinc-900 focus:outline-none" required><option value="">Select savings plan</option>{goals.filter(g=>g.status==='active').map(g=><option key={g.id} value={g.id}>{g.beahead_cars?.make} {g.beahead_cars?.model} • {formatUSD(g.goal_amount_usd)}</option>)}</select>
                  <input type="number" placeholder="Amount in USD" value={depositForm.amount} onChange={e=>setDepositForm({...depositForm, amount:e.target.value})} className="w-full bg-[#f9f9f9] border border-zinc-200 rounded-full px-4 py-2.5 text-[12px] focus:bg-white focus:border-zinc-900 focus:outline-none" required/>
                  <select value={depositForm.method} onChange={e=>setDepositForm({...depositForm, method:e.target.value})} className="w-full bg-[#f9f9f9] border border-zinc-200 rounded-full px-4 py-2.5 text-[12px] focus:bg-white focus:border-zinc-900 focus:outline-none"><option value="bank_transfer">Bank transfer (Nostro)</option><option value="cash_deposit">Cash at EmpowerBank branch</option><option value="ecocash">EcoCash USD</option><option value="innbucks">InnBucks</option><option value="zipit">ZiPIT</option></select>
                  <input placeholder="Reference code from bank / EcoCash" value={depositForm.reference} onChange={e=>setDepositForm({...depositForm, reference:e.target.value})} className="w-full bg-[#f9f9f9] border border-zinc-200 rounded-full px-4 py-2.5 text-[12px] focus:bg-white focus:border-zinc-900 focus:outline-none" required/>
                  <button type="submit" className="w-full bg-zinc-900 text-white py-3 rounded-full text-[12px] font-medium hover:bg-black transition">Submit deposit for verification</button>
                  <div className="text-[10px] leading-[1.4] text-zinc-500 text-center">Verified by EmpowerBank within a few hours. You'll get an SMS.</div>
                </form>
              </div>

              <div className="bg-[#f9f9f9] border border-zinc-100 rounded-[20px] p-5">
                <div className="flex items-center gap-2 font-medium text-[12px]"><FileText size={14}/> How escrow protects you</div>
                <div className="mt-2 text-[11px] leading-[1.6] text-zinc-600">Your money is held in your own account at EmpowerBank. We can only release it to BeForward when you have fully saved and authorized the purchase. If you cancel early, a 7% fee covers bank admin and reservation costs. No hidden fees.</div>
                <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-500"><MapPin size={10}/> BDC Zimbabwe • Thuthuka Mall, Shop F4, Bulawayo • Clearing & delivery included</div>
              </div>
            </div>
          </div>

          <div className="mt-10 bg-white border border-zinc-200 rounded-[20px] p-6">
            <div className="flex items-center justify-between">
              <div className="font-medium text-[13px]">Recent deposits</div>
              <div className="text-[11px] text-zinc-500">Verified by bank • Escrow secured</div>
            </div>
            <div className="mt-5 overflow-auto">
              <table className="w-full text-[12px]"><thead className="text-[10px] text-zinc-500 border-b border-zinc-100"><tr><th className="text-left font-medium py-2.5">Date</th><th className="text-left font-medium">Car</th><th className="text-left font-medium">Amount</th><th className="text-left font-medium">Method</th><th className="text-left font-medium">Reference</th><th className="text-left font-medium">Status</th></tr></thead><tbody>{deposits.map(d=><tr key={d.id} className="border-b border-zinc-50 last:border-0"><td className="py-3 text-zinc-600">{new Date(d.created_at).toLocaleDateString()}</td><td className="font-medium">{d.beahead_goals?.beahead_cars?.make} {d.beahead_goals?.beahead_cars?.model}</td><td className="font-medium">{formatUSD(d.amount_usd)}</td><td className="text-zinc-600">{d.method}</td><td className="font-mono text-[11px]">{d.reference_code}</td><td><span className={`text-[10px] font-medium px-2 py-1 rounded-full ${d.verification_status==='verified'?'bg-zinc-900 text-white':'bg-amber-100 text-amber-800'}`}>{d.verification_status}</span></td></tr>)}{deposits.length===0 && <tr><td colSpan={6} className="py-12 text-center"><div className="text-zinc-500 text-[12px]">No deposits yet. Add money to your savings plan to see it here.</div></td></tr>}</tbody></table>
            </div>
          </div>
        </div>
      )}

      {showAgreement && selectedCar && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-[8px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] max-w-[480px] w-full max-h-[90vh] overflow-auto shadow-[0_20px_60px_-20px_rgba(0,0,0,0.3)]">
            <div className="p-7">
              <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center mb-4"><Shield size={16} className="text-white"/></div>
              <h3 className="text-[18px] font-semibold tracking-tight">Start saving for this car?</h3>
              <div className="mt-1 text-[12px] text-zinc-600">{selectedCar.make} {selectedCar.model} {selectedCar.year} • {selectedCar.mileage?.toLocaleString()} km • {selectedCar.engine_cc}cc</div>
              {(() => { const calc = calculateLandedCost(selectedCar); return (
                <div className="mt-6 space-y-4">
                  <div className="bg-[#f9f9f9] rounded-[16px] p-4 space-y-2.5">
                    {calc.breakdown.map((b,i)=><div key={i} className="flex justify-between text-[12px]"><span className="text-zinc-600">{b.label}</span><span className="font-medium">{formatUSD(b.value)}</span></div>)}
                    <div className="h-px bg-zinc-200 my-2"></div>
                    <div className="flex justify-between font-semibold text-[14px]"><span>Total to own</span><span>{formatUSD(calc.total)}</span></div>
                    <div className="text-[11px] text-zinc-500">Includes shipping to Durban, ZIMRA duty estimate, and delivery to Bulawayo via BDC Zimbabwe.</div>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-100 rounded-[14px] p-3.5 flex gap-2.5">
                    <div className="w-6 h-6 bg-white border border-zinc-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><CheckCircle size={12}/></div>
                    <div className="text-[11px] leading-[1.5] text-zinc-600"><span className="font-medium text-zinc-900">What happens if this car sells while you save?</span> We find 3 similar cars at the same price. You switch for free, no penalty. Your savings stay safe in your bank account.</div>
                  </div>
                  <div className="flex gap-2.5 pt-2">
                    <button onClick={()=>setShowAgreement(false)} className="flex-1 bg-white border border-zinc-200 py-3 rounded-full text-[13px] font-medium hover:bg-zinc-50 transition">Cancel</button>
                    <button onClick={createGoal} className="flex-1 bg-zinc-900 text-white py-3 rounded-full text-[13px] font-medium hover:bg-black transition">Create savings plan</button>
                  </div>
                  <div className="text-[10px] leading-[1.4] text-zinc-500 text-center">By creating a plan you agree to escrow terms. Your money is held by EmpowerBank, not BeAhead. 7% fee only if you cancel early.</div>
                </div>
              )})()}
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-zinc-100 mt-16">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-10 flex flex-col md:flex-row justify-between gap-6">
          <div><div className="flex items-center gap-2"><div className="w-6 h-6 bg-zinc-900 text-white rounded-full flex items-center justify-center font-bold text-[11px]">B</div><div className="font-semibold text-[13px]">BeAhead</div></div><div className="text-[11px] text-zinc-500 mt-2 max-w-[280px] leading-[1.5]">Licensed escrow savings for BeForward cars. Save monthly in your own bank account. We handle shipping and delivery to Bulawayo.</div></div>
          <div className="flex gap-12 text-[11px]"><div><div className="font-medium mb-2">Office</div><div className="text-zinc-500 leading-[1.6]">Thuthuka Mall, Shop F4<br/>Between 4th & 5th Ave<br/>Jason Moyo Ave, Bulawayo</div></div><div><div className="font-medium mb-2">Partners</div><div className="text-zinc-500 leading-[1.6]">BDC Zimbabwe (Pvt) Ltd<br/>EmpowerBank Escrow<br/>BeForward Japan</div></div><div><div className="font-medium mb-2">Legal</div><div className="text-zinc-500 leading-[1.6]">Escrow Agreement<br/>Privacy • Terms<br/>RBZ Compliant</div></div></div>
        </div>
        <div className="border-t border-zinc-100 py-4 text-center text-[10px] text-zinc-400">© 2026 BeAhead (Pvt) Ltd • Save small, drive big • Funds held by licensed bank, not BeAhead</div>
      </footer>
    </div>
  )
}
