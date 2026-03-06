-- Properties table: one row per property (inmueble).
-- internal_id is auto-generated: PP0001, PP0002, ...
-- Run this in Supabase SQL Editor after 001_valoraciones.sql.

create sequence if not exists public.property_internal_id_seq start 1;

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  internal_id text unique not null default (
    'PP' || lpad(nextval('public.property_internal_id_seq')::text, 4, '0')
  ),
  direccion text,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep direccion in sync from data and auto-update updated_at
create or replace function public.sync_property_direccion()
returns trigger as $$
begin
  new.direccion := coalesce(new.data->>'direccion', '')::text;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger properties_sync_direccion
  before insert or update on public.properties
  for each row execute function public.sync_property_direccion();

-- Link valoraciones to properties (a property has many valoraciones)
alter table public.valoraciones
  add column if not exists property_id uuid references public.properties(id) on delete set null;

comment on table public.properties is 'Properties (inmuebles) from the appraisal form; internal_id format PP0001, PP0002, ...';
comment on column public.valoraciones.property_id is 'FK to the property this appraisal report was sent for.';
