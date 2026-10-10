-- Phase 7: the integration plumbing — outbox, sync log, webhook events.
--
-- None of these are touched by a browser session. They are written by server
-- code running as the service role and read by staff in the admin view.

-- ---------------------------------------------------------------------------
-- Transactional outbox for pushing orders to Juleb (§8.4)
-- ---------------------------------------------------------------------------

create table public.juleb_outbox (
  id              bigint generated always as identity primary key,
  order_id        uuid not null references public.orders on delete restrict,
  -- The order id: Juleb must treat a replay of the same key as the same order.
  idempotency_key text not null unique,
  payload         jsonb not null,
  status          text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'dead')),
  attempts        int not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error      text,
  juleb_order_id  text,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);

create index juleb_outbox_due_idx on public.juleb_outbox (next_attempt_at)
  where status in ('pending', 'failed');

-- When an order is approved, its outbox row is written by this trigger — inside
-- the same transaction as the status change. That is what makes the outbox
-- pattern correct: the order cannot be approved without the push being queued,
-- and the push cannot be queued for an order that rolled back. Doing this in
-- application code would leave a window between the two writes.
create or replace function public.enqueue_juleb_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.juleb_outbox (order_id, idempotency_key, payload)
    select
      new.id,
      new.id::text,
      jsonb_build_object(
        'order_id', new.id,
        'order_no', new.order_no,
        'branch_id', new.branch_id,
        'fulfilment', new.fulfilment,
        'total_minor', new.total_minor,
        'lines', coalesce(
          (select jsonb_agg(jsonb_build_object(
              'product_id', oi.product_id,
              'quantity', oi.quantity,
              'unit_price_minor', oi.unit_price_minor))
           from public.order_items oi where oi.order_id = new.id),
          '[]'::jsonb)
      )
    -- An order can be re-approved after a Juleb stock rejection; the existing
    -- row is retried rather than duplicated.
    on conflict (idempotency_key) do update
      set status = 'pending', next_attempt_at = now(), last_error = null;
  end if;
  return new;
end;
$fn$;

-- Runs after the §3.2 gate, so an order that fails the gate never queues a push.
create trigger orders_enqueue_juleb_push
  after update of status on public.orders
  for each row execute function public.enqueue_juleb_push();

-- ---------------------------------------------------------------------------
-- Sync log — the operational record of every Juleb call (§12 observability)
-- ---------------------------------------------------------------------------

create table public.juleb_sync_log (
  id          bigint generated always as identity primary key,
  direction   text not null check (direction in ('pull', 'push')),
  resource    text not null,
  outcome     text not null check (outcome in ('ok', 'error')),
  item_count  int,
  duration_ms int,
  -- Request and response bodies with credentials and PHI redacted before they
  -- are stored. Never the raw payload.
  detail      jsonb,
  error       text,
  occurred_at timestamptz not null default now()
);

create index juleb_sync_log_recent_idx on public.juleb_sync_log (resource, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Webhook events — idempotency for every inbound callback (§9.1)
-- ---------------------------------------------------------------------------

create table public.webhook_events (
  id           bigint generated always as identity primary key,
  source       text not null check (source in ('mpesa', 'card', 'juleb')),
  -- Provider's id for the event — for M-Pesa, the CheckoutRequestID. The unique
  -- constraint below is what makes a replayed callback a no-op.
  event_id     text not null,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text,
  unique (source, event_id)
);

-- ---------------------------------------------------------------------------
-- Row Level Security (§3.3)
-- ---------------------------------------------------------------------------
--
-- Staff can read for the sync-health view. There are no write policies at all:
-- only the service role writes these, and it bypasses RLS by design.

alter table public.juleb_outbox   enable row level security;
alter table public.juleb_sync_log enable row level security;
alter table public.webhook_events enable row level security;

alter table public.juleb_outbox   force row level security;
alter table public.juleb_sync_log force row level security;
alter table public.webhook_events force row level security;

create policy juleb_outbox_staff_read on public.juleb_outbox
  for select using (public.is_staff());

create policy juleb_sync_log_staff_read on public.juleb_sync_log
  for select using (public.is_staff());

create policy webhook_events_staff_read on public.webhook_events
  for select using (public.is_staff());
