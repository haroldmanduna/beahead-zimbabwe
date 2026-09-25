import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { calculateLandedCost, calculateMonthly, formatUSD } from './utils/calculations'
import { ArrowRight, Shield, Wallet, Car, Clock, Plus, LogOut, X, Check, Calculator, Map, FileCheck, Package, Ship, Users, DollarSign, TrendingUp, Eye, Trash2, UserPlus, Lock, BarChart3, Settings } from 'lucide-react'

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [view, setView] = useState('landing')
  const [goals, setGoals] = useState([])
  const [deposits, setDeposits] = useState([])
  const [selectedCar, setSelectedCar] = useState(null)
  const [showNewCar, setShowNewCar] = useState(false)
  const [showAgreement, setShowAgreement] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [showFreight, setShowFreight] = useState(false)
  const [loading, setLoading] = useState(true)
  const [authForm, setAuthForm] = useState({ email: '', password: '', fullName: '', phone: '' })
  const [newCarForm, setNewCarForm] = useState({ make: '', model: '', year: '', price: '', url: '', mileage: '', engine: '' })
  const [dutyCalc, setDutyCalc] = useState({ price: '3250', engine: '1500', year: '2015' })
  const [checklist, setChecklist] = useState({ invoice: false, id: false, proof: false, zimra: false, license: false })
  const [freightGroups, setFreightGroups] = useState([
    { id: '1', make: 'Toyota', model: 'Aqua', members: 2, freightTotal: 1150, route: 'Japan → Durban → Bulawayo', leaving: '15 Oct 2026', spaces: 1, membersList: ['BA-123456', 'BA-789012'] },
    { id: '2', make: 'Honda', model: 'Fit', members: 1, freightTotal: 1150, route: 'Japan → Dar es Salaam → Bulawayo', leaving: '22 Oct 2026', spaces: 2, membersList: ['BA-345678'] },
  ])
  const [joinedGroups, setJoinedGroups] = useState([])

  // Admin states
  const [adminUser, setAdminUser] = useState(null)
  const [adminLoginForm, setAdminLoginForm] = useState({ username: '', password: '' })
  const [adminTab, setAdminTab] = useState('overview')
  const [adminData, setAdminData] = useState({ profiles: [], goals: [], deposits: [], cars: [], admins: [] })
  const [adminsList, setAdminsList] = useState([])
  const [newAdminForm, setNewAdminForm] = useState({ username: '', password: '', role: 'admin' })
  const [showNewFreightGroup, setShowNewFreightGroup] = useState(false)
  const [newFreightForm, setNewFreightForm] = useState({ make: '', model: '', route: 'Japan → Durban → Bulawayo', leaving: '', freightTotal: 1150 })

  useEffect(() => {
    init()
    // Check if admin route
    if (window.location.pathname.startsWith('/admin')) {
      setView('adminLogin')
    }
    // Load admins from localStorage
    const stored = localStorage.getItem('beahead_admins_v2')
    if (stored) {
      try { setAdminsList(JSON.parse(stored)) } catch {}
    }
  }, [])

  const init = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      setUser(session.user)
      await loadProfile(session.user.id)
      await loadData(session.user.id)
      if (!window.location.pathname.startsWith('/admin')) {
        setView('dashboard')
      }
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
    const { data } = await supabase.from('beahead_cars').insert(carData).select().single()
    if (data) {
      setSelectedCar(data)
      setShowNewCar(false)
      setShowAgreement(true)
    }
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
    const { data } = await supabase.from('beahead_goals').insert(goalData).select('*, beahead_cars(*)').single()
    if (data) setGoals([data, ...goals])
    setShowAgreement(false)
    setSelectedCar(null)
  }

  const handleJoinGroup = (group) => {
    if (joinedGroups.includes(group.id)) {
      alert('You already joined this container group. We will notify you when it is full.')
      return
    }
    const hasGoal = goals.some(g => g.beahead_cars?.make === group.make && g.beahead_cars?.model === group.model && g.status === 'active')
    if (!hasGoal && goals.length === 0) {
      alert(`To join the ${group.make} ${group.model} container, first add a ${group.make} ${group.model} to your savings plans. Then you can split freight $${group.freightTotal} with others.`)
      setShowNewCar(true)
      return
    }
    setJoinedGroups([...joinedGroups, group.id])
    setFreightGroups(freightGroups.map(g => g.id === group.id ? { ...g, members: g.members + 1, spaces: Math.max(0, g.spaces - 1), membersList: [...(g.membersList||[]), profile?.bank_account_number || 'YOU'] } : g))
    setShowFreight(true)
  }

  // Admin functions
  const handleAdminLogin = async (e) => {
    e.preventDefault()
    const { username, password } = adminLoginForm
    
    // Super admin hardcoded
    if (username === 'HaroldMilan' && password === '@Harold123$#') {
      setAdminUser({ username: 'HaroldMilan', role: 'superadmin' })
      setView('admin')
      localStorage.setItem('beahead_admin_session', JSON.stringify({ username: 'HaroldMilan', role: 'superadmin' }))
      await loadAdminData()
      window.history.pushState({}, '', '/admin')
      return
    }

    // Check other admins from localStorage
    const found = adminsList.find(a => a.username === username && a.password === password)
    if (found) {
      setAdminUser(found)
      setView('admin')
      localStorage.setItem('beahead_admin_session', JSON.stringify(found))
      await loadAdminData()
      window.history.pushState({}, '', '/admin')
      return
    }

    alert('Invalid admin credentials')
  }

  const loadAdminData = async () => {
    try {
      const [profilesRes, goalsRes, depositsRes, carsRes] = await Promise.all([
        supabase.from('beahead_profiles').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('beahead_goals').select('*, beahead_cars(*)').order('created_at', { ascending: false }).limit(200),
        supabase.from('beahead_deposits').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('beahead_cars').select('*').order('created_at', { ascending: false }).limit(200),
      ])

      // Try admins table if exists
      let adminsFromDb = []
      try {
        const { data } = await supabase.from('beahead_admins').select('*').order('created_at', { ascending: false })
        if (data) adminsFromDb = data
      } catch {}

      const allAdmins = [...adminsList]
      adminsFromDb.forEach(a => {
        if (!allAdmins.find(c => c.username === a.username)) allAdmins.push(a)
      })

      setAdminData({
        profiles: profilesRes.data || [],
        goals: goalsRes.data || [],
        deposits: depositsRes.data || [],
        cars: carsRes.data || [],
        admins: allAdmins
      })
      if (allAdmins.length > adminsList.length) {
        setAdminsList(allAdmins)
        localStorage.setItem('beahead_admins_v2', JSON.stringify(allAdmins))
      }
    } catch (err) {
      console.log('Admin load error', err)
    }
  }

  const handleAddAdmin = async (e) => {
    e.preventDefault()
    if (adminUser?.role !== 'superadmin') {
      alert('Only super admin can add admins')
      return
    }
    if (!newAdminForm.username || !newAdminForm.password) {
      alert('Username and password required')
      return
    }
    if (adminsList.find(a => a.username === newAdminForm.username)) {
      alert('Username already exists')
      return
    }

    const newAdmin = {
      id: Date.now().toString(),
      username: newAdminForm.username,
      password: newAdminForm.password,
      role: newAdminForm.role,
      created_at: new Date().toISOString()
    }

    // Try to save to Supabase
    try {
      const { data, error } = await supabase.from('beahead_admins').insert({
        username: newAdmin.username,
        password: newAdmin.password,
        role: newAdmin.role
      }).select().single()
      if (!error && data) {
        newAdmin.id = data.id
      }
    } catch {}

    const updated = [...adminsList, newAdmin]
    setAdminsList(updated)
    localStorage.setItem('beahead_admins_v2', JSON.stringify(updated))
    setAdminData({ ...adminData, admins: updated })
    setNewAdminForm({ username: '', password: '', role: 'admin' })
    alert(`Admin ${newAdmin.username} added successfully`)
  }

  const handleDeleteAdmin = async (adminToDelete) => {
    if (adminUser?.role !== 'superadmin') {
      alert('Only super admin can delete admins')
      return
    }
    if (adminToDelete.username === 'HaroldMilan') {
      alert('Cannot delete super admin')
      return
    }
    if (!confirm(`Delete admin ${adminToDelete.username}?`)) return

    try {
      await supabase.from('beahead_admins').delete().eq('username', adminToDelete.username)
    } catch {}

    const updated = adminsList.filter(a => a.username !== adminToDelete.username)
    setAdminsList(updated)
    localStorage.setItem('beahead_admins_v2', JSON.stringify(updated))
    setAdminData({ ...adminData, admins: updated })
  }

  const handleAdminLogout = () => {
    setAdminUser(null)
    localStorage.removeItem('beahead_admin_session')
    setView('landing')
    window.history.pushState({}, '', '/')
  }

  const handleCreateFreightGroup = (e) => {
    e.preventDefault()
    const newGroup = {
      id: Date.now().toString(),
      make: newFreightForm.make,
      model: newFreightForm.model,
      members: 0,
      freightTotal: parseInt(newFreightForm.freightTotal),
      route: newFreightForm.route,
      leaving: newFreightForm.leaving,
      spaces: 3,
      membersList: []
    }
    setFreightGroups([newGroup, ...freightGroups])
    setShowNewFreightGroup(false)
    setNewFreightForm({ make: '', model: '', route: 'Japan → Durban → Bulawayo', leaving: '', freightTotal: 1150 })
  }

  const dutyResult = (() => {
    const price = parseFloat(dutyCalc.price) || 0
    const engine = parseInt(dutyCalc.engine) || 1500
    const year = parseInt(dutyCalc.year) || 2015
    const age = new Date().getFullYear() - year
    let rate = 0.5
    if (engine <= 1000) rate = 0.45
    else if (engine <= 1500) rate = 0.55
    else if (engine <= 2000) rate = 0.65
    else rate = 0.75
    if (age > 5) rate += 0.15
    if (age > 10) rate += 0.20
    const duty = price * rate
    const total = price + 1150 + duty + 350 + (price * 0.03)
    return { rate: Math.round(rate*100), duty: Math.round(duty), total: Math.round(total) }
  })()

  if (loading) return (
    <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  // Admin Login View
  if (view === 'adminLogin') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;500&display=swap');`}</style>
        <div className="w-full max-w-[380px]">
          <div className="text-center mb-8">
            <img src="/logo.png" className="w-10 h-10 rounded-[10px] mx-auto mb-4"/>
            <h1 className="font-['Fraunces'] text-[24px] font-[600]">BeAhead Admin</h1>
            <p className="text-[12px] text-zinc-400 mt-1">Super admin access only</p>
          </div>
          <form onSubmit={handleAdminLogin} className="bg-zinc-900 border border-zinc-800 rounded-[16px] p-6 space-y-4">
            <div>
              <label className="text-[11px] text-zinc-400">Username</label>
              <input value={adminLoginForm.username} onChange={e=>setAdminLoginForm({...adminLoginForm, username:e.target.value})} placeholder="HaroldMilan" className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-full px-4 py-3 text-[13px] focus:outline-none focus:border-white text-white"/>
            </div>
            <div>
              <label className="text-[11px] text-zinc-400">Password</label>
              <input type="password" value={adminLoginForm.password} onChange={e=>setAdminLoginForm({...adminLoginForm, password:e.target.value})} placeholder="••••••••" className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-full px-4 py-3 text-[13px] focus:outline-none focus:border-white text-white"/>
            </div>
            <button type="submit" className="w-full bg-white text-zinc-900 py-3 rounded-full text-[13px] font-medium hover:bg-zinc-100">Login to dashboard</button>
            <div className="text-[10px] text-zinc-500 text-center">Super admin: HaroldMilan / @Harold123$#</div>
          </form>
          <div className="mt-6 text-center"><a href="/" className="text-[11px] text-zinc-500 hover:text-zinc-300">← Back to site</a></div>
        </div>
      </div>
    )
  }

  // Admin Dashboard View
  if (view === 'admin') {
    const totalSaved = adminData.goals.reduce((sum,g)=>sum+(g.saved_amount_usd||0),0)
    const totalGoal = adminData.goals.reduce((sum,g)=>sum+(g.goal_amount_usd||0),0)
    
    return (
      <div className="min-h-screen bg-[#fafaf9] text-zinc-900">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;500;600&display=swap');`}</style>
        <header className="sticky top-0 z-40 bg-white border-b border-zinc-200">
          <div className="max-w-[1280px] mx-auto px-6 h-[60px] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" className="w-7 h-7 rounded-[8px]"/>
              <span className="font-semibold text-[14px]">BeAhead Admin</span>
              <span className="text-[10px] bg-zinc-900 text-white px-2 py-0.5 rounded-full">{adminUser?.role === 'superadmin' ? 'SUPER ADMIN' : 'ADMIN'}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-zinc-500 hidden sm:block">{adminUser?.username}</span>
              <button onClick={handleAdminLogout} className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center"><LogOut size={13}/></button>
            </div>
          </div>
        </header>

        <div className="max-w-[1280px] mx-auto px-6 py-6">
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'users', label: `Users (${adminData.profiles.length})`, icon: Users },
              { id: 'goals', label: `Goals (${adminData.goals.length})`, icon: TrendingUp },
              { id: 'cars', label: `Cars (${adminData.cars.length})`, icon: Car },
              { id: 'freight', label: `Freight (${freightGroups.length})`, icon: Ship },
              { id: 'admins', label: `Admins (${adminsList.length + 1})`, icon: Settings },
            ].map(tab=>(
              <button key={tab.id} onClick={()=>setAdminTab(tab.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-medium whitespace-nowrap transition ${adminTab===tab.id ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 hover:border-zinc-300'}`}>
                <tab.icon size={12}/> {tab.label}
              </button>
            ))}
          </div>

          {adminTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white border border-zinc-200 rounded-[16px] p-4"><div className="text-[10px] text-zinc-500">Total users</div><div className="text-[22px] font-semibold mt-1">{adminData.profiles.length}</div><div className="text-[10px] text-zinc-400 mt-1">Registered accounts</div></div>
                <div className="bg-white border border-zinc-200 rounded-[16px] p-4"><div className="text-[10px] text-zinc-500">Total goals</div><div className="text-[22px] font-semibold mt-1">{adminData.goals.length}</div><div className="text-[10px] text-zinc-400 mt-1">{adminData.goals.filter(g=>g.status==='active').length} active</div></div>
                <div className="bg-zinc-900 text-white rounded-[16px] p-4"><div className="text-[10px] text-zinc-400">Total saved (in banks)</div><div className="text-[22px] font-semibold mt-1">{formatUSD(totalSaved)}</div><div className="text-[10px] text-zinc-400 mt-1">Goal {formatUSD(totalGoal)}</div></div>
                <div className="bg-white border border-zinc-200 rounded-[16px] p-4"><div className="text-[10px] text-zinc-500">Freight groups</div><div className="text-[22px] font-semibold mt-1">{freightGroups.length}</div><div className="text-[10px] text-zinc-400 mt-1">{freightGroups.reduce((s,g)=>s+g.members,0)} members sharing</div></div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white border border-zinc-200 rounded-[16px] p-5">
                  <div className="font-medium text-[13px] mb-3">Recent goals</div>
                  <div className="space-y-2">
                    {adminData.goals.slice(0,5).map(g=>(
                      <div key={g.id} className="flex justify-between items-center py-2 border-b border-zinc-100 last:border-0">
                        <div><div className="text-[11px] font-medium">{g.beahead_cars?.make} {g.beahead_cars?.model} {g.beahead_cars?.year}</div><div className="text-[10px] text-zinc-500">{g.beahead_profiles?.full_name || g.user_id?.slice(0,8)} • {g.escrow_account_number}</div></div>
                        <div className="text-right"><div className="text-[11px] font-medium">{formatUSD(g.saved_amount_usd||0)}/{formatUSD(g.goal_amount_usd)}</div><div className="text-[10px] text-zinc-500">{g.status}</div></div>
                      </div>
                    ))}
                    {adminData.goals.length===0 && <div className="text-[11px] text-zinc-500 py-4 text-center">No goals yet</div>}
                  </div>
                </div>
                <div className="bg-white border border-zinc-200 rounded-[16px] p-5">
                  <div className="font-medium text-[13px] mb-3">Recent users</div>
                  <div className="space-y-2">
                    {adminData.profiles.slice(0,5).map(p=>(
                      <div key={p.id} className="flex justify-between items-center py-2 border-b border-zinc-100 last:border-0">
                        <div><div className="text-[11px] font-medium">{p.full_name || 'No name'}</div><div className="text-[10px] text-zinc-500">{p.email}</div></div>
                        <div className="text-[10px] font-mono bg-zinc-100 px-2 py-1 rounded-full">{p.bank_account_number}</div>
                      </div>
                    ))}
                    {adminData.profiles.length===0 && <div className="text-[11px] text-zinc-500 py-4 text-center">No users yet</div>}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-[16px] p-5">
                <div className="font-medium text-[13px] mb-3">Freight splitting overview</div>
                <div className="grid md:grid-cols-2 gap-3">
                  {freightGroups.map(g=>(
                    <div key={g.id} className="border border-zinc-200 rounded-[12px] p-3">
                      <div className="flex justify-between"><span className="text-[11px] font-medium">{g.make} {g.model} • {g.route}</span><span className="text-[10px] bg-zinc-100 px-2 py-0.5 rounded-full">{g.members}/3 joined</span></div>
                      <div className="text-[10px] text-zinc-500 mt-1">Leaves {g.leaving} • Members: {g.membersList?.join(', ') || 'None'}</div>
                      <div className="text-[10px] mt-1">Save: ${g.freightTotal - Math.round(g.freightTotal/(g.members||1))} per person if full</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {adminTab === 'users' && (
            <div className="bg-white border border-zinc-200 rounded-[16px] overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center"><div className="font-medium text-[13px]">All users</div><button onClick={loadAdminData} className="text-[11px] bg-zinc-100 px-3 py-1 rounded-full">Refresh</button></div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-zinc-50 text-[10px] text-zinc-500"><tr><th className="text-left p-3 font-medium">Name</th><th className="text-left p-3 font-medium">Email</th><th className="text-left p-3 font-medium">Phone</th><th className="text-left p-3 font-medium">Ref</th><th className="text-left p-3 font-medium">Joined</th></tr></thead>
                  <tbody>
                    {adminData.profiles.map(p=>(
                      <tr key={p.id} className="border-t border-zinc-100 hover:bg-zinc-50"><td className="p-3 font-medium">{p.full_name||'-'}</td><td className="p-3 text-zinc-600">{p.email}</td><td className="p-3">{p.phone||'-'}</td><td className="p-3 font-mono">{p.bank_account_number}</td><td className="p-3 text-zinc-500">{new Date(p.created_at).toLocaleDateString()}</td></tr>
                    ))}
                  </tbody>
                </table>
                {adminData.profiles.length===0 && <div className="p-8 text-center text-[11px] text-zinc-500">No users found. Check RLS policies in Supabase.</div>}
              </div>
            </div>
          )}

          {adminTab === 'goals' && (
            <div className="bg-white border border-zinc-200 rounded-[16px] overflow-hidden">
              <div className="p-4 border-b font-medium text-[13px]">All savings goals</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-zinc-50 text-[10px] text-zinc-500"><tr><th className="text-left p-3">User</th><th className="text-left p-3">Car</th><th className="text-left p-3">Goal</th><th className="text-left p-3">Saved</th><th className="text-left p-3">Progress</th><th className="text-left p-3">Ref</th><th className="text-left p-3">Status</th></tr></thead>
                  <tbody>
                    {adminData.goals.map(g=>(
                      <tr key={g.id} className="border-t border-zinc-100 hover:bg-zinc-50"><td className="p-3">{g.beahead_profiles?.full_name||g.user_id.slice(0,8)}</td><td className="p-3 font-medium">{g.beahead_cars?.make} {g.beahead_cars?.model} {g.beahead_cars?.year}</td><td className="p-3">{formatUSD(g.goal_amount_usd)}</td><td className="p-3">{formatUSD(g.saved_amount_usd||0)}</td><td className="p-3"><div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden"><div className="h-full bg-zinc-900" style={{width:`${g.progress_percent||0}%`}}></div></div></td><td className="p-3 font-mono text-[10px]">{g.escrow_account_number}</td><td className="p-3"><span className="text-[10px] bg-zinc-900 text-white px-2 py-0.5 rounded-full">{g.status}</span></td></tr>
                    ))}
                  </tbody>
                </table>
                {adminData.goals.length===0 && <div className="p-8 text-center text-[11px] text-zinc-500">No goals yet</div>}
              </div>
            </div>
          )}

          {adminTab === 'cars' && (
            <div className="bg-white border border-zinc-200 rounded-[16px] overflow-hidden">
              <div className="p-4 border-b font-medium text-[13px]">All cars</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-zinc-50 text-[10px] text-zinc-500"><tr><th className="text-left p-3">Make/Model</th><th className="text-left p-3">Year</th><th className="text-left p-3">Price</th><th className="text-left p-3">Engine</th><th className="text-left p-3">Ref</th><th className="text-left p-3">Status</th></tr></thead>
                  <tbody>
                    {adminData.cars.map(c=>(
                      <tr key={c.id} className="border-t border-zinc-100"><td className="p-3 font-medium">{c.make} {c.model}</td><td className="p-3">{c.year}</td><td className="p-3">{formatUSD(c.price_usd)}</td><td className="p-3">{c.engine_cc}cc</td><td className="p-3 font-mono text-[10px]">{c.beforward_ref}</td><td className="p-3">{c.status}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {adminTab === 'freight' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center"><div className="font-medium text-[13px]">Freight groups — container sharing</div><button onClick={()=>setShowNewFreightGroup(true)} className="bg-zinc-900 text-white px-4 py-2 rounded-full text-[11px] flex items-center gap-1"><Plus size={12}/> New group</button></div>
              <div className="grid md:grid-cols-2 gap-3">
                {freightGroups.map(g=>(
                  <div key={g.id} className="bg-white border border-zinc-200 rounded-[16px] p-4">
                    <div className="flex justify-between items-start"><div><div className="font-medium text-[12px]">{g.make} {g.model} Container</div><div className="text-[10px] text-zinc-500">{g.route} • Leaves {g.leaving}</div></div><span className="text-[10px] bg-zinc-100 px-2 py-1 rounded-full">{g.members}/3 • {g.spaces} spaces</span></div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                      <div className="bg-zinc-50 rounded-[8px] p-2"><div className="text-[9px] text-zinc-500">Total freight</div><div className="font-medium">${g.freightTotal}</div></div>
                      <div className="bg-zinc-50 rounded-[8px] p-2"><div className="text-[9px] text-zinc-500">Per person</div><div className="font-medium">${Math.round(g.freightTotal/Math.max(1,g.members))}</div></div>
                      <div className="bg-zinc-900 text-white rounded-[8px] p-2"><div className="text-[9px] text-zinc-400">Save each</div><div className="font-medium">${g.freightTotal - Math.round(g.freightTotal/Math.max(1,g.members))}</div></div>
                    </div>
                    <div className="mt-3 text-[10px] text-zinc-500">Members: {g.membersList?.join(', ') || 'None yet'}</div>
                    <button onClick={()=>{ setFreightGroups(freightGroups.filter(f=>f.id!==g.id)) }} className="mt-3 text-[10px] text-red-600 flex items-center gap-1"><Trash2 size={10}/> Delete group</button>
                  </div>
                ))}
              </div>
              {showNewFreightGroup && (
                <div className="fixed inset-0 bg-zinc-900/20 backdrop-blur-[10px] z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-[16px] max-w-[400px] w-full p-5">
                    <div className="flex justify-between items-center mb-4"><div className="font-medium text-[13px]">New freight group</div><button onClick={()=>setShowNewFreightGroup(false)} className="w-6 h-6 bg-zinc-100 rounded-full flex items-center justify-center"><X size={12}/></button></div>
                    <form onSubmit={handleCreateFreightGroup} className="space-y-3">
                      <div className="grid grid-cols-2 gap-2"><input placeholder="Make Toyota" value={newFreightForm.make} onChange={e=>setNewFreightForm({...newFreightForm, make:e.target.value})} className="bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2 text-[11px]" required/><input placeholder="Model Aqua" value={newFreightForm.model} onChange={e=>setNewFreightForm({...newFreightForm, model:e.target.value})} className="bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2 text-[11px]" required/></div>
                      <input placeholder="Route" value={newFreightForm.route} onChange={e=>setNewFreightForm({...newFreightForm, route:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2 text-[11px]"/>
                      <div className="grid grid-cols-2 gap-2"><input placeholder="Leaving date" value={newFreightForm.leaving} onChange={e=>setNewFreightForm({...newFreightForm, leaving:e.target.value})} className="bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2 text-[11px]" required/><input type="number" placeholder="Freight total" value={newFreightForm.freightTotal} onChange={e=>setNewFreightForm({...newFreightForm, freightTotal:e.target.value})} className="bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2 text-[11px]"/></div>
                      <button type="submit" className="w-full bg-zinc-900 text-white py-2.5 rounded-full text-[11px]">Create group</button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {adminTab === 'admins' && (
            <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-4">
              <div className="bg-white border border-zinc-200 rounded-[16px] overflow-hidden">
                <div className="p-4 border-b font-medium text-[13px]">Admins — who can track everything</div>
                <div className="divide-y divide-zinc-100">
                  <div className="p-4 flex justify-between items-center bg-amber-50">
                    <div><div className="font-medium text-[12px] flex items-center gap-1.5"><Lock size={12}/> HaroldMilan (You)</div><div className="text-[10px] text-zinc-600">Super admin • Can add/delete admins • Full access</div></div>
                    <span className="text-[10px] bg-zinc-900 text-white px-2 py-1 rounded-full">SUPER</span>
                  </div>
                  {adminsList.map(a=>(
                    <div key={a.id} className="p-4 flex justify-between items-center">
                      <div><div className="font-medium text-[12px]">{a.username}</div><div className="text-[10px] text-zinc-500">{a.role} • Created {new Date(a.created_at).toLocaleDateString()}</div></div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-zinc-100 px-2 py-1 rounded-full">{a.role}</span>
                        {adminUser?.role==='superadmin' && <button onClick={()=>handleDeleteAdmin(a)} className="w-6 h-6 bg-red-50 text-red-600 rounded-full flex items-center justify-center"><Trash2 size={10}/></button>}
                      </div>
                    </div>
                  ))}
                  {adminsList.length===0 && <div className="p-6 text-center text-[11px] text-zinc-500">No other admins yet. Add one →</div>}
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-[16px] p-5">
                <div className="font-medium text-[13px] flex items-center gap-1.5"><UserPlus size={14}/> Add new admin</div>
                <div className="text-[11px] text-zinc-500 mt-1">Only super admin can add. New admin can track everything but cannot delete others.</div>
                {adminUser?.role !== 'superadmin' ? (
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-[10px] p-3 text-[11px]">Only HaroldMilan super admin can add admins.</div>
                ) : (
                  <form onSubmit={handleAddAdmin} className="mt-4 space-y-3">
                    <div><label className="text-[10px] text-zinc-500">Username</label><input value={newAdminForm.username} onChange={e=>setNewAdminForm({...newAdminForm, username:e.target.value})} placeholder="e.g. Tawanda" className="w-full mt-1 bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2.5 text-[11px] focus:outline-none focus:border-zinc-900"/></div>
                    <div><label className="text-[10px] text-zinc-500">Password</label><input type="text" value={newAdminForm.password} onChange={e=>setNewAdminForm({...newAdminForm, password:e.target.value})} placeholder="Set password" className="w-full mt-1 bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2.5 text-[11px] focus:outline-none focus:border-zinc-900"/></div>
                    <div><label className="text-[10px] text-zinc-500">Role</label><select value={newAdminForm.role} onChange={e=>setNewAdminForm({...newAdminForm, role:e.target.value})} className="w-full mt-1 bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2.5 text-[11px]"><option value="admin">Admin — track everything</option><option value="viewer">Viewer — view only</option></select></div>
                    <button type="submit" className="w-full bg-zinc-900 text-white py-3 rounded-full text-[11px] font-medium">Add admin</button>
                    <div className="text-[10px] text-zinc-500">Admin will login at /admin with this username/password</div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

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
                  Paste any car from BeForward.jp. We show the full cost to get it to Zimbabwe. Save small amounts monthly in your own bank account. Import when you're ready.
                </p>
                <div className="mt-7 flex gap-3">
                  <button onClick={() => setView('auth')} className="bg-zinc-900 text-white px-6 py-3 rounded-full text-[13px] font-medium flex items-center gap-2 hover:bg-black transition">
                    Start your plan <ArrowRight size={15}/>
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
                </div>
                <div className="p-3.5 flex items-center gap-2 text-[11px] text-zinc-600"><div className="w-6 h-6 bg-zinc-100 rounded-full flex items-center justify-center"><Car size={12}/></div> Toyota Aqua 2015 • Your savings plan</div>
              </div>
            </div>
          </section>

          <section className="max-w-[1120px] mx-auto px-6 pb-10">
            <div className="bg-zinc-900 rounded-[24px] p-7 md:p-10 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[360px] h-[360px] bg-white/[0.04] rounded-full blur-[70px] -translate-y-1/2 translate-x-1/3"></div>
              <div className="relative grid md:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
                <div>
                  <div className="inline-flex bg-white/10 border border-white/10 rounded-full px-3 py-1 text-[10px] tracking-widest mb-4">TRANSPARENT PRICING</div>
                  <h3 className="font-['Fraunces'] text-[26px] leading-[0.95]">No hidden fees.<br/>Everything upfront.</h3>
                  <p className="text-[13px] leading-[1.6] text-zinc-400 mt-3 max-w-[360px]">Car price, freight, duty, clearing and our small service fee — calculated before you save a dollar.</p>
                </div>
                <div className="bg-white rounded-[18px] p-5 text-zinc-900">
                  <div className="text-[10px] tracking-widest text-zinc-500 font-medium">EXAMPLE • TOYOTA AQUA 2015</div>
                  <div className="mt-3 space-y-2 text-[12px]">
                    <div className="flex justify-between"><span className="text-zinc-500">Car price</span><span className="font-medium">$3,250</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Freight Japan → Durban</span><span className="font-medium">$1,150</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">ZIMRA duty est.</span><span className="font-medium">$1,787</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Clearing & delivery</span><span className="font-medium">$350</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Service fee</span><span className="font-medium">$150</span></div>
                    <div className="h-px bg-zinc-100 my-2"></div>
                    <div className="flex justify-between font-semibold"><span>Total to own</span><span>$6,687</span></div>
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

          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-5">
            <div className="space-y-5">
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
                      <div key={goal.id} className="bg-white border border-zinc-200 rounded-[16px] p-5">
                        <div className="flex justify-between"><div><div className="font-medium text-[12px]">{goal.beahead_cars?.make} {goal.beahead_cars?.model} {goal.beahead_cars?.year}</div><div className="text-[10px] text-zinc-500">{formatUSD(goal.goal_amount_usd)} total • Ref: {goal.escrow_account_number}</div></div><span className="text-[10px] px-2 py-1 rounded-full bg-zinc-900 text-white">{goal.status}</span></div>
                        <div className="mt-3"><div className="flex justify-between text-[10px] mb-1"><span className="text-zinc-500">{formatUSD(goal.saved_amount_usd||0)} saved in your bank</span><span className="font-medium">{Math.round(goal.progress_percent||0)}%</span></div><div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden"><div className="h-full bg-zinc-900 rounded-full" style={{width:`${Math.min(100, goal.progress_percent||0)}%`}}></div></div></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-zinc-200 rounded-[16px] p-5">
                <div className="font-medium text-[13px] flex items-center gap-1.5"><Calculator size={14}/> Duty calculator</div>
                <div className="text-[11px] text-zinc-500 mt-1">Real ZIMRA rates by engine CC & age</div>
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div><div className="text-[10px] text-zinc-500 mb-1">Price USD</div><input type="number" value={dutyCalc.price} onChange={e=>setDutyCalc({...dutyCalc, price:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2 text-[11px] focus:outline-none focus:border-zinc-900"/></div>
                    <div><div className="text-[10px] text-zinc-500 mb-1">Engine CC</div><input type="number" value={dutyCalc.engine} onChange={e=>setDutyCalc({...dutyCalc, engine:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2 text-[11px] focus:outline-none focus:border-zinc-900"/></div>
                    <div><div className="text-[10px] text-zinc-500 mb-1">Year</div><input type="number" value={dutyCalc.year} onChange={e=>setDutyCalc({...dutyCalc, year:e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2 text-[11px] focus:outline-none focus:border-zinc-900"/></div>
                  </div>
                  <div className="bg-zinc-900 text-white rounded-[12px] p-3">
                    <div className="flex justify-between text-[11px]"><span className="text-zinc-400">Duty rate</span><span className="font-medium">{dutyResult.rate}%</span></div>
                    <div className="flex justify-between text-[11px] mt-1"><span className="text-zinc-400">Duty amount</span><span className="font-medium">{formatUSD(dutyResult.duty)}</span></div>
                    <div className="flex justify-between text-[12px] font-semibold mt-2 pt-2 border-t border-white/10"><span>Total landed</span><span>{formatUSD(dutyResult.total)}</span></div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-[16px] p-5">
                <div className="font-medium text-[13px] flex items-center gap-1.5"><Map size={14}/> Import timeline</div>
                <div className="mt-4 relative">
                  <div className="absolute left-[11px] top-2 bottom-2 w-px bg-zinc-200"></div>
                  {[
                    { title: 'Japan - Purchase', desc: 'Car bought, documents prepared', time: 'Day 1-3', done: (goals[0]?.progress_percent||0) >= 100 },
                    { title: 'Shipping to Durban', desc: 'Container ship Japan → Durban', time: '3-5 weeks', done: false },
                    { title: 'Clearing at Beitbridge', desc: 'ZIMRA duty, inspection', time: '2-4 days', done: false },
                    { title: 'Delivery to Bulawayo', desc: 'Driver to your door', time: '1-2 days', done: false },
                  ].map((step,i)=>(
                    <div key={i} className="relative flex gap-3 pb-5 last:pb-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${step.done ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-300'}`}>{step.done ? <Check size={12}/> : <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full"></span>}</div>
                      <div className="flex-1 -mt-0.5"><div className="flex justify-between"><span className="text-[12px] font-medium">{step.title}</span><span className="text-[10px] text-zinc-500">{step.time}</span></div><div className="text-[11px] text-zinc-500 mt-0.5">{step.desc}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white border border-zinc-200 rounded-[16px] p-5">
                <div className="font-medium text-[13px] flex items-center gap-1.5"><FileCheck size={14}/> Document checklist</div>
                <div className="text-[11px] text-zinc-500 mt-1">Don't get stuck at Beitbridge</div>
                <div className="mt-3 space-y-2">
                  {[
                    { key: 'invoice', label: 'Proforma invoice', desc: 'From BeForward with chassis' },
                    { key: 'id', label: 'National ID + Passport', desc: 'Certified copies' },
                    { key: 'proof', label: 'Proof of address', desc: 'Utility bill <3 months' },
                    { key: 'zimra', label: 'ZIMRA forms', desc: 'Form 49 + duty proof' },
                    { key: 'license', label: 'License + insurance', desc: 'For collection' },
                  ].map(item=>(
                    <label key={item.key} className="flex gap-2.5 p-2.5 rounded-[10px] hover:bg-zinc-50 cursor-pointer border border-transparent hover:border-zinc-100">
                      <input type="checkbox" checked={checklist[item.key]} onChange={e=>setChecklist({...checklist, [item.key]: e.target.checked})} className="mt-0.5 rounded"/>
                      <div className="flex-1"><div className="text-[11px] font-medium flex items-center gap-1.5">{item.label} {checklist[item.key] && <Check size={10} className="text-green-600"/>}</div><div className="text-[10px] text-zinc-500">{item.desc}</div></div>
                    </label>
                  ))}
                  <div className="mt-2 bg-zinc-100 rounded-full h-1.5 overflow-hidden"><div className="h-full bg-zinc-900 transition-all" style={{width: `${Object.values(checklist).filter(Boolean).length/5*100}%`}}></div></div>
                  <div className="text-[10px] text-zinc-500 text-center">{Object.values(checklist).filter(Boolean).length}/5 ready</div>
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-[16px] p-5">
                <div className="font-medium text-[13px] flex items-center gap-1.5"><Package size={14}/> Freight splitting</div>
                <div className="text-[11px] text-zinc-500 mt-1">Share container, split $1,150 freight</div>
                <div className="mt-4 space-y-3">
                  {freightGroups.map(group=>{
                    const perPerson = Math.round(group.freightTotal / (group.members + (joinedGroups.includes(group.id) ? 1 : 0) || 1))
                    const isJoined = joinedGroups.includes(group.id)
                    return (
                      <div key={group.id} className="border border-zinc-200 rounded-[12px] p-3">
                        <div className="flex justify-between items-start">
                          <div><div className="font-medium text-[12px] flex items-center gap-1.5"><Ship size={12}/> {group.make} {group.model} Container</div><div className="text-[10px] text-zinc-500 mt-0.5">{group.route} • Leaves {group.leaving}</div></div>
                          <span className="text-[10px] bg-zinc-100 px-2 py-1 rounded-full">{group.spaces} spaces left</span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                          <div className="bg-zinc-50 rounded-[8px] p-2"><div className="text-[9px] text-zinc-500">Members</div><div className="font-medium">{group.members + (isJoined ? 1 : 0)}/3</div></div>
                          <div className="bg-zinc-50 rounded-[8px] p-2"><div className="text-[9px] text-zinc-500">Freight total</div><div className="font-medium">${group.freightTotal}</div></div>
                          <div className="bg-zinc-900 text-white rounded-[8px] p-2"><div className="text-[9px] text-zinc-400">You pay</div><div className="font-medium">${perPerson}</div></div>
                        </div>
                        <div className="mt-2 text-[10px] text-zinc-500">Save ${group.freightTotal - perPerson} by sharing • {group.membersList?.length ? `Joined: ${group.membersList.join(', ')}` : ''}</div>
                        <button onClick={()=>handleJoinGroup(group)} disabled={isJoined} className={`mt-3 w-full py-2 rounded-full text-[11px] font-medium transition ${isJoined ? 'bg-green-100 text-green-700' : 'bg-zinc-900 text-white hover:bg-black'}`}>
                          {isJoined ? '✓ Joined — We\'ll notify you' : `Join group → Split to $${perPerson} each`}
                        </button>
                      </div>
                    )
                  })}
                  <button onClick={()=>setShowFreight(true)} className="w-full text-[11px] font-medium underline py-2">How freight splitting works →</button>
                </div>
              </div>

              <div className="bg-zinc-900 text-white rounded-[16px] p-4">
                <div className="text-[11px] font-medium flex items-center gap-1.5"><Shield size={12}/> Where your money goes</div>
                <div className="text-[11px] leading-[1.5] text-zinc-400 mt-2">
                  We don't hold your money. You deposit directly into your own bank account using reference <span className="text-white font-mono">{profile?.bank_account_number || 'BA-XXXXXX'}</span>. We only track progress. Bank holds, verifies, releases to BeForward when ready.
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

      {showFreight && (
        <div className="fixed inset-0 bg-zinc-900/20 backdrop-blur-[10px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] max-w-[440px] w-full shadow-[0_20px_60px_-20px_rgba(0,0,0,0.3)]">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4"><div className="font-medium flex items-center gap-2"><Package size={16}/> Freight splitting explained</div><button onClick={()=>setShowFreight(false)} className="w-7 h-7 bg-zinc-100 rounded-full flex items-center justify-center"><X size={14}/></button></div>
              <div className="space-y-4 text-[12px] leading-[1.6] text-zinc-600">
                <p>One container from Japan to Durban costs <b className="text-zinc-900">$1,150</b> whether it has 1 car or 3 cars.</p>
                <div className="bg-zinc-50 rounded-[12px] p-4 grid grid-cols-3 gap-3 text-center">
                  <div><div className="text-[11px] text-zinc-500">1 person</div><div className="font-semibold">$1,150 each</div></div>
                  <div><div className="text-[11px] text-zinc-500">2 people</div><div className="font-semibold">$575 each</div></div>
                  <div className="bg-zinc-900 text-white rounded-[10px] p-2"><div className="text-[10px] text-zinc-400">3 people</div><div className="font-semibold">$383 each</div></div>
                </div>
                <p>When you join a group, we match you with others buying the same model (e.g., Toyota Aqua) leaving Japan around the same date. You save <b className="text-zinc-900">$575-$767</b> on freight.</p>
                <p className="text-[11px] bg-amber-50 border border-amber-200 rounded-[10px] p-3">✓ No extra fee to join. You only pay your split freight when your car is ready to ship. We handle container paperwork.</p>
                <button onClick={()=>setShowFreight(false)} className="w-full bg-zinc-900 text-white py-3 rounded-full text-[12px] font-medium">Got it, join a group</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTerms && (
        <div className="fixed inset-0 bg-zinc-900/30 backdrop-blur-[12px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] max-w-[560px] w-full max-h-[85vh] overflow-auto shadow-[0_20px_60px_-20px_rgba(0,0,0,0.3)]">
            <div className="p-7">
              <div className="flex justify-between items-start mb-6"><h2 className="font-['Fraunces'] text-[20px] font-[600]">Terms & Conditions</h2><button onClick={()=>setShowTerms(false)} className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center"><X size={14}/></button></div>
              <div className="space-y-4 text-[12px] leading-[1.6] text-zinc-600">
                <div><b className="text-zinc-900">1. What BeAhead is</b><br/>BeAhead is a technology platform that helps you save for a BeForward car. We are not a bank, we do not hold your money. Your money is held in your own bank account at a partner bank. We only track your progress.</div>
                <div><b className="text-zinc-900">2. Money handling</b><br/>You deposit directly into your bank account using reference BA-XXXXXX. Bank holds, verifies, and releases funds to BeForward Japan only when you authorize and have reached your goal. BeAhead never touches client funds.</div>
                <div><b className="text-zinc-900">3. Total cost</b><br/>Total includes: car price (from BeForward), freight Japan→Durban ($1,150 est.), ZIMRA duty estimate (45-75% based on engine CC and age), clearing & delivery ($350 est.), and BeAhead service fee ($150). Duty is estimate only — real ZIMRA may vary. We cover up to $200 if our estimate is low.</div>
                <div><b className="text-zinc-900">4. Cancellation</b><br/>You can cancel anytime. Early cancellation fee is 7% of amount saved in your bank, to cover bank admin and reservation costs. Example: saved $1,000 → fee $70 → you receive $930. Fee split: 40% bank, 40% BeAhead, 20% clearing partner.</div>
                <div><b className="text-zinc-900">5. Car availability</b><br/>BeForward cars sell fast. If your chosen car sells while you save, we will match you with 3 similar cars at same price range. You can switch free, no penalty.</div>
                <div><b className="text-zinc-900">6. Freight splitting</b><br/>Container freight $1,150 can be shared among up to 3 cars. If you join a group, you pay $575 (2 people) or $383 (3 people) each instead of $1,150. No extra fee to join. You pay split freight only when car ships.</div>
                <div><b className="text-zinc-900">7. Import</b><br/>We help with paperwork and coordinate clearing at Beitbridge and delivery to Bulawayo via vetted agents. Final import compliance is your responsibility. You must provide valid ID, proof of address, and ZIMRA forms.</div>
                <div><b className="text-zinc-900">8. Pilot phase</b><br/>We are currently in pilot in Bulawayo. No fake partnerships claimed. We are working to partner with a licensed bank for escrow and licensed clearing agents. Service fee is for technology and coordination only.</div>
                <div className="pt-4 border-t text-[10px] text-zinc-500">Last updated: Sep 2026 • BeAhead • Built in Bulawayo • Contact: via app support</div>
              </div>
              <button onClick={()=>setShowTerms(false)} className="mt-6 w-full bg-zinc-900 text-white py-3 rounded-full text-[12px] font-medium">I agree, close</button>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-zinc-200 mt-12">
        <div className="max-w-[1120px] mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between gap-3">
          <div className="flex items-center gap-2"><img src="/logo.png" className="w-5 h-5 rounded-[6px]"/><span className="font-medium text-[11px]">BeAhead</span><span className="text-[10px] text-zinc-500">• Bulawayo • Pilot phase</span></div>
          <div className="flex items-center gap-4 text-[11px]">
            <button onClick={()=>setShowTerms(true)} className="font-medium underline hover:text-zinc-900">Terms & Conditions</button>
            <span className="text-zinc-400">•</span>
            <a href="/admin" className="text-zinc-400 hover:text-zinc-600">Admin</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
