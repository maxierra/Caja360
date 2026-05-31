-- Totales de productos cargados por comercio para el panel admin.

create or replace function public.admin_product_load_totals()
returns table (
  business_id uuid,
  business_name text,
  total_productos bigint
)
language sql
security definer
set search_path = public
as $$
  select
    p.business_id,
    coalesce(b.name, 'Negocio desconocido') as business_name,
    count(*)::bigint as total_productos
  from public.products p
  left join public.businesses b on b.id = p.business_id
  group by p.business_id, b.name
  order by count(*) desc, b.name asc;
$$;

revoke all on function public.admin_product_load_totals() from public;
revoke all on function public.admin_product_load_totals() from anon;
revoke all on function public.admin_product_load_totals() from authenticated;
grant execute on function public.admin_product_load_totals() to service_role;
