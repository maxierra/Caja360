alter table public.business_tables enable row level security;

drop policy if exists business_tables_all on public.business_tables;

create policy business_tables_all on public.business_tables
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));
