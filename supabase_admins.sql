-- Run this in Supabase SQL Editor to create admins table properly
CREATE TABLE IF NOT EXISTS beahead_admins (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password text not null,
  role text default 'admin',
  created_at timestamp default now()
);
-- Enable RLS but allow service_role to read all
ALTER TABLE beahead_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service_role" ON beahead_admins FOR ALL USING (true) WITH CHECK (true);
-- Insert super admin
INSERT INTO beahead_admins (username, password, role) VALUES ('HaroldMilan', '@Harold123$#', 'superadmin') ON CONFLICT (username) DO NOTHING;
