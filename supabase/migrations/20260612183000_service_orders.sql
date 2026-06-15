create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  type text not null check (type in ('delivery', 'table')),
  status text not null check (status in ('occupied', 'preparing', 'served', 'delivery_new', 'delivery_preparing', 'delivery_ready', 'delivery_on_the_way')),
  table_id uuid references public.business_tables(id) on delete set null,
  customer_name text,
  customer_phone text,
  delivery_address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_order_items (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  quantity numeric(12,3) not null default 1,
  unit_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists service_orders_business_type_idx on public.service_orders(business_id, type, updated_at desc);
create index if not exists service_orders_table_idx on public.service_orders(table_id);
create index if not exists service_order_items_order_idx on public.service_order_items(service_order_id);

alter table public.service_orders enable row level security;
alter table public.service_order_items enable row level security;

drop policy if exists service_orders_all on public.service_orders;
create policy service_orders_all on public.service_orders
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

drop policy if exists service_order_items_all on public.service_order_items;
create policy service_order_items_all on public.service_order_items
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));
