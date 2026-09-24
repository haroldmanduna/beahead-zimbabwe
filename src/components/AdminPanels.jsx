import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatUSD } from '../utils/calculations'

export function BankAdminPanel() {
  const [deposits, setDeposits] = useState([])
  const [goals, setGoals] = useState([])
  
  useEffect(() => {
    load()
  }, [])
  
  const load = async () => {
    const { data: dep } = await supabase.from('beahead_deposits').select('*, beahead_profiles(full_name), beahead_goals(goal_amount_usd, beahead_cars(make, model))').eq('verification_status','pending').order('created_at', {ascending: false}).limit(20)
    if (dep) setDeposits(dep)
    const { data: g } = await supabase.from('beahead_goals').select('*, beahead_profiles(full_name), beahead_cars(make, model)').order('created_at', {ascending: false}).limit(20)
    if (g) setGoals(g)
  }
  
  const verify = async (id) => {
    await supabase.from('beahead_deposits').update({ verification_status: 'verified', verified_at: new Date().toISOString() }).eq('id', id)
    load()
  }
  
  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-2xl p-6">
        <h3 className="font-bold">Bank Admin - Verify Deposits (EmpowerBank)</h3>
        <p className="text-sm text-zinc-500">You hold float interest. You get $5 per new account + 40% penalty (2.8% of saved)</p>
        <div className="mt-4 space-y-2">
          {deposits.map(d => (
            <div key={d.id} className="flex justify-between items-center border p-3 rounded-xl">
              <div><div className="font-semibold text-sm">{d.beahead_profiles?.full_name} - {formatUSD(d.amount_usd)} via {d.method}</div><div className="text-xs text-zinc-500">Ref: {d.reference_code} • Goal: {d.beahead_goals?.beahead_cars?.make} {d.beahead_goals?.beahead_cars?.model}</div></div>
              <button onClick={()=>verify(d.id)} className="bg-black text-white px-4 py-1.5 rounded-full text-xs">Verify</button>
            </div>
          ))}
          {deposits.length===0 && <div className="text-sm text-zinc-500 py-4">No pending deposits - all verified</div>}
        </div>
      </div>
      
      <div className="bg-white border rounded-2xl p-6">
        <h3 className="font-bold">Escrow Accounts (25 pilot target)</h3>
        <div className="mt-4 overflow-auto">
          <table className="w-full text-sm"><thead className="text-xs text-zinc-500"><tr><th className="text-left">User</th><th>Car</th><th>Saved</th><th>Goal</th><th>Progress</th></tr></thead>
          <tbody>{goals.map(g => <tr key={g.id} className="border-t"><td className="py-2">{g.beahead_profiles?.full_name}</td><td>{g.beahead_cars?.make} {g.beahead_cars?.model}</td><td>{formatUSD(g.saved_amount_usd)}</td><td>{formatUSD(g.goal_amount_usd)}</td><td>{Math.round(g.progress_percent||0)}%</td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  )
}

export function BeAheadAdminPanel() {
  const [commissions, setCommissions] = useState([])
  const [stats, setStats] = useState({ referrals: 0, sale: 0, penalty: 0 })
  
  useEffect(() => {
    load()
  }, [])
  
  const load = async () => {
    const { data } = await supabase.from('beahead_commissions').select('*, beahead_goals(beahead_cars(make, model))').order('created_at', {ascending: false}).limit(50)
    if (data) {
      setCommissions(data)
      setStats({
        referrals: data.filter(c=>c.type==='referral').reduce((s,c)=>s+c.amount_usd,0),
        sale: data.filter(c=>c.type==='sale_commission').reduce((s,c)=>s+c.amount_usd,0),
        penalty: data.filter(c=>c.type.includes('penalty')).reduce((s,c)=>s+c.amount_usd,0)
      })
    }
  }
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border rounded-2xl p-5"><div className="text-xs text-zinc-500">Referrals $5 each</div><div className="text-2xl font-black">{formatUSD(stats.referrals)}</div></div>
        <div className="bg-white border rounded-2xl p-5"><div className="text-xs text-zinc-500">Sale Commissions 3%</div><div className="text-2xl font-black">{formatUSD(stats.sale)}</div></div>
        <div className="bg-white border rounded-2xl p-5"><div className="text-xs text-zinc-500">Penalty Share 40%</div><div className="text-2xl font-black">{formatUSD(stats.penalty)}</div></div>
      </div>
      
      <div className="bg-white border rounded-2xl p-6">
        <h3 className="font-bold">Commission Ledger - BeAhead Earnings</h3>
        <p className="text-xs text-zinc-500">Bank $5 per account, BDC 3% per sale, Penalty 40% = 2.8% of saved. BeForward only 1.4% - won't refuse.</p>
        <div className="mt-4 overflow-auto max-h-[400px]">
          <table className="w-full text-sm"><thead className="text-xs text-zinc-500 border-b"><tr><th className="text-left py-2">Date</th><th>Type</th><th>Amount</th><th>Recipient</th><th>Car</th></tr></thead>
          <tbody>{commissions.map(c => <tr key={c.id} className="border-b"><td className="py-2 text-xs">{new Date(c.created_at).toLocaleDateString()}</td><td><span className="text-[10px] px-2 py-1 rounded-full bg-zinc-100">{c.type}</span></td><td className="font-semibold">{formatUSD(c.amount_usd)}</td><td className="text-xs">{c.recipient}</td><td className="text-xs">{c.beahead_goals?.beahead_cars?.make} {c.beahead_goals?.beahead_cars?.model}</td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  )
}
