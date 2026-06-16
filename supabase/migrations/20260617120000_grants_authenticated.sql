-- Corrige "permission denied for table businesses" en proyectos Supabase nuevos
-- Ejecutar en SQL Editor del proyecto TEST después de schema.sql

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

-- RPC de alta de negocio (por si el schema se cortó antes de los grants)
grant execute on function public.create_business_with_owner(text, text) to authenticated;
grant execute on function public.is_business_member(uuid) to authenticated;
