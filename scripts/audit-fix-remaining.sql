-- Completar lo que quedó en el audit (4 ítems).
-- Pegar y ejecutar en SQL Editor de test.

-- 1) Proveedores (si no usás /proveedores, igual es inofensivo)
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
for all to authenticated
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
for all to authenticated
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
for all to authenticated
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

grant select, insert, update, delete on public.business_suppliers to authenticated;
grant select, insert, update, delete on public.supplier_orders to authenticated;
grant select, insert, update, delete on public.supplier_order_items to authenticated;

-- 2) Cobro de cuenta corriente (faltó al cortarse la migración cuenta_corriente)
create table if not exists public.customer_account_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.business_customers(id) on delete cascade,
  cash_register_id uuid references public.cash_registers(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'card', 'transfer', 'mercadopago')),
  payment_details jsonb,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.customer_account_payments enable row level security;

drop policy if exists customer_account_payments_all on public.customer_account_payments;
create policy customer_account_payments_all on public.customer_account_payments
for all to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

grant select, insert, update, delete on public.customer_account_payments to authenticated;

create or replace function public.record_customer_account_payment(
  p_business_id uuid,
  p_customer_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_payment_details jsonb default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_id uuid;
  v_open_register_id uuid;
  v_balance numeric(12,2);
  v_cust_business uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_business_member(p_business_id) then
    raise exception 'not_authorized';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'invalid_amount';
  end if;
  if p_payment_method not in ('cash', 'card', 'transfer', 'mercadopago') then
    raise exception 'invalid_payment_method';
  end if;

  select business_id into v_cust_business
  from public.business_customers
  where id = p_customer_id
  for update;

  if not found then
    raise exception 'customer_not_found';
  end if;
  if v_cust_business is distinct from p_business_id then
    raise exception 'customer_wrong_business';
  end if;

  v_balance := public.customer_balance(p_customer_id);
  if p_amount > v_balance + 0.009 then
    raise exception 'payment_exceeds_balance';
  end if;

  select cr.id
    into v_open_register_id
  from public.cash_registers cr
  where cr.business_id = p_business_id
    and cr.closed_at is null
  order by cr.opened_at desc
  limit 1;

  if v_open_register_id is null then
    raise exception 'cash_register_not_open';
  end if;

  insert into public.customer_account_payments (
    business_id,
    customer_id,
    cash_register_id,
    amount,
    payment_method,
    payment_details,
    notes,
    created_by
  )
  values (
    p_business_id,
    p_customer_id,
    v_open_register_id,
    round(p_amount::numeric, 2),
    p_payment_method,
    p_payment_details,
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_customer_account_payment(uuid, uuid, numeric, text, jsonb, text) from public;
grant execute on function public.record_customer_account_payment(uuid, uuid, numeric, text, jsonb, text) to authenticated;
