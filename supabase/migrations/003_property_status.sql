-- Add status column to properties.
-- Allowed values: to_sell, sold, cancelled, to_rent, rented, pending
-- Run this in Supabase SQL Editor after 002_properties.sql.

create type public.property_status as enum (
  'to_sell', 'sold', 'cancelled', 'to_rent', 'rented', 'pending'
);

alter table public.properties
  add column if not exists status public.property_status not null default 'to_sell';

comment on column public.properties.status is 'Current status of the property listing.';
