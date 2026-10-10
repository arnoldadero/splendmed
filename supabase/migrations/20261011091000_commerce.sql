-- Phase 4/5: orders, prescriptions, payments — and the §3.2 gate.
--
-- The single most important guarantee in this system lives in this file:
-- a prescription-only medicine cannot reach a fulfilment state without a
-- recorded approval by a user who actually holds the pharmacist role. It is a
-- database trigger rather than application code, so no bug, script or
-- privileged session that skips the app can get past it.

create type public.order_status as enum (
  'draft', 'awaiting_payment', 'paid', 'awaiting_rx_review', 'rx_rejected',
  'approved', 'pushed_to_juleb', 'fulfilling', 'out_for_delivery',
  'delivered', 'cancelled', 'refunded'
);

create type public.rx_status as enum
  ('pending', 'approved', 'rejected', 'needs_clarification', 'expired');

create type public.fulfilment_method as enum ('delivery', 'pickup');

create sequence public.order_no_seq;

-- ---------------------------------------------------------------------------
-- Addresses and carts
-- ---------------------------------------------------------------------------

create table public.addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  label      text,
  line1      text not null,
  area       text,
  town       text not null default 'Kisumu',
  county     text not null default 'Kisumu',
  phone      text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.carts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users on delete cascade,
  updated_at timestamptz not null default now()
);

create table public.cart_items (
  cart_id    uuid not null references public.carts on delete cascade,
  product_id uuid not null references public.products on delete cascade,
  quantity   int not null check (quantity between 1 and 20),
  primary key (cart_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  order_no            text not null unique default (
    'SM-' || to_char(now(), 'YYMMDD') || '-' || lpad(nextval('public.order_no_seq')::text, 5, '0')
  ),
  user_id             uuid not null references auth.users on delete restrict,
  branch_id           uuid references public.branches,
  status              public.order_status not null default 'draft',
  fulfilment          public.fulfilment_method not null default 'delivery',
  delivery_address_id uuid references public.addresses,
  subtotal_minor      bigint not null default 0 check (subtotal_minor >= 0),
  delivery_fee_minor  bigint not null default 0 check (delivery_fee_minor >= 0),
  total_minor         bigint not null default 0 check (total_minor >= 0),
  currency            char(3) not null default 'KES',
  juleb_order_id      text unique,
  -- Seam for SHA / insurance (§11): out of scope for v1, present so adding it
  -- later is a feature, not a migration under pressure.
  payer               text,
  claim_reference     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint total_is_subtotal_plus_delivery
    check (total_minor = subtotal_minor + delivery_fee_minor)
);

create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status);

create table public.order_items (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references public.orders on delete cascade,
  product_id            uuid not null references public.products,
  quantity              int not null check (quantity > 0),
  unit_price_minor      bigint not null check (unit_price_minor >= 0),
  -- Snapshot of the product's classification when ordered. Set by trigger from
  -- the product row, never from whatever the client sent — and the §3.2 gate
  -- checks it as well as the live product, so reclassifying a medicine as
  -- over-the-counter after the order cannot relax the gate for that order.
  requires_prescription boolean not null default false,
  unique (order_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Prescriptions (PHI — §3.5)
-- ---------------------------------------------------------------------------

create table public.prescriptions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users on delete cascade,
  order_id          uuid references public.orders on delete set null,
  -- An object path in the private bucket. Served only via short-lived signed
  -- URLs; a public URL stored here would be PHI on the open internet.
  storage_path      text not null,
  status            public.rx_status not null default 'pending',
  prescriber_name   text,
  prescriber_reg_no text,
  issued_on         date,
  expires_on        date,
  reviewed_by       uuid references auth.users,
  reviewed_at       timestamptz,
  review_note       text,
  created_at        timestamptz not null default now(),
  constraint rx_decision_has_reviewer check (
    status in ('pending', 'expired')
    or (reviewed_by is not null and reviewed_at is not null)
  ),
  constraint rx_storage_path_is_not_a_url check (storage_path !~* '^[a-z]+://')
);

create index prescriptions_order_idx on public.prescriptions (order_id);
create index prescriptions_pending_idx on public.prescriptions (created_at)
  where status = 'pending';

-- The dispensing decision, item by item.
create table public.prescription_items (
  id                uuid primary key default gen_random_uuid(),
  prescription_id   uuid not null references public.prescriptions on delete cascade,
  order_item_id     uuid references public.order_items on delete set null,
  product_id        uuid references public.products,
  quantity_approved int check (quantity_approved >= 0),
  decision          text not null
    check (decision in ('approved', 'adjusted', 'substituted', 'rejected')),
  substitution_note text,
  -- A substitution with no recorded reason is not a pharmacist's decision.
  constraint substitution_has_reason
    check (decision <> 'substituted' or substitution_note is not null)
);

-- ---------------------------------------------------------------------------
-- Payments and deliveries
-- ---------------------------------------------------------------------------

-- §3.6: there are no card columns here, and there never will be. Card payments
-- happen on the PSP's hosted fields; this table never sees a PAN, CVV or expiry.
create table public.payments (
  id                        uuid primary key default gen_random_uuid(),
  order_id                  uuid not null references public.orders on delete restrict,
  provider                  text not null check (provider in ('mpesa', 'card', 'cash')),
  status                    text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed', 'timed_out', 'refunded')),
  amount_minor              bigint not null check (amount_minor > 0),
  currency                  char(3) not null default 'KES',
  -- Idempotency key for the Daraja callback: a replayed callback finds this row.
  mpesa_checkout_request_id text unique,
  mpesa_merchant_request_id text,
  mpesa_receipt_no          text unique,
  phone                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index payments_order_idx on public.payments (order_id);

create table public.deliveries (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null unique references public.orders on delete cascade,
  status       text not null default 'pending'
    check (status in ('pending', 'dispatched', 'delivered', 'failed')),
  courier      text,
  rider_name   text,
  tracking_ref text,
  delivered_at timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- §3.2 — the prescription gate
-- ---------------------------------------------------------------------------

create or replace function public.is_fulfilment_status(s public.order_status)
returns boolean
language sql
immutable
as $fn$
  select s in ('approved', 'pushed_to_juleb', 'fulfilling', 'out_for_delivery', 'delivered');
$fn$;

create or replace function public.enforce_rx_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  needs_rx     boolean;
  has_approval boolean;
begin
  if not public.is_fulfilment_status(new.status) then
    return new;
  end if;

  -- Either the snapshot at ordering or the product as it stands now. Requiring
  -- approval when either says prescription-only fails safe in both directions.
  select exists (
    select 1
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = new.id
      and (oi.requires_prescription or p.requires_prescription)
  ) into needs_rx;

  if not needs_rx then
    return new;
  end if;

  -- The reviewer must actually hold the pharmacist role. A prescription row
  -- marked approved by anyone else does not count — that is the whole point.
  select exists (
    select 1
    from public.prescriptions rx
    where rx.order_id = new.id
      and rx.status = 'approved'
      and rx.reviewed_by is not null
      and rx.reviewed_at is not null
      and exists (
        select 1 from public.user_roles ur
        where ur.user_id = rx.reviewed_by and ur.role = 'pharmacist'
      )
  ) into has_approval;

  if not has_approval then
    raise exception
      'order % contains a prescription-only medicine and has no pharmacist-approved prescription (BUILD_SPLENDMED §3.2)',
      new.order_no
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

create trigger orders_rx_gate
  before insert or update of status on public.orders
  for each row execute function public.enforce_rx_gate();

-- Items are classified by the database and frozen once an order is past
-- payment. Without the freeze, an order could be approved holding only
-- over-the-counter items and a prescription medicine added afterwards — the
-- orders trigger would never fire again.
create or replace function public.guard_order_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  current_status public.order_status;
begin
  select o.status into current_status
  from public.orders o
  where o.id = coalesce(new.order_id, old.order_id);

  if current_status not in ('draft', 'awaiting_payment') then
    raise exception
      'items on an order cannot change once it is %; they are frozen after payment',
      current_status
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  -- Classification always comes from the product, never from the caller.
  select p.requires_prescription into new.requires_prescription
  from public.products p
  where p.id = new.product_id;

  return new;
end;
$fn$;

create trigger order_items_guard
  before insert or update or delete on public.order_items
  for each row execute function public.guard_order_items();

-- A decision is stamped with whoever made it. When a signed-in user records a
-- review, reviewed_by becomes them: nobody can sign a decision in someone else's
-- name. Service-role jobs have no auth.uid() and are left as given — and the
-- orders gate still demands that the named reviewer holds the pharmacist role.
create or replace function public.stamp_rx_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if new.status is distinct from old.status and new.status not in ('pending', 'expired') then
    if (select auth.uid()) is not null then
      new.reviewed_by := (select auth.uid());
    end if;
    new.reviewed_at := now();
  end if;
  return new;
end;
$fn$;

create trigger prescriptions_stamp_review
  before update on public.prescriptions
  for each row execute function public.stamp_rx_review();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security (§3.3) — a patient reaches only their own rows
-- ---------------------------------------------------------------------------

alter table public.addresses          enable row level security;
alter table public.carts              enable row level security;
alter table public.cart_items         enable row level security;
alter table public.orders             enable row level security;
alter table public.order_items        enable row level security;
alter table public.prescriptions      enable row level security;
alter table public.prescription_items enable row level security;
alter table public.payments           enable row level security;
alter table public.deliveries         enable row level security;

alter table public.addresses          force row level security;
alter table public.carts              force row level security;
alter table public.cart_items         force row level security;
alter table public.orders             force row level security;
alter table public.order_items        force row level security;
alter table public.prescriptions      force row level security;
alter table public.prescription_items force row level security;
alter table public.payments           force row level security;
alter table public.deliveries         force row level security;

create policy addresses_own on public.addresses
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy carts_own on public.carts
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy cart_items_own on public.cart_items
  for all
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));

-- Orders: a patient reads and creates their own; staff read all. A patient may
-- not move an order's status — that is the server's and the pharmacist's job.
create policy orders_own_read on public.orders
  for select using ((select auth.uid()) = user_id or public.is_staff());

create policy orders_own_create on public.orders
  for insert with check (
    (select auth.uid()) = user_id and status in ('draft', 'awaiting_payment')
  );

create policy orders_staff_update on public.orders
  for update using (public.is_staff()) with check (public.is_staff());

create policy order_items_read on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and ((select auth.uid()) = o.user_id or public.is_staff())
    )
  );

create policy order_items_own_write on public.order_items
  for insert with check (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );

-- Prescriptions: the patient uploads their own, pending and unreviewed; only a
-- pharmacist can record a decision. Without the WITH CHECK below a patient
-- could insert a row already marked approved.
create policy prescriptions_read on public.prescriptions
  for select using ((select auth.uid()) = user_id or public.has_role('pharmacist'));

create policy prescriptions_patient_upload on public.prescriptions
  for insert with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

create policy prescriptions_pharmacist_review on public.prescriptions
  for update
  using (public.has_role('pharmacist'))
  with check (public.has_role('pharmacist'));

create policy prescription_items_read on public.prescription_items
  for select using (
    exists (
      select 1 from public.prescriptions rx
      where rx.id = prescription_id
        and ((select auth.uid()) = rx.user_id or public.has_role('pharmacist'))
    )
  );

create policy prescription_items_pharmacist_write on public.prescription_items
  for insert with check (public.has_role('pharmacist'));

-- Payments and deliveries are written only by server code (M-Pesa callback,
-- dispatch), never by a browser session, so there are no write policies.
create policy payments_read on public.payments
  for select using (
    public.is_staff()
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );

create policy deliveries_read on public.deliveries
  for select using (
    public.is_staff()
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );
