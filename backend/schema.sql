-- Run this in your Supabase SQL editor

create extension if not exists "pgcrypto";

-- Companies
create table companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  name text not null,
  website text default '',
  description text default '',
  created_at timestamptz default now()
);

alter table companies enable row level security;
create policy "Users manage own company" on companies
  for all using (auth.uid() = user_id);

-- Roles
create table roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade not null,
  title text not null,
  description text default '',
  evaluation_focus text[] default '{}',
  tone text default 'professional',
  slug text unique not null,
  created_at timestamptz default now()
);

alter table roles enable row level security;
create policy "Company owner manages roles" on roles
  for all using (
    exists (
      select 1 from companies
      where companies.id = roles.company_id
      and companies.user_id = auth.uid()
    )
  );

-- Public read for roles (for interview page)
create policy "Public can read roles by slug" on roles
  for select using (true);

-- Interviews
create table interviews (
  id uuid primary key default gen_random_uuid(),
  role_id uuid references roles(id) on delete cascade not null,
  candidate_name text not null,
  candidate_email text not null,
  status text default 'in_progress',  -- in_progress | completed | analyzing | analyzed
  vapi_call_id text,
  created_at timestamptz default now()
);

alter table interviews enable row level security;
create policy "Company owner reads interviews" on interviews
  for select using (
    exists (
      select 1 from roles
      join companies on companies.id = roles.company_id
      where roles.id = interviews.role_id
      and companies.user_id = auth.uid()
    )
  );
-- Public insert (candidates start interviews)
create policy "Public can insert interviews" on interviews
  for insert with check (true);
-- Public update (vapi call id, status updates from backend)
create policy "Public can update interviews" on interviews
  for update using (true);

-- Transcripts
create table transcripts (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid references interviews(id) on delete cascade not null unique,
  content text not null,
  created_at timestamptz default now()
);

alter table transcripts enable row level security;
create policy "Company owner reads transcripts" on transcripts
  for select using (
    exists (
      select 1 from interviews
      join roles on roles.id = interviews.role_id
      join companies on companies.id = roles.company_id
      where interviews.id = transcripts.interview_id
      and companies.user_id = auth.uid()
    )
  );
create policy "Service role inserts transcripts" on transcripts
  for insert with check (true);
create policy "Service role upserts transcripts" on transcripts
  for update using (true);

-- Reports
create table reports (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid references interviews(id) on delete cascade not null unique,
  summary text default '',
  strengths text[] default '{}',
  weaknesses text[] default '{}',
  behavioral_insights text default '',
  recommendation text default 'Needs review',
  created_at timestamptz default now()
);

alter table reports enable row level security;
create policy "Company owner reads reports" on reports
  for select using (
    exists (
      select 1 from interviews
      join roles on roles.id = interviews.role_id
      join companies on companies.id = roles.company_id
      where interviews.id = reports.interview_id
      and companies.user_id = auth.uid()
    )
  );
create policy "Service role inserts reports" on reports
  for insert with check (true);
create policy "Service role upserts reports" on reports
  for update using (true);
