create extension if not exists "pgcrypto";

create type public.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'canceled'
);

-- timestamptz guarda el instante correcto en UTC; Supabase Table Editor suele mostrar +00.
-- Hora Argentina (ej. America/Argentina/Buenos_Aires) = mismo instante, otra zona horaria.
-- Para verla en SQL: created_at AT TIME ZONE 'America/Argentina/Buenos_Aires'

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  business_type text not null default 'retail' check (business_type in ('retail', 'fashion', 'gastronomy')),
  gastronomy_counter_enabled boolean not null default true,
  gastronomy_delivery_enabled boolean not null default false,
  gastronomy_tables_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  onboarding_completed_at timestamptz,
  report_daily_enabled boolean default false,
  report_daily_email text,
  report_daily_time time default '08:00:00'
);

create table if not exists public.memberships (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  permissions jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

-- PERFORMANCE:Índice para is_business_member y verificaciones de auth
create index if not exists memberships_user_active_idx on public.memberships(user_id, deleted_at) where deleted_at is null;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  sku text,
  variant_group text,
  size text,
  color text,
  image_path text,
  image_url text,
  barcode text,
  scale_code text,
  category text,
  price numeric(12,2) not null default 0,
  cost numeric(12,2) not null default 0,
  expires_at date,
  sold_by_weight boolean not null default false,
  stock integer not null default 0,
  stock_decimal numeric(12,3) not null default 0,
  low_stock_threshold integer not null default 0,
  low_stock_threshold_decimal numeric(12,3) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_tables (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_tables_business_idx on public.business_tables(business_id, active, name);

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

create index if not exists products_business_id_idx on public.products(business_id);
create index if not exists products_barcode_idx on public.products(business_id, barcode);
create index if not exists products_scale_code_idx on public.products(business_id, scale_code);
create index if not exists products_sku_idx on public.products(business_id, sku);

create table if not exists public.cash_registers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  opened_by uuid references auth.users(id),
  opened_at timestamptz not null default now(),
  shift_start_at time,
  shift_end_at time,
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  opening_amount numeric(12,2) not null default 0,
  closing_amount numeric(12,2),
  notes text
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  cash_register_id uuid references public.cash_registers(id) on delete set null,
  cashier_user_id uuid references auth.users(id),
  total numeric(12,2) not null default 0,
  payment_method text not null,
  payment_details jsonb,
  status text not null default 'paid',
  created_at timestamptz not null default now()
);

create index if not exists sales_business_created_idx on public.sales(business_id, created_at desc);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id),
  name text not null,
  quantity numeric(12,3) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists sale_items_sale_id_idx on public.sale_items(sale_id);
create index if not exists sale_items_business_id_idx on public.sale_items(business_id);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan_id text not null,
  status public.subscription_status not null default 'trialing',
  current_period_start timestamptz,
  current_period_end timestamptz,
  provider text not null default 'mercadopago',
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id)
);

create index if not exists subscriptions_status_idx on public.subscriptions(status);

-- Una sola fila (id = 1). Cambiá subscription_trial_interval para pruebas (ej. '5 minutes') o producción ('7 days').
create table if not exists public.platform_settings (
  id smallint primary key default 1 check (id = 1),
  subscription_trial_interval interval not null default interval '7 days',
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id, subscription_trial_interval)
values (1, interval '7 days')
on conflict (id) do nothing;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider text not null default 'mercadopago',
  provider_payment_id text,
  amount numeric(12,2) not null,
  currency text not null default 'ARS',
  status text not null,
  raw jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payments_business_created_idx on public.payments(business_id, created_at desc);

create index if not exists cash_registers_business_opened_idx on public.cash_registers(business_id, opened_at desc);
create index if not exists sales_cash_register_idx on public.sales(cash_register_id);

-- PERFORMANCE:Índice para cierre de caja (filtra por status='paid')
create index if not exists sales_register_paid_idx on public.sales(cash_register_id, status) where status = 'paid';

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  cash_register_id uuid references public.cash_registers(id) on delete set null,
  movement_type text not null check (movement_type in ('in', 'out')),
  payment_method text not null check (payment_method in ('cash', 'card', 'transfer', 'mercadopago')),
  amount numeric(12,2) not null check (amount > 0),
  reason text not null,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists cash_movements_business_created_idx on public.cash_movements(business_id, created_at desc);
create index if not exists cash_movements_register_idx on public.cash_movements(cash_register_id);
-- PERFORMANCE:Índice para cálculo de totales por método en cierre de caja
create index if not exists cash_movements_register_method_idx on public.cash_movements(cash_register_id, movement_type, payment_method);

create table if not exists public.fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null check (amount > 0),
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  category text,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fixed_expenses_business_idx on public.fixed_expenses(business_id, created_at desc);

alter table public.businesses enable row level security;
alter table public.memberships enable row level security;
alter table public.products enable row level security;
alter table public.business_tables enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.cash_registers enable row level security;
alter table public.cash_movements enable row level security;
alter table public.fixed_expenses enable row level security;
alter table public.platform_settings enable row level security;

create or replace function public.is_business_member(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists(
    select 1
    from public.memberships m
    where m.business_id = bid
      and m.user_id = auth.uid()
      and m.deleted_at is null
  );
$$;

revoke all on function public.is_business_member(uuid) from public;
grant execute on function public.is_business_member(uuid) to authenticated;

create or replace function public.create_business_with_owner(
  p_name text,
  p_slug text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_trial interval;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- Si falta platform_settings (proyecto sin migrar), usar 3 días y no abortar el alta.
  begin
    select subscription_trial_interval into v_trial from public.platform_settings where id = 1;
    v_trial := coalesce(v_trial, interval '3 days');
  exception
    when sqlstate '42P01' then
      v_trial := interval '3 days';
  end;

  insert into public.businesses (name, slug)
  values (p_name, p_slug)
  returning id into v_business_id;

  insert into public.memberships (business_id, user_id, role)
  values (v_business_id, auth.uid(), 'owner');

  insert into public.subscriptions (
    business_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    provider
  )
  values (
    v_business_id,
    'standard',
    'trialing',
    now(),
    now() + v_trial,
    'mercadopago'
  );

  return v_business_id;
end;
$$;

revoke all on function public.create_business_with_owner(text, text) from public;
grant execute on function public.create_business_with_owner(text, text) to authenticated;

-- Si un negocio no tiene fila en subscriptions (alta manual, datos viejos), crea trial con platform_settings.
create or replace function public.ensure_subscription_trial_for_business(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trial interval;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_business_member(p_business_id) then
    raise exception 'not_authorized';
  end if;

  if exists (select 1 from public.subscriptions s where s.business_id = p_business_id) then
    return;
  end if;

  begin
    select subscription_trial_interval into v_trial from public.platform_settings where id = 1;
    v_trial := coalesce(v_trial, interval '3 days');
  exception
    when sqlstate '42P01' then
      v_trial := interval '3 days';
  end;

  insert into public.subscriptions (
    business_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    provider
  )
  values (
    p_business_id,
    'standard',
    'trialing',
    now(),
    now() + v_trial,
    'mercadopago'
  );
end;
$$;

revoke all on function public.ensure_subscription_trial_for_business(uuid) from public;
grant execute on function public.ensure_subscription_trial_for_business(uuid) to authenticated;

create or replace function public.create_sale_with_items(
  p_business_id uuid,
  p_payment_method text,
  p_payment_details jsonb,
  p_items jsonb
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

  select cr.id
    into v_open_register_id
  from public.cash_registers cr
  where cr.business_id = p_business_id
    and cr.closed_at is null
  order by cr.opened_at desc
  limit 1;

  insert into public.sales (business_id, cashier_user_id, total, payment_method, payment_details, status)
  values (p_business_id, auth.uid(), 0, p_payment_method, p_payment_details, 'paid')
  returning id into v_sale_id;

  if v_open_register_id is not null then
    update public.sales
      set cash_register_id = v_open_register_id
    where id = v_sale_id;
  end if;

  v_sale_total := 0;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'product_id', '')::uuid;
    v_name := coalesce(nullif(v_item->>'name', ''), 'Producto');
    v_qty := coalesce((v_item->>'quantity')::numeric, 0);
    v_unit_price := coalesce((v_item->>'unit_price')::numeric, 0);

    if v_product_id is null then
      raise exception 'missing_product_id';
    end if;
    if v_qty <= 0 then
      raise exception 'invalid_quantity';
    end if;

    select p.sold_by_weight, p.stock, p.stock_decimal
      into v_sold_by_weight, v_stock_int, v_stock_dec
    from public.products p
    where p.id = v_product_id
      and p.business_id = p_business_id
    for update;

    if not found then
      raise exception 'product_not_found';
    end if;

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

  update public.sales
    set total = v_sale_total
  where id = v_sale_id;

  return v_sale_id;
end;
$$;

create or replace function public.open_cash_register(
  p_business_id uuid,
  p_opening_amount numeric,
  p_shift_start_at time default null,
  p_shift_end_at time default null,
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
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_business_member(p_business_id) then
    raise exception 'not_authorized';
  end if;
  if coalesce(p_opening_amount, 0) < 0 then
    raise exception 'invalid_opening_amount';
  end if;

  if exists (
    select 1 from public.cash_registers cr
    where cr.business_id = p_business_id
      and cr.closed_at is null
  ) then
    raise exception 'cash_register_already_open';
  end if;

  insert into public.cash_registers (
    business_id,
    opened_by,
    opening_amount,
    shift_start_at,
    shift_end_at,
    notes
  )
  values (
    p_business_id,
    auth.uid(),
    coalesce(p_opening_amount, 0),
    p_shift_start_at,
    p_shift_end_at,
    nullif(p_notes, '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.close_cash_register(
  p_business_id uuid,
  p_cash_register_id uuid,
  p_closing_amount numeric,
  p_notes text default null
)
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
  if coalesce(p_closing_amount, 0) < 0 then
    raise exception 'invalid_closing_amount';
  end if;

  update public.cash_registers
    set closed_at = now(),
        closed_by = auth.uid(),
        closing_amount = coalesce(p_closing_amount, 0),
        notes = coalesce(nullif(p_notes, ''), notes)
  where id = p_cash_register_id
    and business_id = p_business_id
    and closed_at is null;

  if not found then
    raise exception 'cash_register_not_open';
  end if;
end;
$$;

create or replace function public.auto_close_stale_cash_registers(
  p_business_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_register record;
  v_now_ar timestamp without time zone;
  v_current_date_ar date;
  v_closed_count integer := 0;
  v_expected_cash numeric(12,2);
  v_expected_card numeric(12,2);
  v_expected_transfer numeric(12,2);
  v_expected_mp numeric(12,2);
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_business_member(p_business_id) then
    raise exception 'not_authorized';
  end if;

  v_now_ar := now() at time zone 'America/Argentina/Buenos_Aires';
  v_current_date_ar := v_now_ar::date;

  for v_register in
    select
      cr.id,
      coalesce(cr.opening_amount, 0)::numeric(12,2) as opening_amount,
      (cr.opened_at at time zone 'America/Argentina/Buenos_Aires')::date as opened_date_ar
    from public.cash_registers cr
    where cr.business_id = p_business_id
      and cr.closed_at is null
      and (cr.opened_at at time zone 'America/Argentina/Buenos_Aires')::date < v_current_date_ar
    order by cr.opened_at asc
  loop
    select
      coalesce(sum(case
        when s.status = 'paid' and s.payment_method = 'cash' then s.total
        when s.status = 'paid' and s.payment_method = 'mixed' and sp->>'method' = 'cash' then coalesce((sp->>'amount')::numeric, 0)
        else 0 end), 0),
      coalesce(sum(case
        when s.status = 'paid' and s.payment_method = 'card' then s.total
        when s.status = 'paid' and s.payment_method = 'mixed' and sp->>'method' = 'card' then coalesce((sp->>'amount')::numeric, 0)
        else 0 end), 0),
      coalesce(sum(case
        when s.status = 'paid' and s.payment_method = 'transfer' then s.total
        when s.status = 'paid' and s.payment_method = 'mixed' and sp->>'method' = 'transfer' then coalesce((sp->>'amount')::numeric, 0)
        else 0 end), 0),
      coalesce(sum(case
        when s.status = 'paid' and s.payment_method = 'mercadopago' then s.total
        when s.status = 'paid' and s.payment_method = 'mixed' and sp->>'method' = 'mercadopago' then coalesce((sp->>'amount')::numeric, 0)
        else 0 end), 0)
    into v_expected_cash, v_expected_card, v_expected_transfer, v_expected_mp
    from public.sales s
    left join lateral jsonb_array_elements(coalesce(s.payment_details->'split', '[]'::jsonb)) sp on s.payment_method = 'mixed'
    where s.business_id = p_business_id
      and s.cash_register_id = v_register.id;

    select
      v_expected_cash + coalesce(sum(case when movement_type = 'in' and payment_method = 'cash' then amount when movement_type = 'out' and payment_method = 'cash' then -amount else 0 end), 0),
      v_expected_card + coalesce(sum(case when movement_type = 'in' and payment_method = 'card' then amount when movement_type = 'out' and payment_method = 'card' then -amount else 0 end), 0),
      v_expected_transfer + coalesce(sum(case when movement_type = 'in' and payment_method = 'transfer' then amount when movement_type = 'out' and payment_method = 'transfer' then -amount else 0 end), 0),
      v_expected_mp + coalesce(sum(case when movement_type = 'in' and payment_method = 'mercadopago' then amount when movement_type = 'out' and payment_method = 'mercadopago' then -amount else 0 end), 0)
    into v_expected_cash, v_expected_card, v_expected_transfer, v_expected_mp
    from public.cash_movements cm
    where cm.business_id = p_business_id
      and cm.cash_register_id = v_register.id;

    v_expected_cash := v_register.opening_amount + coalesce(v_expected_cash, 0);

    update public.cash_registers
      set closed_at = now(),
          closed_by = auth.uid(),
          closing_amount = round(coalesce(v_expected_cash, 0), 2),
          expected_totals = jsonb_build_object(
            'cash', round(coalesce(v_expected_cash, 0), 2),
            'card', round(coalesce(v_expected_card, 0), 2),
            'transfer', round(coalesce(v_expected_transfer, 0), 2),
            'mercadopago', round(coalesce(v_expected_mp, 0), 2)
          ),
          closing_totals = jsonb_build_object(
            'cash', round(coalesce(v_expected_cash, 0), 2),
            'card', round(coalesce(v_expected_card, 0), 2),
            'transfer', round(coalesce(v_expected_transfer, 0), 2),
            'mercadopago', round(coalesce(v_expected_mp, 0), 2)
          ),
          difference_totals = jsonb_build_object(
            'cash', 0,
            'card', 0,
            'transfer', 0,
            'mercadopago', 0
          ),
          notes = trim(
            coalesce(nullif(notes, ''), '') ||
            case when nullif(notes, '') is null then '' else ' | ' end ||
            'Cierre automatico por cambio de dia'
          )
    where id = v_register.id
      and closed_at is null;

    if found then
      v_closed_count := v_closed_count + 1;
    end if;
  end loop;

  return v_closed_count;
end;
$$;

create or replace function public.close_cash_register(
  p_business_id uuid,
  p_cash_register_id uuid,
  p_closing_amount numeric,
  p_closing_totals jsonb,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_opening_amount numeric(12,2);
  v_expected_cash numeric(12,2);
  v_expected_card numeric(12,2);
  v_expected_transfer numeric(12,2);
  v_expected_mp numeric(12,2);
  v_counted_cash numeric(12,2);
  v_counted_card numeric(12,2);
  v_counted_transfer numeric(12,2);
  v_counted_mp numeric(12,2);
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_business_member(p_business_id) then
    raise exception 'not_authorized';
  end if;
  if coalesce(p_closing_amount, 0) < 0 then
    raise exception 'invalid_closing_amount';
  end if;

  select coalesce(cr.opening_amount, 0)
    into v_opening_amount
  from public.cash_registers cr
  where cr.id = p_cash_register_id
    and cr.business_id = p_business_id
    and cr.closed_at is null
  for update;

  if not found then
    raise exception 'cash_register_not_open';
  end if;

  select
    coalesce(sum(case
      when s.status = 'paid' and s.payment_method = 'cash' then s.total
      when s.status = 'paid' and s.payment_method = 'mixed' and sp->>'method' = 'cash' then coalesce((sp->>'amount')::numeric, 0)
      else 0 end), 0),
    coalesce(sum(case
      when s.status = 'paid' and s.payment_method = 'card' then s.total
      when s.status = 'paid' and s.payment_method = 'mixed' and sp->>'method' = 'card' then coalesce((sp->>'amount')::numeric, 0)
      else 0 end), 0),
    coalesce(sum(case
      when s.status = 'paid' and s.payment_method = 'transfer' then s.total
      when s.status = 'paid' and s.payment_method = 'mixed' and sp->>'method' = 'transfer' then coalesce((sp->>'amount')::numeric, 0)
      else 0 end), 0),
    coalesce(sum(case
      when s.status = 'paid' and s.payment_method = 'mercadopago' then s.total
      when s.status = 'paid' and s.payment_method = 'mixed' and sp->>'method' = 'mercadopago' then coalesce((sp->>'amount')::numeric, 0)
      else 0 end), 0)
  into v_expected_cash, v_expected_card, v_expected_transfer, v_expected_mp
  from public.sales s
  left join lateral jsonb_array_elements(coalesce(s.payment_details->'split', '[]'::jsonb)) sp on s.payment_method = 'mixed'
  where s.business_id = p_business_id
    and s.cash_register_id = p_cash_register_id;

  select
    v_expected_cash + coalesce(sum(case when movement_type = 'in' and payment_method = 'cash' then amount when movement_type = 'out' and payment_method = 'cash' then -amount else 0 end), 0),
    v_expected_card + coalesce(sum(case when movement_type = 'in' and payment_method = 'card' then amount when movement_type = 'out' and payment_method = 'card' then -amount else 0 end), 0),
    v_expected_transfer + coalesce(sum(case when movement_type = 'in' and payment_method = 'transfer' then amount when movement_type = 'out' and payment_method = 'transfer' then -amount else 0 end), 0),
    v_expected_mp + coalesce(sum(case when movement_type = 'in' and payment_method = 'mercadopago' then amount when movement_type = 'out' and payment_method = 'mercadopago' then -amount else 0 end), 0)
  into v_expected_cash, v_expected_card, v_expected_transfer, v_expected_mp
  from public.cash_movements cm
  where cm.business_id = p_business_id
    and cm.cash_register_id = p_cash_register_id;

  v_expected_cash := v_opening_amount + coalesce(v_expected_cash, 0);

  v_counted_cash := coalesce((p_closing_totals->>'cash')::numeric, p_closing_amount, 0);
  v_counted_card := coalesce((p_closing_totals->>'card')::numeric, 0);
  v_counted_transfer := coalesce((p_closing_totals->>'transfer')::numeric, 0);
  v_counted_mp := coalesce((p_closing_totals->>'mercadopago')::numeric, 0);

  update public.cash_registers
    set closed_at = now(),
        closed_by = auth.uid(),
        closing_amount = v_counted_cash,
        expected_totals = jsonb_build_object(
          'cash', round(v_expected_cash, 2),
          'card', round(v_expected_card, 2),
          'transfer', round(v_expected_transfer, 2),
          'mercadopago', round(v_expected_mp, 2)
        ),
        closing_totals = jsonb_build_object(
          'cash', round(v_counted_cash, 2),
          'card', round(v_counted_card, 2),
          'transfer', round(v_counted_transfer, 2),
          'mercadopago', round(v_counted_mp, 2)
        ),
        difference_totals = jsonb_build_object(
          'cash', round(v_counted_cash - v_expected_cash, 2),
          'card', round(v_counted_card - v_expected_card, 2),
          'transfer', round(v_counted_transfer - v_expected_transfer, 2),
          'mercadopago', round(v_counted_mp - v_expected_mp, 2)
        ),
        notes = coalesce(nullif(p_notes, ''), notes)
  where id = p_cash_register_id
    and business_id = p_business_id
    and closed_at is null;

  if not found then
    raise exception 'cash_register_not_open';
  end if;
end;
$$;

create or replace function public.create_cash_movement(
  p_business_id uuid,
  p_cash_register_id uuid,
  p_movement_type text,
  p_payment_method text,
  p_amount numeric,
  p_reason text,
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
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_business_member(p_business_id) then
    raise exception 'not_authorized';
  end if;
  if p_movement_type not in ('in', 'out') then
    raise exception 'invalid_movement_type';
  end if;
  if p_payment_method not in ('cash', 'card', 'transfer', 'mercadopago') then
    raise exception 'invalid_payment_method';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'invalid_amount';
  end if;
  if coalesce(length(trim(p_reason)), 0) = 0 then
    raise exception 'missing_reason';
  end if;

  if not exists (
    select 1
    from public.cash_registers cr
    where cr.id = p_cash_register_id
      and cr.business_id = p_business_id
      and cr.closed_at is null
  ) then
    raise exception 'cash_register_not_open';
  end if;

  insert into public.cash_movements (
    business_id,
    cash_register_id,
    movement_type,
    payment_method,
    amount,
    reason,
    notes,
    created_by
  )
  values (
    p_business_id,
    p_cash_register_id,
    p_movement_type,
    p_payment_method,
    p_amount,
    trim(p_reason),
    nullif(p_notes, ''),
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.void_sale(
  p_business_id uuid,
  p_sale_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_status text;
  v_item record;
  v_sold_by_weight boolean;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_business_member(p_business_id) then
    raise exception 'not_authorized';
  end if;

  select s.status
    into v_status
  from public.sales s
  where s.id = p_sale_id
    and s.business_id = p_business_id
  for update;

  if not found then
    raise exception 'sale_not_found';
  end if;

  if v_status <> 'paid' then
    raise exception 'sale_not_paid';
  end if;

  for v_item in
    select si.product_id, si.quantity
    from public.sale_items si
    where si.sale_id = p_sale_id
      and si.business_id = p_business_id
  loop
    if v_item.product_id is null then
      continue;
    end if;

    select p.sold_by_weight
      into v_sold_by_weight
    from public.products p
    where p.id = v_item.product_id
      and p.business_id = p_business_id
    for update;

    if not found then
      continue;
    end if;

    if v_sold_by_weight then
      update public.products
        set stock_decimal = stock_decimal + v_item.quantity,
            updated_at = now()
      where id = v_item.product_id
        and business_id = p_business_id;
    else
      update public.products
        set stock = stock + ceil(v_item.quantity)::int,
            updated_at = now()
      where id = v_item.product_id
        and business_id = p_business_id;
    end if;
  end loop;

  update public.sales
    set status = 'voided'
  where id = p_sale_id
    and business_id = p_business_id;
end;
$$;

revoke all on function public.create_sale_with_items(uuid, text, jsonb, jsonb) from public;
grant execute on function public.create_sale_with_items(uuid, text, jsonb, jsonb) to authenticated;

revoke all on function public.void_sale(uuid, uuid) from public;
grant execute on function public.void_sale(uuid, uuid) to authenticated;

revoke all on function public.open_cash_register(uuid, numeric, time, time, text) from public;
grant execute on function public.open_cash_register(uuid, numeric, time, time, text) to authenticated;

revoke all on function public.close_cash_register(uuid, uuid, numeric, text) from public;
grant execute on function public.close_cash_register(uuid, uuid, numeric, text) to authenticated;

revoke all on function public.close_cash_register(uuid, uuid, numeric, jsonb, text) from public;
grant execute on function public.close_cash_register(uuid, uuid, numeric, jsonb, text) to authenticated;

revoke all on function public.auto_close_stale_cash_registers(uuid) from public;
grant execute on function public.auto_close_stale_cash_registers(uuid) to authenticated;

revoke all on function public.create_cash_movement(uuid, uuid, text, text, numeric, text, text) from public;
grant execute on function public.create_cash_movement(uuid, uuid, text, text, numeric, text, text) to authenticated;

create policy businesses_select on public.businesses
for select
to authenticated
using (public.is_business_member(id));

create policy businesses_update on public.businesses
for update
to authenticated
using (public.is_business_member(id));

create policy memberships_select on public.memberships
for select
to authenticated
using (auth.uid() = user_id or public.is_business_member(business_id));

create policy memberships_insert on public.memberships
for insert
to authenticated
with check (auth.uid() = user_id);

create policy products_all on public.products
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

create policy business_tables_all on public.business_tables
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

create policy sales_all on public.sales
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

create policy sale_items_all on public.sale_items
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

create policy subscriptions_all on public.subscriptions
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

create policy payments_all on public.payments
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

create policy cash_registers_all on public.cash_registers
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

create policy cash_movements_all on public.cash_movements
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

create policy fixed_expenses_all on public.fixed_expenses
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_business_owner(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists(
    select 1
    from public.memberships m
    where m.business_id = bid
      and m.user_id = auth.uid()
      and m.role = 'owner'
      and m.deleted_at is null
  );
$$;

revoke all on function public.is_business_owner(uuid) from public;
grant execute on function public.is_business_owner(uuid) to authenticated;

create policy profiles_select on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or exists(
    select 1
    from public.memberships m_me
    join public.memberships m_other on m_other.business_id = m_me.business_id
    where m_me.user_id = auth.uid()
      and m_other.user_id = profiles.id
  )
);

create policy profiles_update_self on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy profiles_insert_self on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists memberships_insert on public.memberships;

create policy memberships_insert on public.memberships
for insert
to authenticated
with check (
  auth.uid() = user_id
  or public.is_business_owner(business_id)
);

create policy memberships_update on public.memberships
for update
to authenticated
using (public.is_business_owner(business_id))
with check (public.is_business_owner(business_id));

create policy memberships_delete on public.memberships
for delete
to authenticated
using (public.is_business_owner(business_id));

-- Datos del negocio para ticket
alter table public.businesses add column if not exists address text;
alter table public.businesses add column if not exists phone text;
alter table public.businesses add column if not exists cuit text;
alter table public.businesses add column if not exists business_type text not null default 'retail';
alter table public.businesses add column if not exists ticket_header text;
alter table public.businesses add column if not exists ticket_footer text default '¡Gracias por su compra!';

alter table public.memberships add column if not exists permissions jsonb not null default '{}'::jsonb;

alter table public.memberships add column if not exists deleted_at timestamptz;
alter table public.memberships add column if not exists deleted_by uuid references auth.users(id);

alter table public.profiles add column if not exists avatar text;

alter table public.cash_registers add column if not exists shift_start_at time;
alter table public.cash_registers add column if not exists shift_end_at time;
alter table public.cash_registers add column if not exists expected_totals jsonb;
alter table public.cash_registers add column if not exists closing_totals jsonb;
alter table public.cash_registers add column if not exists difference_totals jsonb;

-- Permisos base (sin esto: "permission denied for table businesses" con RLS)
grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables in schema public to postgres, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

grant all on all sequences in schema public to postgres, authenticated, service_role;

grant all on all routines in schema public to postgres, service_role;
grant execute on all functions in schema public to authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant execute on functions to authenticated, service_role;

