-- Alinear precio del combo con flyers de marketing ($350.000)
UPDATE public.store_products
SET
  name = 'Combo Punto de Venta',
  price_ars = 350000
WHERE sku = 'combo_essential';

UPDATE public.store_products
SET name = 'Software POS TIENDA360'
WHERE sku = 'software_lifetime';
