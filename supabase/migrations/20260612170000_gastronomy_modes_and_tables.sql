alter table public.businesses
  add column if not exists gastronomy_counter_enabled boolean not null default true,
  add column if not exists gastronomy_delivery_enabled boolean not null default false,
  add column if not exists gastronomy_tables_enabled boolean not null default false;

create table if not exists public.business_tables (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_tables_business_idx on public.business_tables(business_id, active, name);
