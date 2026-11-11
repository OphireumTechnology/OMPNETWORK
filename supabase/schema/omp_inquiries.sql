-- OMPNETWORK: private inquiry storage. Apply only to a dedicated OMPNETWORK Supabase project.
create table if not exists public.opm_inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null check (char_length(full_name) between 1 and 160),
  email text not null check (char_length(email) <= 254),
  contact_number text not null check (char_length(contact_number) <= 50),
  company text not null check (char_length(company) <= 200),
  service_id text not null check (char_length(service_id) <= 100),
  project_description text not null check (char_length(project_description) between 20 and 10000),
  estimated_budget text,
  privacy_consent boolean not null check (privacy_consent),
  status text not null default 'received' check (status in ('received','reviewing','closed')),
  notification_status text not null default 'pending' check (notification_status in ('pending','sent','failed'))
);
alter table public.opm_inquiries enable row level security;
revoke all on public.opm_inquiries from public, anon, authenticated;
grant select, insert, update on public.opm_inquiries to service_role;
-- No public policies: anonymous visitors cannot query inquiry records.
-- Administrative reads must be performed through an authenticated, role-checked server function.
