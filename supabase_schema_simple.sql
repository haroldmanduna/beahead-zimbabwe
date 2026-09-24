-- BeAhead SIMPLE Schema - No auth.users FK, guaranteed to work
-- Run this in https://supabase.com/dashboard/project/hsckgramsgokjtvcymhv/sql

-- Drop if exists to clean
drop table if exists public.beahead_activities cascade;
drop table if exists public.beahead_commissions cascade;
drop table if exists public.beahead_deposits cascade;
drop table if exists public.beahead_goals cascade;
drop table if exists public.beahead_cars cascade;
drop table if exists public.beahead_profiles cascade;
drop table if exists public.beahead_banks cascade;

create extension if not exists "uuid-ossp";

create table public.beahead_profiles (
  id uuid primary key,
  email text,
  full_name text,
  phone text,
  national_id text,
  address text,
  role text default 'user',
  kyc_status text default 'pending',
  bank_account_number text,
  bank_name text default 'EmpowerBank',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.beahead_cars (
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
  status text default 'available',
  location text default 'Japan',
  duty_rate numeric default 0.55,
  created_at timestamp with time zone default now()
);

create table public.beahead_goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  car_id uuid not null,
  goal_amount_usd numeric not null,
  car_price_usd numeric not null,
  freight_usd numeric not null,
  duty_estimate_usd numeric not null,
  clearing_fee_usd numeric default 350,
  beahead_fee_usd numeric not null,
  beahead_fee_percent numeric default 0.03,
  saved_amount_usd numeric default 0,
  status text default 'active',
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

create table public.beahead_deposits (
  id uuid primary key default uuid_generate_v4(),
  goal_id uuid not null,
  user_id uuid not null,
  amount_usd numeric not null,
  deposit_date date default current_date,
  proof_image_url text,
  verification_status text default 'pending',
  verified_by uuid,
  verified_at timestamp with time zone,
  method text default 'bank_transfer',
  reference_code text,
  bank_statement_match boolean default false,
  notes text,
  created_at timestamp with time zone default now()
);

create table public.beahead_commissions (
  id uuid primary key default uuid_generate_v4(),
  goal_id uuid,
  user_id uuid,
  type text not null,
  amount_usd numeric not null,
  percentage numeric,
  status text default 'pending',
  recipient text,
  notes text,
  created_at timestamp with time zone default now()
);

create table public.beahead_activities (
  id uuid primary key default uuid_generate_v4(),
  goal_id uuid,
  user_id uuid,
  action text not null,
  details jsonb,
  created_at timestamp with time zone default now()
);

create table public.beahead_banks (
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

-- Enable RLS and allow all
alter table public.beahead_profiles enable row level security;
alter table public.beahead_cars enable row level security;
alter table public.beahead_goals enable row level security;
alter table public.beahead_deposits enable row level security;
alter table public.beahead_commissions enable row level security;
alter table public.beahead_activities enable row level security;
alter table public.beahead_banks enable row level security;

create policy "allow all profiles" on public.beahead_profiles for all using (true) with check (true);
create policy "allow all cars" on public.beahead_cars for all using (true) with check (true);
create policy "allow all goals" on public.beahead_goals for all using (true) with check (true);
create policy "allow all deposits" on public.beahead_deposits for all using (true) with check (true);
create policy "allow all commissions" on public.beahead_commissions for all using (true) with check (true);
create policy "allow all activities" on public.beahead_activities for all using (true) with check (true);
create policy "allow all banks" on public.beahead_banks for all using (true) with check (true);

-- Seed banks
insert into public.beahead_banks (name, code, referral_fee_usd) values 
('EmpowerBank Microfinance', 'EMPB', 5),
('CBZ Bank - Escrow Division', 'CBZ', 5),
('CABS - Nostro Escrow', 'CABS', 5);

-- Seed cars
insert into public.beahead_cars (beforward_ref, make, model, year, price_usd, freight_usd, mileage, engine_cc, fuel_type, transmission, image_url, beforward_url, duty_rate) values
('BF-AQUA-2015-001', 'Toyota', 'Aqua', 2015, 3250, 1150, 85000, 1500, 'Hybrid', 'Automatic', 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600', 'https://www.beforward.jp/toyota/aqua/bf123456', 0.55),
('BF-FIT-2016-002', 'Honda', 'Fit', 2016, 3800, 1150, 72000, 1300, 'Petrol', 'Automatic', 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600', 'https://www.beforward.jp/honda/fit/bf234567', 0.55),
('BF-BELTA-2014-003', 'Toyota', 'Belta', 2014, 2900, 1150, 95000, 1000, 'Petrol', 'Automatic', 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=600', 'https://www.beforward.jp/toyota/belta/bf345678', 0.50),
('BF-PASSO-2017-004', 'Toyota', 'Passo', 2017, 3400, 1150, 65000, 1000, 'Petrol', 'Automatic', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600', 'https://www.beforward.jp/toyota/passo/bf456789', 0.50),
('BF-NOTE-2015-005', 'Nissan', 'Note', 2015, 3100, 1150, 88000, 1200, 'Petrol', 'Automatic', 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=600', 'https://www.beforward.jp/nissan/note/bf567890', 0.52),
('BF-VITZ-2016-006', 'Toyota', 'Vitz', 2016, 3600, 1150, 70000, 1300, 'Petrol', 'Automatic', 'https://images.unsplash.com/photo-1550355291-bbee04a92027?w=600', 'https://www.beforward.jp/toyota/vitz/bf678901', 0.52);
