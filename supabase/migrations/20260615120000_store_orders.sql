-- Tienda landing: productos, pedidos, provisión lifetime, envíos hardware

create table if not exists public.store_products (
  sku text primary key,
  name text not null,
  price_ars numeric(12, 2) not null check (price_ars > 0),
  includes_hardware boolean not null default false,
  hardware_summary text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  product_sku text not null references public.store_products(sku),
  amount_ars numeric(12, 2) not null,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'canceled', 'refunded')),
  email text not null,
  customer_name text not null,
  phone text not null,
  business_name text not null,
  business_type text not null default 'retail'
    check (business_type in ('retail', 'fashion', 'gastronomy')),
  shipping_address text,
  shipping_city text,
  shipping_province text,
  shipping_postal_code text,
  shipping_notes text,
  fulfillment_status text not null default 'not_applicable'
    check (fulfillment_status in ('not_applicable', 'pending_shipment', 'shipped', 'delivered')),
  tracking_number text,
  tracking_carrier text,
  shipped_at timestamptz,
  mp_preference_id text,
  mp_payment_id text,
  provisioned_user_id uuid references auth.users(id) on delete set null,
  provisioned_business_id uuid references public.businesses(id) on delete set null,
  provisioned_at timestamptz,
  tracking_token uuid not null default gen_random_uuid(),
  welcome_email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_orders_email_idx on public.store_orders(lower(email));
create index if not exists store_orders_status_idx on public.store_orders(status, created_at desc);
create index if not exists store_orders_fulfillment_idx on public.store_orders(fulfillment_status, created_at desc);
create unique index if not exists store_orders_tracking_token_idx on public.store_orders(tracking_token);
create index if not exists store_orders_mp_payment_idx on public.store_orders(mp_payment_id) where mp_payment_id is not null;

-- Seed catálogo (precios alineados a landing)
insert into public.store_products (sku, name, price_ars, includes_hardware, hardware_summary, sort_order)
values
  ('software_lifetime', 'Software POS — Licencia de por vida', 150000, false, null, 0),
  ('combo_essential', 'Combo esencial + software lifetime', 250000, true, 'Lector + impresora térmica básicos', 10),
  ('combo_initial', 'Combo inicial + software lifetime', 599000, true, 'Mostrador completo para empezar', 20),
  ('combo_commerce', 'Combo comercio + software lifetime', 699000, true, 'Mini POS completo', 30),
  ('combo_advanced', 'Combo avanzado + software lifetime', 1399000, true, 'PC táctil completa', 40)
on conflict (sku) do update set
  name = excluded.name,
  price_ars = excluded.price_ars,
  includes_hardware = excluded.includes_hardware,
  hardware_summary = excluded.hardware_summary,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Negocio + owner + suscripción lifetime (sin trial). Solo service_role / webhook.
create or replace function public.create_business_paid_owner(
  p_name text,
  p_slug text,
  p_user_id uuid,
  p_business_type text default 'retail'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  if p_user_id is null then
    raise exception 'user_id_required';
  end if;

  insert into public.businesses (name, slug, business_type)
  values (p_name, p_slug, coalesce(nullif(trim(p_business_type), ''), 'retail'))
  returning id into v_business_id;

  insert into public.memberships (business_id, user_id, role)
  values (v_business_id, p_user_id, 'owner');

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
    'lifetime',
    'active',
    now(),
    null,
    'store_lifetime'
  );

  return v_business_id;
end;
$$;

revoke all on function public.create_business_paid_owner(text, text, uuid, text) from public;
grant execute on function public.create_business_paid_owner(text, text, uuid, text) to service_role;

-- Buscar usuario por email (checkout / provisión)
create or replace function public.get_auth_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

revoke all on function public.get_auth_user_id_by_email(text) from public;
grant execute on function public.get_auth_user_id_by_email(text) to service_role;

alter table public.store_products enable row level security;
alter table public.store_orders enable row level security;

-- Catálogo público lectura
drop policy if exists store_products_public_read on public.store_products;
create policy store_products_public_read on public.store_products
  for select using (is_active = true);

-- Pedidos: solo miembros del negocio provisionado (si aplica)
drop policy if exists store_orders_member_read on public.store_orders;
create policy store_orders_member_read on public.store_orders
  for select using (
    provisioned_business_id is not null
    and public.is_business_member(provisioned_business_id)
  );
