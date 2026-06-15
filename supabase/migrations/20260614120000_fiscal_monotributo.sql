-- ============================================================
-- Fiscal / ARCA (Monotributo Fase 1)
-- ============================================================

-- Configuración fiscal por negocio
create table if not exists public.business_fiscal_config (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  tax_condition text not null default 'monotributo'
    check (tax_condition in ('monotributo', 'ri')),
  cuit text,
  razon_social text,
  domicilio_fiscal text,
  iibb text,
  environment text not null default 'homolog'
    check (environment in ('homolog', 'prod')),
  billing_mode text not null default 'per_sale'
    check (billing_mode in ('per_sale', 'consolidated')),
  default_voucher_type integer not null default 11,
  is_active boolean not null default false,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_fiscal_config_business_idx
  on public.business_fiscal_config(business_id);

-- Puntos de venta AFIP
create table if not exists public.fiscal_points_of_sale (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  environment text not null check (environment in ('homolog', 'prod')),
  pos_number integer not null check (pos_number >= 1 and pos_number <= 99999),
  voucher_types integer[] not null default array[11, 13],
  is_default boolean not null default true,
  last_authorized_numbers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, environment, pos_number)
);

create index if not exists fiscal_points_of_sale_business_idx
  on public.fiscal_points_of_sale(business_id, environment);

-- Certificados (metadata; archivos en Storage)
create table if not exists public.fiscal_certificates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  environment text not null check (environment in ('homolog', 'prod')),
  storage_path_key text not null,
  storage_path_cert text,
  storage_path_csr text not null,
  cuit text not null,
  serial_number text,
  issued_at timestamptz,
  expires_at timestamptz,
  status text not null default 'pending_upload'
    check (status in ('pending_upload', 'active', 'expired', 'revoked')),
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, environment)
);

create index if not exists fiscal_certificates_business_idx
  on public.fiscal_certificates(business_id, environment);

-- Comprobantes fiscales emitidos
create table if not exists public.fiscal_vouchers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  environment text not null check (environment in ('homolog', 'prod')),
  sale_id uuid references public.sales(id) on delete set null,
  voucher_type integer not null,
  pos_number integer not null,
  voucher_number bigint not null,
  concept integer not null default 1 check (concept in (1, 2, 3)),
  issue_date date not null,
  buyer_doc_type integer not null default 99,
  buyer_doc_number text not null default '0',
  buyer_name text,
  currency text not null default 'PES',
  total numeric(12,2) not null,
  cae text,
  cae_expires_at date,
  afip_result jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'voided_nc')),
  billing_mode text not null default 'per_sale'
    check (billing_mode in ('per_sale', 'consolidated')),
  consolidated_period text,
  qr_payload text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fiscal_vouchers_business_date_idx
  on public.fiscal_vouchers(business_id, issue_date desc);
create index if not exists fiscal_vouchers_business_cae_idx
  on public.fiscal_vouchers(business_id, cae) where cae is not null;
create index if not exists fiscal_vouchers_sale_idx
  on public.fiscal_vouchers(sale_id) where sale_id is not null;
create unique index if not exists fiscal_vouchers_unique_number_idx
  on public.fiscal_vouchers(business_id, environment, voucher_type, pos_number, voucher_number);

create table if not exists public.fiscal_voucher_items (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.fiscal_vouchers(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  quantity numeric(12,3) not null default 1,
  unit_price numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists fiscal_voucher_items_voucher_idx
  on public.fiscal_voucher_items(voucher_id);

-- Vínculos NC → comprobante original
create table if not exists public.fiscal_voucher_links (
  id uuid primary key default gen_random_uuid(),
  credit_note_id uuid not null references public.fiscal_vouchers(id) on delete cascade,
  original_voucher_id uuid not null references public.fiscal_vouchers(id) on delete cascade,
  associated_voucher_type integer not null,
  associated_pos_number integer not null,
  associated_voucher_number bigint not null,
  created_at timestamptz not null default now(),
  unique (credit_note_id)
);

-- Pendientes para facturación consolidada (Fase 2)
create table if not exists public.fiscal_pending_consolidation (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  consolidated_period text not null,
  status text not null default 'pending'
    check (status in ('pending', 'invoiced', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (sale_id)
);

create index if not exists fiscal_pending_consolidation_business_period_idx
  on public.fiscal_pending_consolidation(business_id, consolidated_period, status);

-- RLS
alter table public.business_fiscal_config enable row level security;
alter table public.fiscal_points_of_sale enable row level security;
alter table public.fiscal_certificates enable row level security;
alter table public.fiscal_vouchers enable row level security;
alter table public.fiscal_voucher_items enable row level security;
alter table public.fiscal_voucher_links enable row level security;
alter table public.fiscal_pending_consolidation enable row level security;

drop policy if exists business_fiscal_config_all on public.business_fiscal_config;
create policy business_fiscal_config_all on public.business_fiscal_config
  for all to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

drop policy if exists fiscal_points_of_sale_all on public.fiscal_points_of_sale;
create policy fiscal_points_of_sale_all on public.fiscal_points_of_sale
  for all to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

drop policy if exists fiscal_certificates_all on public.fiscal_certificates;
create policy fiscal_certificates_all on public.fiscal_certificates
  for all to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

drop policy if exists fiscal_vouchers_all on public.fiscal_vouchers;
create policy fiscal_vouchers_all on public.fiscal_vouchers
  for all to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

drop policy if exists fiscal_voucher_items_all on public.fiscal_voucher_items;
create policy fiscal_voucher_items_all on public.fiscal_voucher_items
  for all to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

drop policy if exists fiscal_voucher_links_all on public.fiscal_voucher_links;
create policy fiscal_voucher_links_all on public.fiscal_voucher_links
  for select to authenticated
  using (
    exists (
      select 1 from public.fiscal_vouchers v
      where v.id = credit_note_id and public.is_business_member(v.business_id)
    )
  );

drop policy if exists fiscal_pending_consolidation_all on public.fiscal_pending_consolidation;
create policy fiscal_pending_consolidation_all on public.fiscal_pending_consolidation
  for all to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

-- Storage bucket for fiscal certificates (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fiscal-certs',
  'fiscal-certs',
  false,
  1048576,
  array['application/x-pem-file', 'application/octet-stream', 'text/plain', 'application/pkcs10', 'application/x-x509-ca-cert']
)
on conflict (id) do nothing;

-- No public policies: access only via service role from fiscal microservice / server actions
