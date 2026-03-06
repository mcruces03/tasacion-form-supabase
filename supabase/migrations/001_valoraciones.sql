-- Form submissions (valoraciones) for real estate appraisals.
-- Run this in Supabase SQL Editor or via Supabase CLI.

create table if not exists public.valoraciones (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  email_sent_to text,
  created_at timestamptz not null default now()
);

-- Optional: RLS so only authenticated users can read (adjust to your auth strategy).
-- alter table public.valoraciones enable row level security;
-- create policy "Allow anon insert" on public.valoraciones for insert with (true);
-- create policy "Allow service role all" on public.valoraciones for all using (auth.role() = 'service_role');

comment on table public.valoraciones is 'Stored property appraisal forms (valoración de inmueble).';
