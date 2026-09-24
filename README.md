# BeAhead - Production System
## Save Small, Drive Big | Zimbabwe

**Live:** https://beahead.onrender.com (after deploy)
**Supabase:** https://hsckgramsgokjtvcymhv.supabase.co

### What This Is
BeAhead is a licensed escrow savings system for BeForward cars in Zimbabwe. Users pick a SPECIFIC BeForward car, save monthly into their OWN USD Nostro account at a partner bank/microfinance, and we handle purchase via BDC Zimbabwe Bulawayo office.

**You never hold money.** RBZ compliant.

### Real Market Data (for pitch)
- BeForward sells ~600 cars/month into Zim = 7,200/year (per BeForward manager Fujita Kazuhisa)
- BDC Zimbabwe Bulawayo Office: Thuthuka Mall Shop F4, Between 4th & 5th, Jason Moyo Ave
- Zim imports 15k-50k used cars/year, 92% used
- Pilot: 25 clients, not 500 - believable

### Business Model (Fixed)
- **Bank pays you $5** per new escrow account (cheap vs $20 CAC)
- **BeForward/BDC pays you 3%** per car sold (compromise from 5% - they won't refuse)
- **Penalty 7%** split: 40% Bank (2.8% of saved), 40% BeAhead (2.8%), 20% BDC (1.4% of saved)
- Example: User saved $10k, cancels, penalty $700: Bank $280, BeAhead $280, BDC $140

### Setup (1 minute)
1. Go to Supabase SQL Editor: https://supabase.com/dashboard/project/hsckgramsgokjtvcymhv/sql
2. Copy/paste `supabase_schema.sql` and Run - creates `beahead_*` tables only, won't touch your other tables (beacon_leads etc)
3. Set env vars in Render:
   - VITE_SUPABASE_URL=https://hsckgramsgokjtvcymhv.supabase.co
   - VITE_SUPABASE_ANON_KEY=sb_publishable_a9BOUjYmfa2XId79ma_x9Q_xRksM9TZ
4. Deploy

### Features Built
- Landing page with trust pillars + real BDC address
- Auth + Escrow account auto-generation
- Car browser (BeForward specific cars with landed cost calc)
- Goal creation with Tripartite Agreement
- Deposit tracking with EcoCash/InnBucks/Bank proof
- Bank verification flow (bank admin)
- Penalty calculator with correct math
- Commission ledger: $5 referral + 3% sale + penalty splits
- Deposit ledger
- Escrow certificate

### Roles
- user: saves for car
- bank_admin: verifies deposits, holds float interest
- beahead_admin: sees all commissions
- bdc_agent: BDC Zimbabwe staff - sees ready-to-buy goals

### Tech
- Vite + React + Tailwind + Supabase
- Free tier - no billing until users
- Prefix beahead_ for all tables

### Pitch Flow
1. Show landing + real BDC address
2. Pick Toyota Aqua $3,250 -> Total Landed $6,697
3. Create escrow goal -> Get account ESCROW-847392
4. Add deposit $200 EcoCash -> Bank verifies
5. Show penalty math: $10k saved -> $140 to BeForward only 1.4%
6. Show admin: 25 clients = $125 referral + $~$4k commission potential

