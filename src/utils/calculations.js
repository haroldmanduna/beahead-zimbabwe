// BeAhead Calculations - Production Logic with 7% penalty split 40/40/20
export const calculateLandedCost = (car) => {
  const carPrice = Number(car.price_usd)
  const freight = Number(car.freight_usd || 1150)
  const clearing = 350
  const dutyRate = Number(car.duty_rate || 0.55)
  const duty = carPrice * dutyRate
  const beaheadPercent = 0.03 // 3% compromise, not 5% to make BeForward say yes
  const beaheadFee = carPrice * beaheadPercent
  
  const total = carPrice + freight + duty + clearing + beaheadFee
  
  return {
    carPrice,
    freight,
    duty,
    dutyRate,
    clearing,
    beaheadFee,
    beaheadPercent,
    total: Math.round(total),
    breakdown: [
      { label: 'BeForward Car Price', value: carPrice, note: `Ref: ${car.beforward_ref}` },
      { label: 'Freight Japan to Durban', value: freight, note: 'Shipping' },
      { label: `ZIMRA Duty Est. (${Math.round(dutyRate*100)}%)`, value: Math.round(duty), note: `Based on ${car.engine_cc}cc, ${car.year}` },
      { label: 'Beitbridge Clearing & Delivery', value: clearing, note: 'BDC Zimbabwe - Thuthuka Mall Bulawayo' },
      { label: `BeAhead Service Fee (${beaheadPercent*100}%)`, value: Math.round(beaheadFee), note: 'Tech, escrow tracking, support' },
    ]
  }
}

export const calculatePenalty = (savedAmount, rate = 0.07) => {
  const penalty = savedAmount * rate
  return {
    totalPenalty: Math.round(penalty),
    bank: Math.round(penalty * 0.40), // 40%
    beahead: Math.round(penalty * 0.40), // 40%
    beforward: Math.round(penalty * 0.20), // 20%
    rate,
    bankPercentOfSaved: (rate * 0.40 * 100).toFixed(1),
    beaheadPercentOfSaved: (rate * 0.40 * 100).toFixed(1),
    beforwardPercentOfSaved: (rate * 0.20 * 100).toFixed(1),
  }
}

export const calculateMonthly = (total, months = 12) => {
  return Math.ceil(total / months)
}

export const formatUSD = (n) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
