-- Phase 3: the catalogue — a read projection of Juleb.
--
-- Juleb owns the truth (§1). These tables are a cache the storefront reads and
-- the sync functions write. Nothing a shopper does writes here.

create table public.branches (
  id                   uuid primary key default gen_random_uuid(),
  juleb_branch_id      text unique,
  name                 text not null,
  county               text,
  -- Pharmacy and Poisons Board licence, surfaced in the UI (§11).
  ppb_licence_no       text,
  pharmacist_in_charge text,
  is_active            boolean not null default true,
  synced_at            timestamptz
);

create table public.products (
  id                     uuid primary key default gen_random_uuid(),
  juleb_product_id       text not null unique,
  slug                   text not null unique,
  name                   text not null,
  generic_name           text,
  brand_name             text,
  form                   text,
  strength               text,
  pack_size              text,
  -- Price suffix ("/pack", "/bottle"); see docs/product/ux-reference-mydawa.md.
  unit_label             text not null default 'piece',
  -- A closed vocabulary. The mapper refuses unknown values rather than
  -- defaulting to over-the-counter (packages/juleb/src/mappers.ts).
  dispensing_class       text not null
    check (dispensing_class in ('otc', 'pom', 'controlled')),
  -- Derived, never set independently. As ordinary columns a product could be
  -- classed 'pom' yet flagged as not needing a prescription — and the §3.2 gate
  -- keys off this flag. A generated column makes that impossible.
  requires_prescription  boolean generated always as (dispensing_class <> 'otc') stored,
  is_controlled          boolean generated always as (dispensing_class = 'controlled') stored,
  price_minor            bigint not null check (price_minor >= 0),
  compare_at_price_minor bigint
    check (compare_at_price_minor is null or compare_at_price_minor > price_minor),
  vat_rate_bp            int not null default 0 check (vat_rate_bp between 0 and 10000),
  image_url              text,
  category_ids           text[] not null default '{}',
  condition_ids          text[] not null default '{}',
  is_active              boolean not null default true,
  -- Patients search by brand and by generic name ("Panadol", "paracetamol"),
  -- so both are weighted into one index. 'simple' rather than 'english': drug
  -- names are not English words and stemming mangles them.
  search                 tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(brand_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(generic_name, '')), 'B')
  ) stored,
  synced_at              timestamptz
);

create index products_search_idx on public.products using gin (search);
create index products_category_idx on public.products using gin (category_ids);
create index products_condition_idx on public.products using gin (condition_ids);

-- Availability per branch. Advisory only (§3.7): stale by definition, and
-- re-validated against Juleb when an order is placed.
create table public.inventory_levels (
  branch_id     uuid not null references public.branches on delete cascade,
  product_id    uuid not null references public.products on delete cascade,
  qty_available int not null default 0 check (qty_available >= 0),
  synced_at     timestamptz not null default now(),
  primary key (branch_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Search
-- ---------------------------------------------------------------------------

-- Prefix search, so "parac" finds paracetamol while the shopper is typing.
--
-- Input is reduced to letters, digits and spaces before it reaches to_tsquery.
-- to_tsquery has its own operator syntax; a stray "&" or ":" from a shopper
-- would otherwise be a syntax error rather than an empty result.
create or replace function public.search_products(q text)
returns setof public.products
language sql
stable
set search_path = ''
as $fn$
  with cleaned as (
    select trim(regexp_replace(coalesce(q, ''), '[^[:alnum:][:space:]]', ' ', 'g')) as term
  ),
  query as (
    select case
      when (select term from cleaned) = '' then null
      else to_tsquery(
        'simple',
        regexp_replace((select term from cleaned), '[[:space:]]+', ':* & ', 'g') || ':*'
      )
    end as tsq
  )
  select p.*
  from public.products p, query
  where query.tsq is not null
    and p.is_active
    and p.search @@ query.tsq
  order by ts_rank(p.search, query.tsq) desc, p.name;
$fn$;

-- ---------------------------------------------------------------------------
-- Row Level Security (§3.3)
-- ---------------------------------------------------------------------------
--
-- The catalogue is genuinely public, so reads are open — explicitly, by policy,
-- not by default. There are deliberately no insert, update or delete policies:
-- only the sync functions write here, and they run as the service role, which
-- bypasses RLS. A shopper's session can read the shelf but never change it.

alter table public.branches         enable row level security;
alter table public.products         enable row level security;
alter table public.inventory_levels enable row level security;

alter table public.branches         force row level security;
alter table public.products         force row level security;
alter table public.inventory_levels force row level security;

create policy branches_public_read on public.branches
  for select using (is_active);

-- Staff also see inactive branches, for the admin view.
create policy branches_staff_read on public.branches
  for select using (public.is_staff());

create policy products_public_read on public.products
  for select using (is_active);

create policy products_staff_read on public.products
  for select using (public.is_staff());

create policy inventory_public_read on public.inventory_levels
  for select using (true);
