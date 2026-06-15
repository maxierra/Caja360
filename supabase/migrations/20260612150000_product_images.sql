alter table public.products
  add column if not exists image_path text,
  add column if not exists image_url text;

comment on column public.products.image_path is 'Ruta del archivo en Supabase Storage para la foto principal del producto.';
comment on column public.products.image_url is 'URL publica de la foto principal del producto.';
