-- Auditoría de schema: pegá esto en SQL Editor de Supabase (test o prod).
-- Devuelve tablas/funciones que el proyecto espera y no existen en public.

with expected_tables(name) as (
  values
    ('businesses'),
    ('memberships'),
    ('profiles'),
    ('products'),
    ('sales'),
    ('sale_items'),
    ('cash_registers'),
    ('cash_movements'),
    ('fixed_expenses'),
    ('subscriptions'),
    ('payments'),
    ('platform_settings'),
    ('business_tables'),
    ('service_orders'),
    ('service_order_items'),
    ('business_payment_methods'),
    ('business_customers'),
    ('customer_account_payments'),
    ('business_activity_events'),
    ('promotion_rules'),
    ('promotion_rule_products'),
    ('business_suppliers'),
    ('supplier_orders'),
    ('supplier_order_items'),
    ('business_mercadopago_access'),
    ('mercado_pago_pos_pending_sales'),
    ('business_fiscal_config'),
    ('fiscal_points_of_sale'),
    ('fiscal_certificates'),
    ('fiscal_vouchers'),
    ('fiscal_pending_consolidation'),
    ('store_products'),
    ('store_orders'),
    ('preload_products'),
    ('subscription_promo_codes'),
    ('download_events')
),
expected_functions(name) as (
  values
    ('create_business_with_owner'),
    ('create_business_paid_owner'),
    ('ensure_subscription_trial_for_business'),
    ('create_sale_with_items'),
    ('void_sale'),
    ('open_cash_register'),
    ('close_cash_register'),
    ('auto_close_stale_cash_registers'),
    ('create_cash_movement'),
    ('ensure_business_payment_methods'),
    ('customer_balance'),
    ('record_customer_account_payment'),
    ('business_member_emails'),
    ('record_session_activity'),
    ('record_session_end'),
    ('ensure_sale_activity_event'),
    ('ensure_sale_void_activity_event'),
    ('business_mercadopago_qr_ready'),
    ('mercadopago_pos_complete_pending'),
    ('get_mercadopago_pos_checkout_status'),
    ('cancel_mercadopago_pos_checkout'),
    ('get_auth_user_id_by_email'),
    ('admin_product_load_totals')
)
select
  'MISSING_TABLE' as kind,
  e.name as object_name,
  null::text as detail
from expected_tables e
where not exists (
  select 1
  from information_schema.tables t
  where t.table_schema = 'public'
    and t.table_name = e.name
)

union all

select
  'MISSING_FUNCTION' as kind,
  e.name as object_name,
  null::text as detail
from expected_functions e
where not exists (
  select 1
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = e.name
)

union all

select
  'CHECK' as kind,
  'create_sale_with_items' as object_name,
  case
    when exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'create_sale_with_items'
        and pg_catalog.pg_get_function_identity_arguments(p.oid) like '%p_customer_id%'
    ) then 'ok: tiene p_customer_id (5+ args)'
    when exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'create_sale_with_items'
    ) then 'warn: version vieja (sin cliente/promos) — correr pos_checkout o promotion_totals'
    else 'missing'
  end as detail

order by kind, object_name;

-- Historial CLI (solo si usaste `supabase db push`). Si aplicaste SQL a mano, este bloque no hace falta.
do $$
declare
  r record;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise notice 'Sin historial CLI (normal si corriste schema.sql / migraciones en SQL Editor).';
    return;
  end if;

  raise notice '--- Migraciones aplicadas por Supabase CLI ---';
  for r in
    select version, name
    from supabase_migrations.schema_migrations
    order by version
  loop
    raise notice '% — %', r.version, r.name;
  end loop;
end $$;
