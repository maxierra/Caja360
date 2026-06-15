alter table public.businesses
  add column if not exists business_type text not null default 'retail'
  check (business_type in ('retail', 'fashion', 'gastronomy'));

comment on column public.businesses.business_type is
  'Perfil operativo del comercio. retail = lector/pesables, fashion = catalogo con variantes, gastronomy = catalogo por categorias.';
