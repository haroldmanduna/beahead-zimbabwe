-- BeAhead Production Schema - Safe to run, uses prefix beahead_ so won't disturb other projects
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/hsckgramsgokjtvcymhv/sql

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles (extends auth.users)
create table if not exists public.beahead_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  national_id text,
  address text,
  role text default 'user' check (role in ('user','bank_admin','beahead_admin','bdc_agent')),
  kyc_status text default 'pending' check (kyc_status in ('pending','verified','rejected')),
  bank_account_number text,
  bank_name text default 'To be assigned',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 2. Cars (BeForward listings)
create table if not exists public.beahead_cars (
  id uuid primary key default uuid_generate_v4(),
  beforward_ref text unique not null,
  make text not null,
  model text not null,
  year int not null,
  price_usd numeric not null,
  freight_usd numeric default 1150,
  mileage int,
  engine_cc int,
  fuel_type text,
  transmission text,
  image_url text,
  beforward_url text,
  status text default 'available' check (status in ('available','reserved','sold','expired')),
  location text default 'Japan',
  duty_rate numeric default 0.55,
  created_at timestamp with time zone default now()
);

-- 3. Goals (Savings Goals - Escrow)
create table if not exists public.beahead_goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.beahead_profiles(id) on delete cascade,
  car_id uuid not null references public.beahead_cars(id),
  goal_amount_usd numeric not null,
  car_price_usd numeric not null,
  freight_usd numeric not null,
  duty_estimate_usd numeric not null,
  clearing_fee_usd numeric default 350,
  beahead_fee_usd numeric not null,
  beahead_fee_percent numeric default 0.03,
  saved_amount_usd numeric default 0,
  status text default 'active' check (status in ('active','reserved','ready_to_buy','purchased','cancelled','switched')),
  progress_percent numeric default 0,
  escrow_account_number text,
  escrow_bank_name text,
  agreement_signed boolean default false,
  agreement_signed_at timestamp with time zone,
  penalty_rate numeric default 0.07,
  monthly_target numeric,
  target_date date,
  bdc_office text default 'Thuthuka Mall Between 4th and 5th and Jason Moyo Ave, Shop F4, Bulawayo',
  bdc_agent_name text default 'BDC ZIMBABWE (PVT) LTD',
  cancellation_reason text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 4. Deposits
create table if not exists public.beahead_deposits (
  id uuid primary key default uuid_generate_v4(),
  goal_id uuid not null references public.beahead_goals(id) on delete cascade,
  user_id uuid not null references public.beahead_profiles(id) on delete cascade,
  amount_usd numeric not null,
  deposit_date date default current_date,
  proof_image_url text,
  verification_status text default 'pending' check (verification_status in ('pending','verified','rejected')),
  verified_by uuid references public.beahead_profiles(id),
  verified_at timestamp with time zone,
  method text default 'bank_transfer' check (method in ('bank_transfer','cash_deposit','ecocash','innbucks','zipit')),
  reference_code text,
  bank_statement_match boolean default false,
  notes text,
  created_at timestamp with time zone default now()
);

-- 5. Commissions & Penalties Ledger
create table if not exists public.beahead_commissions (
  id uuid primary key default uuid_generate_v4(),
  goal_id uuid references public.beahead_goals(id) on delete set null,
  user_id uuid references public.beahead_profiles(id) on delete set null,
  type text not null check (type in ('referral','sale_commission','penalty_bank','penalty_beahead','penalty_beforward','clearing_fee')),
  amount_usd numeric not null,
  percentage numeric,
  status text default 'pending' check (status in ('pending','paid','forfeited','waived')),
  recipient text,
  notes text,
  created_at timestamp with time zone default now()
);

-- 6. Activities Log
create table if not exists public.beahead_activities (
  id uuid primary key default uuid_generate_v4(),
  goal_id uuid references public.beahead_goals(id) on delete cascade,
  user_id uuid references public.beahead_profiles(id) on delete set null,
  action text not null,
  details jsonb,
  created_at timestamp with time zone default now()
);

-- 7. Bank Partners
create table if not exists public.beahead_banks (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text unique,
  contact_person text,
  contact_email text,
  referral_fee_usd numeric default 5,
  interest_rate numeric default 0,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

-- Indexes
create index if not exists idx_beahead_goals_user on public.beahead_goals(user_id);
create index if not exists idx_beahead_goals_car on public.beahead_goals(car_id);
create index if not exists idx_beahead_deposits_goal on public.beahead_deposits(goal_id);
create index if not exists idx_beahead_deposits_user on public.beahead_deposits(user_id);
create index if not exists idx_beahead_commissions_goal on public.beahead_commissions(goal_id);

-- Enable RLS
alter table public.beahead_profiles enable row level security;
alter table public.beahead_cars enable row level security;
alter table public.beahead_goals enable row level security;
alter table public.beahead_deposits enable row level security;
alter table public.beahead_commissions enable row level security;
alter table public.beahead_activities enable row level security;
alter table public.beahead_banks enable row level security;

-- RLS Policies (permissive for MVP - you can tighten later)
-- Drop existing if any
drop policy if exists "Allow all for beahead_profiles" on public.beahead_profiles;
drop policy if exists "Allow all for beahead_cars" on public.beahead_cars;
drop policy if exists "Allow all for beahead_goals" on public.beahead_goals;
drop policy if exists "Allow all for beahead_deposits" on public.beahead_deposits;
drop policy if exists "Allow all for beahead_commissions" on public.beahead_commissions;
drop policy if exists "Allow all for beahead_activities" on public.beahead_activities;
drop policy if exists "Allow all for beahead_banks" on public.beahead_banks;

create policy "Allow all for beahead_profiles" on public.beahead_profiles for all using (true) with check (true);
create policy "Allow all for beahead_cars" on public.beahead_cars for all using (true) with check (true);
create policy "Allow all for beahead_goals" on public.beahead_goals for all using (true) with check (true);
create policy "Allow all for beahead_deposits" on public.beahead_deposits for all using (true) with check (true);
create policy "Allow all for beahead_commissions" on public.beahead_commissions for all using (true) with check (true);
create policy "Allow all for beahead_activities" on public.beahead_activities for all using (true) with check (true);
create policy "Allow all for beahead_banks" on public.beahead_banks for all using (true) with check (true);

-- Seed: Banks
insert into public.beahead_banks (name, code, referral_fee_usd) values 
('EmpowerBank Microfinance', 'EMPB', 5),
('CBZ Bank - Escrow Division', 'CBZ', 5),
('CABS - Nostro Escrow', 'CABS', 5)
on conflict (code) do nothing;

-- Seed: Realistic BeForward Cars (Zim popular models)
insert into public.beahead_cars (beforward_ref, make, model, year, price_usd, freight_usd, mileage, engine_cc, fuel_type, transmission, image_url, beforward_url, duty_rate) values
('BF-AQUA-2015-001', 'Toyota', 'Aqua', 2015, 3250, 1150, 85000, 1500, 'Hybrid', 'Automatic', 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600', 'https://www.beforward.jp/toyota/aqua/bf123456', 0.55),
('BF-FIT-2016-002', 'Honda', 'Fit', 2016, 3800, 1150, 72000, 1300, 'Petrol', 'Automatic', 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600', 'https://www.beforward.jp/honda/fit/bf234567', 0.55),
('BF-BELTA-2014-003', 'Toyota', 'Belta', 2014, 2900, 1150, 95000, 1000, 'Petrol', 'Automatic', 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=600', 'https://www.beforward.jp/toyota/belta/bf345678', 0.50),
('BF-PASSO-2017-004', 'Toyota', 'Passo', 2017, 3400, 1150, 65000, 1000, 'Petrol', 'Automatic', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600', 'https://www.beforward.jp/toyota/passo/bf456789', 0.50),
('BF-NOTE-2015-005', 'Nissan', 'Note', 2015, 3100, 1150, 88000, 1200, 'Petrol', 'Automatic', 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=600', 'https://www.beforward.jp/nissan/note/bf567890', 0.52),
('BF-VITZ-2016-006', 'Toyota', 'Vitz', 2016, 3600, 1150, 70000, 1300, 'Petrol', 'Automatic', 'https://images.unsplash.com/photo-1550355291-bbee04a92027?w=600', 'https://www.beforward.jp/toyota/vitz/bf678901', 0.52)
on conflict (beforward_ref) do nothing;

-- Function to update progress
create or replace function public.update_goal_progress()
returns trigger as $$
begin
  update public.beahead_goals
  set saved_amount_usd = (select coalesce(sum(amount_usd),0) from public.beahead_deposits where goal_id = NEW.goal_id and verification_status = 'verified'),
      progress_percent = case when goal_amount_usd > 0 then (select coalesce(sum(amount_usd),0) from public.beahead_deposits where goal_id = NEW.goal_id and verification_status = 'verified') / goal_amount_usd * 100 else 0 end,
      updated_at = now()
  where id = NEW.goal_id;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_update_progress on public.beahead_deposits;
create trigger trg_update_progress
after insert or update on public.beahead_deposits
for each row execute function public.update_goal_progress();
