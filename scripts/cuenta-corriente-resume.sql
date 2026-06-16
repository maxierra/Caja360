-- Reanudar 20260330120000 si falló en "policy business_customers_all already exists"
-- (tablas creadas antes por pos_checkout_rpc). Pegá y ejecutá en SQL Editor.

drop policy if exists business_customers_all on public.business_customers;
create policy business_customers_all on public.business_customers
for all to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

-- Desde aquí: mismo contenido que el archivo original desde la sección 3 en adelante.
-- Ejecutá el resto del archivo 20260330120000_cuenta_corriente_clientes.sql
-- empezando en la línea "-- 3) Cobros de deuda"
