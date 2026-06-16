-- Cuenta corriente como medio de pago por defecto (5º método en POS y configuración).

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

revoke all on function public.ensure_business_payment_methods(uuid) from public;
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
