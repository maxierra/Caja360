alter table public.products
  add column if not exists variant_group text,
  add column if not exists size text,
  add column if not exists color text;

comment on column public.products.variant_group is
  'Agrupa variantes del mismo producto base, especialmente para indumentaria.';
comment on column public.products.size is
  'Talle o medida de la variante.';
comment on column public.products.color is
  'Color de la variante.';
