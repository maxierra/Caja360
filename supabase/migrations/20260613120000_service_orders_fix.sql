-- ============================================================
-- Migration: 20260613120000_service_orders_fix.sql
-- Fix: ensure service_orders and service_order_items exist in
--      the remote Supabase DB with correct schema, RLS, and indexes.
--
-- Root cause: the tables were missing from the remote DB (the
-- supabase_types.ts file has no service_orders entries), and
-- service_order_items.product_id was NOT NULL which blocks
-- saves of items that don't have a catalogued product.
-- ============================================================

-- ---------------------------------------------------------------
-- 1. service_orders
-- ---------------------------------------------------------------
create table if not exists public.service_orders (
  id          uuid        primary key default gen_random_uuid(),
  business_id uuid        not null references public.businesses(id) on delete cascade,
  type        text        not null check (type in ('delivery', 'table')),
  status      text        not null check (status in (
                'occupied', 'preparing', 'served',
                'delivery_new', 'delivery_preparing',
                'delivery_ready', 'delivery_on_the_way'
              )),
  table_id        uuid    references public.business_tables(id) on delete set null,
  customer_name   text,
  customer_phone  text,
  delivery_address text,
  notes           text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 2. service_order_items
--    product_id is NULLABLE — orders may include ad-hoc items
--    that have no corresponding row in products.
-- ---------------------------------------------------------------
create table if not exists public.service_order_items (
  id               uuid         primary key default gen_random_uuid(),
  service_order_id uuid         not null references public.service_orders(id) on delete cascade,
  business_id      uuid         not null references public.businesses(id) on delete cascade,
  product_id       uuid         references public.products(id) on delete set null,  -- nullable
  name             text         not null,
  quantity         numeric(12,3) not null default 1,
  unit_price       numeric(12,2) not null default 0,
  created_at       timestamptz  not null default now()
);

-- ---------------------------------------------------------------
-- 3. If the table already existed with product_id NOT NULL,
--    relax the constraint so ad-hoc items don't cause errors.
-- ---------------------------------------------------------------
alter table public.service_order_items
  alter column product_id drop not null;

-- Also drop the NOT NULL-dependent FK and replace it with a
-- nullable one (safe to run even if the constraint doesn't exist).
do $$
begin
  -- Drop the old ON DELETE CASCADE FK if it points to products
  -- (only relevant if the table already existed with it)
  if exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
      and tc.table_schema = kcu.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and tc.table_name = 'service_order_items'
      and kcu.column_name = 'product_id'
  ) then
    -- Nothing to do — the FK exists; we just dropped NOT NULL above.
    null;
  else
    -- FK didn't exist (e.g. fresh table from this migration): it was
    -- already created as nullable in the CREATE TABLE above. OK.
    null;
  end if;
end;
$$;

-- ---------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------
create index if not exists service_orders_business_type_idx
  on public.service_orders(business_id, type, updated_at desc);

create index if not exists service_orders_table_idx
  on public.service_orders(table_id);

create index if not exists service_orders_status_idx
  on public.service_orders(business_id, status);

create index if not exists service_order_items_order_idx
  on public.service_order_items(service_order_id);

create index if not exists service_order_items_business_idx
  on public.service_order_items(business_id);

-- ---------------------------------------------------------------
-- 5. Row-Level Security
-- ---------------------------------------------------------------
alter table public.service_orders      enable row level security;
alter table public.service_order_items enable row level security;

drop policy if exists service_orders_all on public.service_orders;
create policy service_orders_all on public.service_orders
  for all
  to authenticated
  using  (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

drop policy if exists service_order_items_all on public.service_order_items;
create policy service_order_items_all on public.service_order_items
  for all
  to authenticated
  using  (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));
