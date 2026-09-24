import { useState, useEffect } from 'react'
import { supabase, checkTables } from './lib/supabase'
import { calculateLandedCost, calculatePenalty, calculateMonthly, formatUSD } from './utils/calculations'
import { Car, Shield, Wallet, MapPin, CheckCircle, AlertTriangle, TrendingUp, Users, DollarSign, FileText, Upload, LogOut, Building2, Clock, Phone } from 'lucide-react'

const MOCK_CARS = [
  { id: '1', beforward_ref: 'BF-AQUA-2015-001', make: 'Toyota', model: 'Aqua', year: 2015, price_usd: 3250, freight_usd: 1150, mileage: 85000, engine_cc: 1500, fuel_type: 'Hybrid', transmission: 'Automatic', image_url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600', beforward_url: 'https://www.beforward.jp/toyota/aqua/', duty_rate: 0.55, status: 'available' },
  { id: '2', beforward_ref: 'BF-FIT-2016-002', make: 'Honda', model: 'Fit', year: 2016, price_usd: 3800, freight_usd: 1150, mileage: 72000, engine_cc: 1300, fuel_type: 'Petrol', transmission: 'Automatic', image_url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600', beforward_url: 'https://www.beforward.jp/honda/fit/', duty_rate: 0.55, status: 'available' },
  { id: '3', beforward_ref: 'BF-BELTA-2014-003', make: 'Toyota', model: 'Belta', year: 2014, price_usd: 2900, freight_usd: 1150, mileage: 95000, engine_cc: 1000, fuel_type: 'Petrol', transmission: 'Automatic', image_url: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=600', beforward_url: 'https://www.beforward.jp/toyota/belta/', duty_rate: 0.50, status: 'available' },
  { id: '4', beforward_ref: 'BF-PASSO-2017-004', make: 'Toyota', model: 'Passo', year: 2017, price_usd: 3400, freight_usd: 1150, mileage: 65000, engine_cc: 1000, fuel_type: 'Petrol', transmission: 'Automatic', image_url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600', beforward_url: 'https://www.beforward.jp/toyota/passo/', duty_rate: 0.50, status: 'available' },
]

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [view, setView] = useState('landing')
  const [cars, setCars] = useState(MOCK_CARS)
  const [goals, setGoals] = useState([])
  const [deposits, setDeposits] = useState([])
  const [selectedCar, setSelectedCar] = useState(null)
  const [showAgreement, setShowAgreement] = useState(false)
  const [tablesExist, setTablesExist] = useState(true)
  const [loading, setLoading] = useState(true)
  const [authForm, setAuthForm] = useState({ email: '', password: '', fullName: '', phone: '' })
  const [depositForm, setDepositForm] = useState({ goalId: '', amount: '', method: 'bank_transfer', reference: '' })

  useEffect(() => {
    init()
  }, [])

  const init = async () => {
    setLoading(true)
    const exists = await checkTables()
    setTablesExist(exists)
    
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      setUser(session.user)
      await loadProfile(session.user.id)
      await loadData(session.user.id)
      setView('dashboard')
    }
    
    if (exists) {
      const { data: carsData } = await supabase.from('beahead_cars').select('*').eq('status','available').limit(20)
      if (carsData && carsData.length > 0) setCars(carsData)
    }
    setLoading(false)
  }

  const loadProfile = async (userId) => {
    const { data } = await supabase.from('beahead_profiles').select('*').eq('id', userId).single()
    if (data) setProfile(data)
  }

  const loadData = async (userId) => {
    if (!tablesExist) return
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
          await supabase.from('beahead_profiles').insert({
            id: data.user.id,
            email: authForm.email,
            full_name: authForm.fullName,
            phone: authForm.phone,
            role: 'user',
            bank_account_number: `ESCROW-${Math.floor(100000+Math.random()*900000)}`
          })
          setUser(data.user)
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
      escrow_account_number: profile?.bank_account_number || `ESCROW-${Math.floor(100000+Math.random()*900000)}`,
      escrow_bank_name: 'EmpowerBank Microfinance - Escrow Division',
      agreement_signed: true,
      agreement_signed_at: new Date().toISOString(),
      penalty_rate: 0.07,
      monthly_target: calculateMonthly(calc.total, 12),
      bdc_office: 'Thuthuka Mall Between 4th and 5th and Jason Moyo Ave, Shop F4, Bulawayo',
    }

    if (tablesExist) {
      const { data, error } = await supabase.from('beahead_goals').insert(goalData).select('*, beahead_cars(*)').single()
      if (!error && data) {
        setGoals([data, ...goals])
        // Create referral commission $5
        await supabase.from('beahead_commissions').insert({
          goal_id: data.id,
          user_id: user.id,
          type: 'referral',
          amount_usd: 5,
          recipient: 'BeAhead',
          notes: 'New escrow account referral - $5'
        })
        await supabase.from('beahead_activities').insert({
          goal_id: data.id,
          user_id: user.id,
          action: 'goal_created',
          details: { car: selectedCar.beforward_ref, total: calc.total }
        })
      }
    } else {
      // Mock for pitch
      const mockGoal = { ...goalData, id: Math.random().toString(36).substr(2,9), beahead_cars: selectedCar, created_at: new Date().toISOString() }
      setGoals([mockGoal, ...goals])
    }
    
    setShowAgreement(false)
    setSelectedCar(null)
    alert(`Goal created! Total: ${formatUSD(calc.total)} - Escrow: ${goalData.escrow_account_number}`)
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

    if (tablesExist) {
      const { data, error } = await supabase.from('beahead_deposits').insert(dep).select().single()
      if (!error) {
        setDeposits([data, ...deposits])
        // Auto-verify for demo pitch (in production bank verifies)
        setTimeout(async () => {
          await supabase.from('beahead_deposits').update({ verification_status: 'verified', verified_at: new Date().toISOString() }).eq('id', data.id)
          loadData(user.id)
        }, 1000)
      }
    } else {
      const mockDep = { ...dep, id: Math.random().toString(36).substr(2,9), verification_status: 'verified', created_at: new Date().toISOString(), beahead_goals: goal }
      setDeposits([mockDep, ...deposits])
      // Update goal saved amount mock
      setGoals(goals.map(g => g.id === goal.id ? { ...g, saved_amount_usd: (g.saved_amount_usd||0) + Number(depositForm.amount), progress_percent: ((g.saved_amount_usd||0)+Number(depositForm.amount))/g.goal_amount_usd*100 } : g))
    }
    setDepositForm({ goalId: '', amount: '', method: 'bank_transfer', reference: '' })
  }

  const handleCancel = async (goal) => {
    const penalty = calculatePenalty(goal.saved_amount_usd || 0)
    if (!confirm(`Cancel this goal? You saved ${formatUSD(goal.saved_amount_usd)}. Penalty 7% = ${formatUSD(penalty.totalPenalty)}\n\nSplit:\n- Bank (40%): ${formatUSD(penalty.bank)} (${penalty.bankPercentOfSaved}% of saved)\n- BeAhead (40%): ${formatUSD(penalty.beahead)}\n- BeForward BDC (20%): ${formatUSD(penalty.beforward)} (${penalty.beforwardPercentOfSaved}% of saved)\n\nYou get back: ${formatUSD((goal.saved_amount_usd||0) - penalty.totalPenalty)}`)) return
    
    if (tablesExist) {
      await supabase.from('beahead_goals').update({ status: 'cancelled', cancellation_reason: 'User requested' }).eq('id', goal.id)
      await supabase.from('beahead_commissions').insert([
        { goal_id: goal.id, user_id: user.id, type: 'penalty_bank', amount_usd: penalty.bank, recipient: 'Bank', notes: `40% of penalty` },
        { goal_id: goal.id, user_id: user.id, type: 'penalty_beahead', amount_usd: penalty.beahead, recipient: 'BeAhead', notes: `40% of penalty` },
        { goal_id: goal.id, user_id: user.id, type: 'penalty_beforward', amount_usd: penalty.beforward, recipient: 'BDC Zimbabwe', notes: `20% of penalty - 1.4% of saved` },
      ])
      loadData(user.id)
    } else {
      setGoals(goals.map(g => g.id === goal.id ? { ...g, status: 'cancelled' } : g))
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-black border-t-transparent rounded-full"></div></div>

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900">
      {/* SETUP BANNER IF TABLES DON'T EXIST */}
      {!tablesExist && (
        <div className="bg-amber-400 text-black px-4 py-3 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2"><AlertTriangle size={16}/> <span><b>Demo Mode:</b> Tables not created yet. Run <code>beahead_schema.sql</code> in Supabase SQL Editor to go live. Your other tables are safe - we use <code>beahead_</code> prefix.</span></div>
          <a href="/beahead_schema.sql" target="_blank" className="bg-black text-white px-3 py-1 rounded text-xs">View SQL</a>
        </div>
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-black text-white rounded-lg flex items-center justify-center font-black text-lg">B</div>
            <div>
              <div className="font-bold text-lg leading-none">BeAhead</div>
              <div className="text-[10px] tracking-widest text-zinc-500 font-semibold">SAVE SMALL • DRIVE BIG</div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <span className="flex items-center gap-1.5"><MapPin size={14}/> Bulawayo • Thuthuka Mall Shop F4</span>
            <span className="flex items-center gap-1.5"><Shield size={14}/> RBZ Compliant Escrow</span>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden sm:block text-sm">{profile?.full_name || user.email}</span>
                <button onClick={handleLogout} className="p-2 hover:bg-zinc-100 rounded-lg"><LogOut size={18}/></button>
              </>
            ) : (
              <button onClick={() => setView('auth')} className="bg-black text-white px-5 py-2 rounded-full text-sm font-semibold">Start Saving</button>
            )}
          </div>
        </div>
      </header>

      {view === 'landing' && (
        <div>
          {/* HERO */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-zinc-900 text-white text-xs px-3 py-1 rounded-full mb-4"><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>Live in Bulawayo • Partner: BDC Zimbabwe</div>
                <h1 className="text-5xl md:text-6xl font-black leading-[0.9] tracking-tight">Own a <span className="text-zinc-400">BeForward</span> car without $6k cash.</h1>
                <p className="mt-6 text-lg text-zinc-600 leading-relaxed">BeAhead is a licensed escrow savings system. Pick a specific BeForward car, save monthly into your own USD Nostro account at EmpowerBank, and we handle the rest. Your money never touches us.</p>
                
                <div className="mt-8 grid grid-cols-3 gap-4">
                  <div className="bg-white border border-zinc-200 rounded-2xl p-4"><div className="text-2xl font-black">600</div><div className="text-xs text-zinc-500">BeForward cars/month into Zim [official]</div></div>
                  <div className="bg-white border border-zinc-200 rounded-2xl p-4"><div className="text-2xl font-black">7%</div><div className="text-xs text-zinc-500">Penalty only, split 40/40/20</div></div>
                  <div className="bg-white border border-zinc-200 rounded-2xl p-4"><div className="text-2xl font-black">1.4%</div><div className="text-xs text-zinc-500">BeForward cut on cancel = tiny</div></div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button onClick={() => setView('auth')} className="bg-black text-white px-8 py-4 rounded-full font-semibold">Pick Your Car →</button>
                  <button onClick={() => document.getElementById('how').scrollIntoView()} className="bg-white border border-zinc-300 px-8 py-4 rounded-full font-semibold">How it works</button>
                </div>

                <div className="mt-6 flex items-center gap-4 text-xs text-zinc-500">
                  <span className="flex items-center gap-1"><Building2 size={12}/> Escrow at EmpowerBank</span>
                  <span className="flex items-center gap-1"><Shield size={12}/> Tripartite Agreement</span>
                  <span className="flex items-center gap-1"><MapPin size={12}/> BDC Zimbabwe F4</span>
                </div>
              </div>

              <div className="relative">
                <div className="bg-white rounded-[2rem] border border-zinc-200 p-3 shadow-2xl">
                  <div className="bg-zinc-900 rounded-[1.5rem] p-6 text-white">
                    <div className="flex justify-between items-start mb-6">
                      <div><div className="text-zinc-400 text-xs">ESCROW ACCOUNT</div><div className="font-mono text-sm mt-1">{profile?.bank_account_number || 'ESCROW-847392'}</div></div>
                      <div className="bg-green-500 text-black text-[10px] px-2 py-1 rounded-full font-bold">VERIFIED</div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm"><span className="text-zinc-400">Toyota Aqua 2015</span><span className="font-mono">$3,250</span></div>
                      <div className="flex justify-between text-sm"><span className="text-zinc-400">Freight + Duty + Clearing</span><span className="font-mono">$3,350</span></div>
                      <div className="flex justify-between text-sm"><span className="text-zinc-400">BeAhead Fee 3%</span><span className="font-mono">$97</span></div>
                      <div className="border-t border-zinc-700 my-3"></div>
                      <div className="flex justify-between font-bold"><span>Total Landed</span><span className="text-xl">$6,697</span></div>
                    </div>
                    <div className="mt-6">
                      <div className="flex justify-between text-xs mb-2"><span>Progress</span><span>68% • $4,550 saved</span></div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-white w-[68%]"></div></div>
                      <div className="mt-3 text-[11px] text-zinc-400">Next deposit: $200 due 30 Sep • Verified by EmpowerBank</div>
                    </div>
                  </div>
                  <div className="p-4 flex items-center gap-3 text-xs">
                    <img src="https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=100" className="w-12 h-12 rounded-lg object-cover"/>
                    <div><div className="font-semibold">Toyota Aqua 2015 • BF-AQUA-001</div><div className="text-zinc-500">85,000km • Hybrid • Reserved at BDC Bulawayo</div></div>
                    <CheckCircle className="ml-auto text-green-600" size={18}/>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* HOW IT WORKS */}
          <section id="how" className="bg-white border-y border-zinc-200 py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl font-black mb-10">How BeAhead makes BeForward savings safe</h2>
              <div className="grid md:grid-cols-4 gap-6">
                {[
                  { icon: Car, title: '1. Pick Specific Car', desc: 'Browse real BeForward listings inside BeAhead. We calculate total landed cost: car + freight + ZIMRA duty + BDC clearing + 3% fee. No surprises.' },
                  { icon: Shield, title: '2. Sign Escrow Agreement', desc: 'Tripartite agreement: You + EmpowerBank + BeAhead. Funds locked in YOUR Nostro account. Only releasable to BeForward invoice with BeAhead Ref Code.' },
                  { icon: Wallet, title: '3. Save Monthly', desc: 'Deposit $50-$500/month via bank, EcoCash, InnBucks proof upload. Every deposit triggers SMS + bank verification + dashboard update. Bank holds float interest.' },
                  { icon: CheckCircle, title: '4. We Buy & Deliver', desc: 'At 80% we reserve car via BDC Zimbabwe Shop F4 Bulawayo. At 100% bank pays BeForward directly. BDC handles Beitbridge clearance to your door.' },
                ].map((s,i) => (
                  <div key={i} className="border border-zinc-200 rounded-2xl p-6">
                    <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center mb-4"><s.icon size={18}/></div>
                    <div className="font-bold">{s.title}</div>
                    <div className="text-sm text-zinc-600 mt-2 leading-relaxed">{s.desc}</div>
                  </div>
                ))}
              </div>

              <div className="mt-12 bg-zinc-900 text-white rounded-[2rem] p-8 grid md:grid-cols-3 gap-8">
                <div><h3 className="font-bold text-lg">Why Bank Says Yes</h3><ul className="mt-3 space-y-2 text-sm text-zinc-300 list-disc list-inside"><li>25-50 new USD Nostro clients pilot (not 500 fake)</li><li>$5 referral fee cheap vs $20 CAC</li><li>Float interest for 12 months + 40% penalty share</li><li>Right to offer duty top-up loans</li></ul></div>
                <div><h3 className="font-bold text-lg">Why BDC Bulawayo Says Yes</h3><ul className="mt-3 space-y-2 text-sm text-zinc-300 list-disc list-inside"><li>New segment: savers, not cash buyers</li><li>Zero work: we bring escrowed buyers</li><li>They keep clearing fee $350 + 20% penalty (1.4% of saved)</li><li>Listed as official Savings Partner</li></ul></div>
                <div><h3 className="font-bold text-lg">Why User Trusts</h3><ul className="mt-3 space-y-2 text-sm text-zinc-300 list-disc list-inside"><li>Money in THEIR bank account, verifiable via USSD</li><li>QR Escrow Certificate from bank</li><li>Live BeForward link, no hidden price</li><li>BeAhead Guarantee: if car gone, free switch no penalty</li></ul></div>
              </div>
            </div>
          </section>

          {/* PENALTY MATH EXPLAINED */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div>
                <h2 className="text-3xl font-black">Penalty that is fair - not 50% to BeForward</h2>
                <p className="mt-4 text-zinc-600">You asked: "10k saved, BeForward takes $500, what % is that?" Answer: $500 is 5% of saved, but 50% of penalty. Too much. We fixed it to 7% total penalty, 20% to BeForward = only 1.4% of saved.</p>
                <div className="mt-6 bg-white border border-zinc-200 rounded-2xl p-6">
                  <div className="font-mono text-sm space-y-2">
                    <div className="flex justify-between"><span>Saved: $10,000</span><span>Penalty 7% = $700</span></div>
                    <div className="h-px bg-zinc-200"></div>
                    <div className="flex justify-between"><span>Bank 40% = $280</span><span className="text-zinc-500">2.8% of saved</span></div>
                    <div className="flex justify-between"><span>BeAhead 40% = $280</span><span className="text-zinc-500">2.8% of saved</span></div>
                    <div className="flex justify-between font-bold"><span>BDC/BeForward 20% = $140</span><span className="text-green-600">1.4% of saved - tiny</span></div>
                    <div className="h-px bg-zinc-200"></div>
                    <div className="flex justify-between font-black"><span>You get back</span><span>$9,300</span></div>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-zinc-200 rounded-[2rem] p-8">
                <h3 className="font-bold">Real Market Data (for your pitch)</h3>
                <div className="mt-4 space-y-4 text-sm">
                  <div className="flex gap-3"><div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center"><TrendingUp size={16}/></div><div><div className="font-semibold">BeForward: 600 cars/month into Zim</div><div className="text-zinc-500">~7,200/year - per BeForward Payment Manager Fujita Kazuhisa</div></div></div>
                  <div className="flex gap-3"><div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center"><Building2 size={16}/></div><div><div className="font-semibold">BDC Zimbabwe Office Bulawayo</div><div className="text-zinc-500">Thuthuka Mall, Shop F4, Between 4th & 5th, Jason Moyo Ave - Official Agent</div></div></div>
                  <div className="flex gap-3"><div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center"><Users size={16}/></div><div><div className="font-semibold">Zim imports 15k-50k used cars/year</div><div className="text-zinc-500">92% used, 8% new - Equity Axis & ZIMRA data</div></div></div>
                  <div className="flex gap-3"><div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center"><DollarSign size={16}/></div><div><div className="font-semibold">Our Pilot: 25 clients, not 500</div><div className="text-zinc-500">25 x $6,500 avg = $162k new sales for BDC + 25 new accounts for bank. Believable.</div></div></div>
                </div>
                <button onClick={() => setView('auth')} className="mt-8 w-full bg-black text-white py-3 rounded-full font-semibold">Start Pilot with 25 Users</button>
              </div>
            </div>
          </section>
        </div>
      )}

      {view === 'auth' && (
        <div className="max-w-md mx-auto px-4 py-16">
          <div className="bg-white border border-zinc-200 rounded-[2rem] p-8">
            <h2 className="text-2xl font-black">Create Escrow Account</h2>
            <p className="text-sm text-zinc-500 mt-2">Your money goes to EmpowerBank, not us. You get a Nostro account number instantly.</p>
            <div className="mt-6 space-y-4">
              <input placeholder="Full Name (as on ID)" value={authForm.fullName} onChange={e=>setAuthForm({...authForm, fullName:e.target.value})} className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm"/>
              <input placeholder="Phone (EcoCash)" value={authForm.phone} onChange={e=>setAuthForm({...authForm, phone:e.target.value})} className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm"/>
              <input placeholder="Email" value={authForm.email} onChange={e=>setAuthForm({...authForm, email:e.target.value})} className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm"/>
              <input placeholder="Password" type="password" value={authForm.password} onChange={e=>setAuthForm({...authForm, password:e.target.value})} className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm"/>
              <button onClick={()=>handleAuth('signup')} className="w-full bg-black text-white py-3 rounded-full font-semibold">Create Account + Get Escrow Number</button>
              <button onClick={()=>handleAuth('login')} className="w-full bg-white border border-zinc-300 py-3 rounded-full font-semibold text-sm">Already have account? Login</button>
              <div className="text-[11px] text-zinc-500 text-center">By signing you agree to Tripartite Escrow Agreement - funds locked, 7% penalty on cancel split 40/40/20</div>
            </div>
          </div>
        </div>
      )}

      {view === 'dashboard' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-wrap gap-2 mb-8">
            <button onClick={()=>setView('dashboard')} className="bg-black text-white px-4 py-2 rounded-full text-sm">My Goals</button>
            <span className="px-4 py-2 text-sm text-zinc-500 flex items-center gap-2"><Shield size={14}/> Escrow: {profile?.bank_account_number || 'ESCROW-847392'} • {profile?.bank_name || 'EmpowerBank'}</span>
            <span className="px-4 py-2 text-sm text-zinc-500 flex items-center gap-2"><Phone size={14}/> BDC Bulawayo: +263 78 883 5248</span>
          </div>

          {/* STATS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white border border-zinc-200 rounded-2xl p-5"><div className="text-xs text-zinc-500">Total Saved</div><div className="text-2xl font-black mt-1">{formatUSD(goals.reduce((s,g)=>s+(g.saved_amount_usd||0),0))}</div></div>
            <div className="bg-white border border-zinc-200 rounded-2xl p-5"><div className="text-xs text-zinc-500">Active Goals</div><div className="text-2xl font-black mt-1">{goals.filter(g=>g.status==='active').length}</div></div>
            <div className="bg-white border border-zinc-200 rounded-2xl p-5"><div className="text-xs text-zinc-500">Referral Earned (You)</div><div className="text-2xl font-black mt-1">{formatUSD(goals.length*5)}</div><div className="text-[11px] text-zinc-500">$5 per new escrow account</div></div>
            <div className="bg-white border border-zinc-200 rounded-2xl p-5"><div className="text-xs text-zinc-500">Est. Commission on Sale</div><div className="text-2xl font-black mt-1">{formatUSD(goals.reduce((s,g)=>s+(g.beahead_fee_usd||0),0))}</div><div className="text-[11px] text-zinc-500">3% per car when sold</div></div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* CAR BROWSER */}
            <div className="lg:col-span-2">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Car size={18}/> Pick Specific BeForward Car (Live)</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {cars.map(car => {
                  const calc = calculateLandedCost(car)
                  return (
                    <div key={car.id} className="bg-white border border-zinc-200 rounded-[1.5rem] overflow-hidden hover:shadow-lg transition">
                      <img src={car.image_url} alt={car.make} className="w-full h-40 object-cover"/>
                      <div className="p-4">
                        <div className="flex justify-between items-start"><div><div className="font-bold">{car.make} {car.model} {car.year}</div><div className="text-xs text-zinc-500">{car.beforward_ref} • {car.mileage?.toLocaleString()}km • {car.engine_cc}cc</div></div><div className="text-right"><div className="font-black">{formatUSD(car.price_usd)}</div><div className="text-[10px] text-zinc-500">FOB Japan</div></div></div>
                        <div className="mt-3 bg-zinc-50 rounded-xl p-3 text-xs space-y-1"><div className="flex justify-between"><span>Total Landed:</span><span className="font-bold">{formatUSD(calc.total)}</span></div><div className="flex justify-between text-zinc-500"><span>Monthly (12mo):</span><span>{formatUSD(calculateMonthly(calc.total))}/mo</span></div></div>
                        <button onClick={()=>{setSelectedCar(car); setShowAgreement(true)}} className="mt-3 w-full bg-black text-white py-2.5 rounded-full text-sm font-semibold">Select This Car → Save</button>
                        <a href={car.beforward_url} target="_blank" className="mt-2 block text-center text-[11px] text-zinc-500 underline">View original on BeForward.jp</a>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* GOALS & DEPOSITS */}
            <div className="space-y-6">
              <div className="bg-white border border-zinc-200 rounded-[1.5rem] p-5">
                <h4 className="font-bold flex items-center gap-2"><Wallet size={16}/> My Savings Goals</h4>
                <div className="mt-4 space-y-4 max-h-[400px] overflow-auto">
                  {goals.length===0 && <div className="text-sm text-zinc-500">No goals yet. Pick a car.</div>}
                  {goals.map(goal => {
                    const penalty = calculatePenalty(goal.saved_amount_usd||0)
                    return (
                      <div key={goal.id} className="border border-zinc-200 rounded-xl p-4">
                        <div className="flex justify-between"><span className="font-semibold text-sm">{goal.beahead_cars?.make} {goal.beahead_cars?.model}</span><span className={`text-[10px] px-2 py-1 rounded-full ${goal.status==='active'?'bg-green-100 text-green-700':'bg-zinc-100'}`}>{goal.status}</span></div>
                        <div className="text-xs text-zinc-500 mt-1">Goal: {formatUSD(goal.goal_amount_usd)} • Escrow: {goal.escrow_account_number}</div>
                        <div className="mt-3"><div className="flex justify-between text-[11px] mb-1"><span>{formatUSD(goal.saved_amount_usd||0)} saved</span><span>{Math.round(goal.progress_percent||0)}%</span></div><div className="h-2 bg-zinc-100 rounded-full overflow-hidden"><div className="h-full bg-black" style={{width:`${Math.min(100, goal.progress_percent||0)}%`}}></div></div></div>
                        <div className="mt-3 flex gap-2"><button onClick={()=>setDepositForm({...depositForm, goalId: goal.id})} className="flex-1 bg-zinc-900 text-white text-xs py-2 rounded-full">Add Deposit</button><button onClick={()=>handleCancel(goal)} className="flex-1 bg-white border border-zinc-300 text-xs py-2 rounded-full">Cancel • Fee {formatUSD(penalty.totalPenalty)}</button></div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-[1.5rem] p-5">
                <h4 className="font-bold flex items-center gap-2"><Upload size={16}/> Add Deposit (EcoCash/Bank)</h4>
                <form onSubmit={addDeposit} className="mt-4 space-y-3">
                  <select value={depositForm.goalId} onChange={e=>setDepositForm({...depositForm, goalId:e.target.value})} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm" required><option value="">Select Goal</option>{goals.filter(g=>g.status==='active').map(g=><option key={g.id} value={g.id}>{g.beahead_cars?.make} {g.beahead_cars?.model} - {formatUSD(g.goal_amount_usd)}</option>)}</select>
                  <input type="number" placeholder="Amount USD" value={depositForm.amount} onChange={e=>setDepositForm({...depositForm, amount:e.target.value})} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm" required/>
                  <select value={depositForm.method} onChange={e=>setDepositForm({...depositForm, method:e.target.value})} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm"><option value="bank_transfer">Bank Transfer (Nostro)</option><option value="cash_deposit">Cash at EmpowerBank</option><option value="ecocash">EcoCash USD</option><option value="innbucks">InnBucks</option><option value="zipit">ZiPIT</option></select>
                  <input placeholder="Reference Code / Proof" value={depositForm.reference} onChange={e=>setDepositForm({...depositForm, reference:e.target.value})} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm" required/>
                  <button type="submit" className="w-full bg-black text-white py-2.5 rounded-full text-sm font-semibold">Submit for Bank Verification</button>
                  <div className="text-[11px] text-zinc-500">Upload will be verified by EmpowerBank admin. You get SMS + dashboard update. Bank keeps float interest.</div>
                </form>
              </div>

              <div className="bg-zinc-900 text-white rounded-[1.5rem] p-5">
                <h4 className="font-bold flex items-center gap-2"><FileText size={16}/> Escrow Agreement</h4>
                <div className="mt-3 text-xs text-zinc-300 leading-relaxed">
                  Tripartite Agreement between User, EmpowerBank Microfinance (Escrow Agent), and BeAhead (Technology & Referral Partner). Funds locked in account {profile?.bank_account_number}. Release only on BeForward invoice with Ref Code BEAHEAD-ZW-XXXX. Penalty 7% split: Bank 40% ($280 on $10k example = 2.8% of saved), BeAhead 40% (2.8%), BDC Zimbabwe 20% ($140 = 1.4% of saved). RBZ compliant - BeAhead never holds money.
                </div>
                <div className="mt-4 text-[10px] text-zinc-500">BDC Zimbabwe Bulawayo Office: Thuthuka Mall Shop F4, Between 4th & 5th Ave, Jason Moyo Ave • +263 78 883 5248 • bestdealscars4@gmail.com</div>
              </div>
            </div>
          </div>

          {/* DEPOSITS LEDGER */}
          <div className="mt-12 bg-white border border-zinc-200 rounded-[1.5rem] p-6">
            <h4 className="font-bold">Deposit Ledger (Bank Verified)</h4>
            <div className="mt-4 overflow-auto">
              <table className="w-full text-sm"><thead className="text-xs text-zinc-500 border-b"><tr><th className="text-left py-2">Date</th><th className="text-left">Goal</th><th className="text-left">Amount</th><th className="text-left">Method</th><th className="text-left">Ref</th><th className="text-left">Status</th></tr></thead><tbody>{deposits.map(d=><tr key={d.id} className="border-b border-zinc-100"><td className="py-2">{new Date(d.created_at).toLocaleDateString()}</td><td>{d.beahead_goals?.beahead_cars?.make || 'Goal'} {d.beahead_goals?.beahead_cars?.model || ''}</td><td className="font-semibold">{formatUSD(d.amount_usd)}</td><td>{d.method}</td><td className="font-mono text-xs">{d.reference_code}</td><td><span className={`text-[10px] px-2 py-1 rounded-full ${d.verification_status==='verified'?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>{d.verification_status}</span></td></tr>)}{deposits.length===0 && <tr><td colSpan={6} className="py-8 text-center text-zinc-500">No deposits yet</td></tr>}</tbody></table>
            </div>
          </div>
        </div>
      )}

      {showAgreement && selectedCar && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] max-w-lg w-full max-h-[90vh] overflow-auto p-8">
            <h3 className="text-2xl font-black">Lock This Car?</h3>
            <div className="mt-2 text-sm text-zinc-600">{selectedCar.make} {selectedCar.model} {selectedCar.year} • {selectedCar.beforward_ref}</div>
            {(() => { const calc = calculateLandedCost(selectedCar); return (
              <div className="mt-6 space-y-3">
                <div className="bg-zinc-50 rounded-2xl p-4 space-y-2 text-sm">{calc.breakdown.map((b,i)=><div key={i} className="flex justify-between"><span className="text-zinc-600">{b.label}</span><span className="font-semibold">{formatUSD(b.value)}</span></div>)}<div className="h-px bg-zinc-200 my-2"></div><div className="flex justify-between font-black text-lg"><span>Total Landed</span><span>{formatUSD(calc.total)}</span></div><div className="text-[11px] text-zinc-500">Monthly for 12 months: {formatUSD(calculateMonthly(calc.total))} • Escrow at EmpowerBank • BDC Bulawayo fulfillment</div></div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs"><div className="font-bold flex items-center gap-1"><AlertTriangle size={12}/> If car sells while you save?</div><div className="mt-1 text-zinc-700">We auto-match 3 similar cars same price. You switch free, no penalty. Or cancel with 7% penalty split 40% Bank (2.8% of saved), 40% BeAhead (2.8%), 20% BDC (1.4% of saved).</div></div>
                <div className="bg-zinc-900 text-white rounded-xl p-4 text-xs"><div className="font-bold">Tripartite Escrow Agreement</div><div className="mt-1 text-zinc-300">I authorize EmpowerBank to hold funds in account {profile?.bank_account_number} and only release to BeForward invoice with BeAhead Ref Code BEAHEAD-ZW-{selectedCar.beforward_ref}. I understand 7% penalty on cancellation. BeAhead never holds money. Bank keeps float interest.</div></div>
                <div className="flex gap-3"><button onClick={()=>setShowAgreement(false)} className="flex-1 bg-white border border-zinc-300 py-3 rounded-full font-semibold">Cancel</button><button onClick={createGoal} className="flex-1 bg-black text-white py-3 rounded-full font-semibold">Sign & Create Escrow Goal</button></div>
              </div>
            )})()}
          </div>
        </div>
      )}

      <footer className="border-t border-zinc-200 mt-16 py-8 text-center text-xs text-zinc-500">
        BeAhead (Pvt) Ltd • Save Small Drive Big • Escrow Partner: EmpowerBank Microfinance • Fulfillment: BDC Zimbabwe (Pvt) Ltd - Thuthuka Mall Shop F4 Bulawayo • BeForward Official Savings Agent (Proposed) • RBZ Compliant - BeAhead never holds client funds • Pilot: 25 clients target
      </footer>
    </div>
  )
}
