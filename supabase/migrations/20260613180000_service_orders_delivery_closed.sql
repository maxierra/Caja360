-- Soft-close delivery orders for daily history (keep row + items instead of delete).

alter table public.service_orders
  add column if not exists closed_at timestamptz;

alter table public.service_orders drop constraint if exists service_orders_status_check;

alter table public.service_orders add constraint service_orders_status_check
  check (status in (
    'occupied', 'preparing', 'served',
    'delivery_new', 'delivery_preparing',
    'delivery_ready', 'delivery_on_the_way',
    'delivery_closed'
  ));

create index if not exists service_orders_delivery_created_idx
  on public.service_orders(business_id, type, created_at desc)
  where type = 'delivery';
