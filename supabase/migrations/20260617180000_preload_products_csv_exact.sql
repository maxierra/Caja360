-- preload_products: esquema igual al CSV / prod (productoId, precioReal, precioOferta).
-- El importador de Supabase exige nombres exactos (camelCase).

drop table if exists public.preload_products;

create table public.preload_products (
  "productoId" bigint,
  ean text not null,
  producto text not null,
  brand text,
  "precioReal" numeric(12, 2),
  "precioOferta" numeric(12, 2),
  cat1 text,
  cat2 text,
  cat3 text
);

create unique index preload_products_ean_idx on public.preload_products (ean);
create index preload_products_producto_idx on public.preload_products (lower(producto));

alter table public.preload_products enable row level security;

drop policy if exists preload_products_read on public.preload_products;
create policy preload_products_read on public.preload_products
for select to authenticated
using (true);

grant select on public.preload_products to authenticated;
