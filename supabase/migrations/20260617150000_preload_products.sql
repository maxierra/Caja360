-- Catálogo compartido por código de barras (EAN). Solo lectura para autocompletar alta de productos.
-- Esquema compatible con IMG_DB.csv y el importador de Supabase (columnas en minúsculas).

create table if not exists public.preload_products (
  productid bigint,
  ean text not null,
  producto text not null,
  brand text,
  precioreal numeric(12, 2),
  preciooferta numeric(12, 2),
  cat1 text,
  cat2 text,
  cat3 text
);

create unique index if not exists preload_products_ean_idx on public.preload_products (ean);
create index if not exists preload_products_producto_idx on public.preload_products (lower(producto));

alter table public.preload_products enable row level security;

drop policy if exists preload_products_read on public.preload_products;
create policy preload_products_read on public.preload_products
for select to authenticated
using (true);

grant select on public.preload_products to authenticated;
