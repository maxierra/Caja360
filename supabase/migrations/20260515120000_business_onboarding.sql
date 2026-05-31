-- Recorrido inicial (wizard): NULL hasta que el dueño marca fin tras la primera venta.
alter table public.businesses
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.businesses.onboarding_completed_at is
  'Primera vez: null hasta completar el onboarding (felicitación post-primer venta).';

-- Negocios que ya tienen datos no pasan por el wizard obligatorio.
update public.businesses b
set onboarding_completed_at = now(),
    updated_at = now()
where b.onboarding_completed_at is null
  and (
    exists (select 1 from public.products p where p.business_id = b.id)
    or exists (select 1 from public.sales s where s.business_id = b.id)
  );
