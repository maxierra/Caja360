-- POS checkout: dependencias mínimas + create_sale_with_items (5 args) para DB test
-- Ejecutar después de schema.sql si el cobro falla con "Could not find the function create_sale_with_items"

-- Clientes (cuenta corriente)
create table if not exists public.business_customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  credit_limit numeric(12, 2) not null default 0 check (credit_limit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_customers_business_name_idx
  on public.business_customers (business_id, lower(name));

alter table public.business_customers enable row level security;

drop policy if exists business_customers_all on public.business_customers;
create policy business_customers_all on public.business_customers
for all to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

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

alter table public.sales add column if not exists customer_id uuid references public.business_customers(id) on delete set null;

create or replace function public.customer_balance(p_customer_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select round(
    coalesce((
      select sum(s.total)
      from public.sales s
      where s.customer_id = p_customer_id
        and s.payment_method = 'cuenta_corriente'
        and s.status = 'paid'
    ), 0)
    -
    coalesce((
      select sum(p.amount)
      from public.customer_account_payments p
      where p.customer_id = p_customer_id
    ), 0),
    2
  );
$$;

grant execute on function public.customer_balance(uuid) to authenticated;

-- Versión actual del RPC (igual que 20260401120000_promotion_totals_in_sales.sql)
create or replace function public.create_sale_with_items(
  p_business_id uuid,
  p_payment_method text,
  p_payment_details jsonb,
  p_items jsonb,
  p_customer_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_sale_id uuid;
  v_open_register_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_name text;
  v_qty numeric(12,3);
  v_unit_price numeric(12,2);
  v_total numeric(12,2);
  v_sold_by_weight boolean;
  v_stock_int integer;
  v_stock_dec numeric(12,3);
  v_sale_total numeric(12,2);
  v_pre_total numeric(12,2);
  v_credit_limit numeric(12,2);
  v_balance numeric(12,2);
  v_cust_business uuid;
  v_promo_amount numeric(12,2);
  v_total_net numeric(12,2);
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_business_member(p_business_id) then
    raise exception 'not_authorized';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_items';
  end if;

  if p_payment_method = 'cuenta_corriente' then
    if p_customer_id is null then
      raise exception 'customer_required_for_cuenta_corriente';
    end if;
    select c.business_id, c.credit_limit
      into v_cust_business, v_credit_limit
    from public.business_customers c
    where c.id = p_customer_id
    for update;

    if not found then
      raise exception 'customer_not_found';
    end if;
    if v_cust_business is distinct from p_business_id then
      raise exception 'customer_wrong_business';
    end if;
    if coalesce(v_credit_limit, 0) <= 0 then
      raise exception 'customer_no_credit_limit';
    end if;
  end if;

  v_pre_total := 0;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'product_id', '')::uuid;
    v_qty := coalesce((v_item->>'quantity')::numeric, 0);
    v_unit_price := coalesce((v_item->>'unit_price')::numeric, 0);
    if v_product_id is null then
      raise exception 'missing_product_id';
    end if;
    if v_qty <= 0 then
      raise exception 'invalid_quantity';
    end if;
    if not exists (
      select 1 from public.products p
      where p.id = v_product_id and p.business_id = p_business_id
    ) then
      raise exception 'product_not_found';
    end if;
    v_pre_total := v_pre_total + round((v_qty * v_unit_price)::numeric, 2);
  end loop;

  if p_payment_method = 'cuenta_corriente' then
    v_balance := public.customer_balance(p_customer_id);
    if v_balance + v_pre_total > v_credit_limit then
      raise exception 'credit_limit_exceeded';
    end if;
  end if;

  select cr.id
    into v_open_register_id
  from public.cash_registers cr
  where cr.business_id = p_business_id
    and cr.closed_at is null
  order by cr.opened_at desc
  limit 1;

  insert into public.sales (business_id, cashier_user_id, total, payment_method, payment_details, status, customer_id)
  values (
    p_business_id,
    auth.uid(),
    0,
    p_payment_method,
    p_payment_details,
    'paid',
    case when p_payment_method = 'cuenta_corriente' then p_customer_id else null end
  )
  returning id into v_sale_id;

  if v_open_register_id is not null then
    update public.sales
      set cash_register_id = v_open_register_id
    where id = v_sale_id;
  end if;

  perform set_config('app.product_activity_source', 'sale', true);

  v_sale_total := 0;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'product_id', '')::uuid;
    v_name := coalesce(nullif(v_item->>'name', ''), 'Producto');
    v_qty := coalesce((v_item->>'quantity')::numeric, 0);
    v_unit_price := coalesce((v_item->>'unit_price')::numeric, 0);

    select p.sold_by_weight, p.stock, p.stock_decimal
      into v_sold_by_weight, v_stock_int, v_stock_dec
    from public.products p
    where p.id = v_product_id
      and p.business_id = p_business_id
    for update;

    if v_sold_by_weight then
      if v_stock_dec < v_qty then
        raise exception 'insufficient_stock';
      end if;
      update public.products
        set stock_decimal = stock_decimal - v_qty,
            updated_at = now()
        where id = v_product_id
          and business_id = p_business_id;
    else
      if v_stock_int < ceil(v_qty)::int then
        raise exception 'insufficient_stock';
      end if;
      update public.products
        set stock = stock - ceil(v_qty)::int,
            updated_at = now()
        where id = v_product_id
          and business_id = p_business_id;
    end if;

    v_total := round((v_qty * v_unit_price)::numeric, 2);
    v_sale_total := v_sale_total + v_total;

    insert into public.sale_items (business_id, sale_id, product_id, name, quantity, unit_price, total)
    values (p_business_id, v_sale_id, v_product_id, v_name, v_qty, v_unit_price, v_total);
  end loop;

  v_promo_amount := coalesce((p_payment_details->'promotion'->>'amount')::numeric, 0);
  v_total_net := greatest(0, coalesce(v_sale_total, 0) - coalesce(v_promo_amount, 0));

  update public.sales
    set total = v_total_net
  where id = v_sale_id;

  return v_sale_id;
end;
$$;

revoke all on function public.create_sale_with_items(uuid, text, jsonb, jsonb, uuid) from public;
grant execute on function public.create_sale_with_items(uuid, text, jsonb, jsonb, uuid) to authenticated;

grant select, insert, update, delete on public.business_customers to authenticated;
grant select, insert, update, delete on public.customer_account_payments to authenticated;

-- Cuenta corriente como 5º medio de pago por defecto
alter table public.business_payment_methods drop constraint if exists business_payment_methods_method_code_check;
alter table public.business_payment_methods
  add constraint business_payment_methods_method_code_check
  check (method_code in ('cash', 'card', 'transfer', 'mercadopago', 'cuenta_corriente'));

create or replace function public.ensure_business_payment_methods(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_business_member(p_business_id) then
    raise exception 'not_authorized';
  end if;

  insert into public.business_payment_methods (business_id, method_code, label, icon_key, sort_order)
  values
    (p_business_id, 'cash', 'Efectivo', 'banknote', 0),
    (p_business_id, 'card', 'Tarjeta', 'credit-card', 1),
    (p_business_id, 'transfer', 'Transferencia', 'landmark', 2),
    (p_business_id, 'mercadopago', 'Mercado Pago', 'wallet', 3),
    (p_business_id, 'cuenta_corriente', 'Cuenta corriente', 'notebook-pen', 4)
  on conflict (business_id, method_code) do nothing;
end;
$$;

grant execute on function public.ensure_business_payment_methods(uuid) to authenticated;

insert into public.business_payment_methods (business_id, method_code, label, icon_key, sort_order)
select b.id, v.method_code, v.label, v.icon_key, v.sort_order
from public.businesses b
cross join (
  values
    ('cuenta_corriente'::text, 'Cuenta corriente'::text, 'notebook-pen'::text, 4)
) as v(method_code, label, icon_key, sort_order)
on conflict (business_id, method_code) do nothing;

notify pgrst, 'reload schema';
