-- Permite que una promoción por cantidad apunte a productos específicos
-- o a categorías completas del catálogo.

alter table public.promotion_rules
  add column if not exists target_mode text not null default 'products'
    check (target_mode in ('products', 'categories')),
  add column if not exists category_filters text[] default null;
