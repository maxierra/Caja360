-- Proveedores, pedidos a proveedor y líneas de pedido.

create table if not exists public.business_suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  tax_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_suppliers_business_name_idx
  on public.business_suppliers (business_id, lower(name));

alter table public.business_suppliers enable row level security;

drop policy if exists business_suppliers_all on public.business_suppliers;
create policy business_suppliers_all on public.business_suppliers
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

create table if not exists public.supplier_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.business_suppliers(id) on delete cascade,
  status text not null default 'ordered'
    check (status in ('ordered', 'received', 'paid', 'cancelled')),
  order_date date not null default (timezone('America/Argentina/Buenos_Aires', now()))::date,
  expected_date date,
  notes text,
  received_at timestamptz,
  invoice_number text,
  invoice_total numeric(12, 2) check (invoice_total is null or invoice_total >= 0),
  paid_at timestamptz,
  payment_method text,
  payment_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supplier_orders_business_idx
  on public.supplier_orders (business_id, created_at desc);
create index if not exists supplier_orders_supplier_idx
  on public.supplier_orders (supplier_id, created_at desc);

alter table public.supplier_orders enable row level security;

drop policy if exists supplier_orders_all on public.supplier_orders;
create policy supplier_orders_all on public.supplier_orders
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

create table if not exists public.supplier_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.supplier_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  quantity_received numeric(12, 3) not null default 0 check (quantity_received >= 0),
  unit_cost numeric(12, 2) check (unit_cost is null or unit_cost >= 0)
);

create index if not exists supplier_order_items_order_idx
  on public.supplier_order_items (order_id);

alter table public.supplier_order_items enable row level security;

drop policy if exists supplier_order_items_all on public.supplier_order_items;
create policy supplier_order_items_all on public.supplier_order_items
for all
to authenticated
using (
  exists (
    select 1 from public.supplier_orders o
    where o.id = supplier_order_items.order_id
      and public.is_business_member(o.business_id)
  )
)
with check (
  exists (
    select 1 from public.supplier_orders o
    where o.id = supplier_order_items.order_id
      and public.is_business_member(o.business_id)
  )
);
