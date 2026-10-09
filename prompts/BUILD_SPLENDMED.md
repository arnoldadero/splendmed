# BUILD PROMPT — SplendMed Digital Pharmacy Platform

> **How to use this prompt.** Paste the whole file into an agentic coding session (Claude Code or
> equivalent) as the opening instruction. It is written to be executed in the phase order of §13,
> one phase per session, committing at each acceptance gate. Do not attempt all phases in one pass.
> Everything under §3 is non-negotiable; everything else is a strong default you may improve on if
> you state the reason in `docs/decisions/`.

---

## 1. Mission

Build the **SplendMed digital pharmacy platform**: a customer-facing web app for ordering medication
and wellness products, plus an internal pharmacist console for verifying prescriptions and releasing
orders for fulfilment.

**Juleb is the system of record.** It already runs SplendMed's ERP, POS, inventory, and accounting.
You are building the *digital patient experience layer* on top of it — not reimplementing it. Catalog,
stock, pricing, and invoicing originate in Juleb. Orders, prescriptions, patient accounts, and the
review workflow originate in your system and are pushed to Juleb.

Supabase is the application datastore, auth provider, file store, and realtime transport.

---

## 2. Product context (ground truth — do not invent around this)

| Fact | Value |
|---|---|
| Business | SplendMed Pharmacy — retail pharmacy + wellness services |
| Home base | Kisumu, Kenya |
| Founding vision | "Transform healthcare by blending trust, innovation, and holistic wellness" |
| Positioning | Not just dispensing illness treatment — nurturing overall well-being |
| Brand values | Trust · Professionalism · Compassion · Wellness · Innovation |
| Logo meaning | Stylised **P** and **L** ligature — "Power Living" |
| Market / currency | Kenya, **KES** |
| Payment rails | M-Pesa (Daraja STK Push) primary, card via local PSP secondary |
| ERP / system of record | **Juleb** (juleb.com) |

Brand assets already in the repo root — move them to `apps/web/public/brand/` and reference by path,
never re-draw them:

```
Logo Icon@4x.png                 Main Logo 2 - in White@4x.png
Logo Icon in Black@4x.png        Main Logo 3- In Black@4x.png
Logo Icon in Green@4x.png        Main Logo 4- Combination@4x.png
Logo Icon in white@4x.png        Artboard 1@4x.png
SplendMed pharmacy.pdf           <- brand guideline, source of §6
```

### Target users

1. **Patient / customer** — browses, uploads a prescription, pays by M-Pesa, tracks delivery.
2. **Pharmacist (PPB-licensed)** — works a review queue: validates prescriptions, maps written
   medicines to catalog items, approves / rejects / requests clarification, releases to fulfilment.
3. **Branch admin / superintendent** — oversees branches, monitors Juleb sync health, reads audit logs.

---

## 3. Non-negotiable guardrails

These are hard constraints. Violating any one of them is a failed build.

### 3.1 Never invent Juleb API surface

Juleb publishes **no public API documentation**. Its endpoints, auth scheme, payloads, and error
semantics are available only under a customer/partner agreement, and SplendMed does not have them yet.

- **Do not guess, scaffold, or "best-guess" a Juleb URL, path, header, field name, or auth flow.**
- All Juleb access goes through the port interface in §8. The HTTP driver's methods must throw
  `JulebSpecUnavailableError` with a pointer to `docs/integrations/juleb.md` — not a fabricated request.
- Build and test everything against the **mock driver**. The real driver is filled in, from the real
  spec, on the day credentials arrive.
- Record every open question about Juleb in `docs/integrations/juleb.md` under "Questions for Juleb".

### 3.2 Prescription-only medicines are gated by a human

A product flagged `requires_prescription` can **never** reach a fulfilment state without a recorded
approval by an authenticated user holding the `pharmacist` role. No auto-approval, no "trust the
upload", no bypass flag, not even in seed or demo data. Enforce this in the database (trigger or
check), not only in application code.

### 3.3 Row Level Security on every table, no exceptions

Every table in the `public` schema has RLS enabled and explicit policies. A patient can read only
their own orders, prescriptions, addresses, and payments. There is no table where the default is open.
Write a test that fails if any `public` table has `rowsecurity = false`.

### 3.4 The service role key never reaches a browser

`SUPABASE_SERVICE_ROLE_KEY` is used only inside Edge Functions and server-only modules. It must never
appear in a `NEXT_PUBLIC_*` variable, a client component, or a bundle. Add a CI grep that fails the
build if it does.

### 3.5 Prescriptions are PHI

Prescription images live in a **private** Storage bucket, served only via short-lived signed URLs
(≤ 5 min). Every read of a prescription by a non-owner writes an `audit_log` row. No PHI in URLs, query
strings, logs, analytics events, or error reports.

### 3.6 No card data touches our servers

Card payments are redirect or hosted-field only, via the PSP's SDK. The platform never receives,
stores, or logs a PAN, CVV, or expiry. M-Pesa flows store only the Daraja identifiers and receipt number.

### 3.7 Stock from the cache is advisory, never a promise

Local inventory rows are a projection of Juleb, and are stale by definition. Display them as
"availability", re-validate at checkout, and design the order state machine so a Juleb stock rejection
is a normal, handled path — not a 500.

---

## 4. Tech stack (locked)

| Layer | Choice |
|---|---|
| Framework | **Next.js 15**, App Router, TypeScript strict, React Server Components |
| Styling | **Tailwind CSS** + **shadcn/ui**, themed to §6 — do not ship default shadcn slate |
| Backend | **Supabase**: Postgres, Auth, Storage, Realtime, Edge Functions (Deno) |
| Supabase client | **`@supabase/ssr`** (`createServerClient` / `createBrowserClient`). Do **not** use the deprecated `@supabase/auth-helpers-*` packages |
| Auth | Phone OTP primary (Kenya-first), email+password secondary; roles via `user_roles` table |
| Mutations | Server Actions for app writes; Route Handlers / Edge Functions for webhooks |
| Validation | **Zod** at every trust boundary — form input, Server Action args, webhook bodies, Juleb responses |
| Data fetching | Server Components by default. Client fetching only for realtime subscriptions |
| Testing | **Vitest** (unit), **Playwright** (E2E), **pgTAP** or SQL assertions (RLS) |
| Migrations | Supabase CLI migrations, checked in, forward-only |
| Money | Integer **minor units** (KES cents) everywhere. Never a float for money |
| Package manager | pnpm, workspaces |

---

## 5. Repository layout

```
splendmed/
├── apps/
│   └── web/                        Next.js 15 app
│       ├── app/
│       │   ├── (shop)/             storefront: catalog, product, cart, checkout
│       │   ├── (account)/          orders, prescriptions, addresses, profile
│       │   ├── (console)/          pharmacist Rx review queue  [role-gated]
│       │   ├── (admin)/            branches, sync health, audit log  [role-gated]
│       │   └── api/webhooks/       M-Pesa callback, PSP callback, Juleb inbound
│       ├── components/
│       ├── lib/
│       │   ├── supabase/           server.ts · client.ts · middleware.ts
│       │   ├── actions/            Server Actions, one file per domain
│       │   └── money.ts
│       └── public/brand/           logo assets from §2
├── packages/
│   ├── juleb/                      <- the integration boundary, §8
│   │   ├── src/port.ts             JulebClient interface + domain types
│   │   ├── src/drivers/mock.ts     fixture-backed, used by all tests
│   │   ├── src/drivers/http.ts     real driver — throws until spec lands
│   │   ├── src/mappers.ts          Juleb shape -> SplendMed domain (ACL)
│   │   └── src/__fixtures__/
│   ├── payments/                   mpesa/ · card/ — same port+driver pattern
│   └── domain/                     shared types, Zod schemas, order state machine
├── supabase/
│   ├── migrations/
│   ├── functions/                  sync-catalog · sync-stock · push-orders · mpesa-callback
│   └── seed.sql
├── docs/
│   ├── integrations/juleb.md       contract, open questions, swap-in checklist
│   ├── integrations/mpesa.md
│   ├── compliance/                 PPB · DPA-2019 · eTIMS notes
│   └── decisions/                  ADRs
└── prompts/BUILD_SPLENDMED.md      this file
```

---

## 6. Brand system

Take these from the brand guideline; they are exact.

```css
--splend-teal:  #01B1AF;  /* primary — CTAs, links, active states */
--splend-deep:  #0B5C58;  /* deep teal — headers, text on light, nav */
--splend-lime:  #C1D72D;  /* accent — use sparingly: badges, highlights */
--splend-mint:  #8BD0BB;  /* soft mint — surfaces, success tints */
--splend-white: #FFFFFF;
```

- **Typeface: Archivo** (Google Fonts) for everything. Load via `next/font/google` with
  `display: 'swap'`. Archivo Expanded for display headings if a second weight is wanted.
- **Logo rules from the guideline, enforced in code:** clear space on all sides ≥ 50% of the logo's
  height; never rotate, skew, recolour, add shadows, or lock text to the logo. Build a single
  `<Logo variant="primary|icon|white|black|green" />` component and use only it — no raw `<img>` on
  logo files.
- Contrast: `#C1D72D` lime fails WCAG AA for body text on white. Use it only as a background or
  large-text accent, and verify every pairing against WCAG 2.2 AA (4.5:1 body, 3:1 large text / UI).
- Tone of voice follows the brand values: warm, plain-spoken, competent. Compassion means error states
  that help rather than scold — "We need a clearer photo of your prescription" beats "Invalid upload".

---

## 7. Data model

Write as Supabase CLI migrations. Representative shape — extend as features require, keep the
invariants.

```sql
-- Roles live in their own table. Never store role on a table whose own RLS policy
-- checks that role; that recurses. Read it through a SECURITY DEFINER helper.
create type app_role as enum ('patient','pharmacist','branch_admin','superadmin');

create table public.user_roles (
  user_id uuid not null references auth.users on delete cascade,
  role    app_role not null,
  primary key (user_id, role)
);

create or replace function public.has_role(_role app_role)
returns boolean language sql stable security definer set search_path = ''
as $fn$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = _role
  );
$fn$;

create table public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  full_name  text,
  phone      text unique,              -- E.164, +254…
  created_at timestamptz not null default now()
);

create table public.branches (
  id                   uuid primary key default gen_random_uuid(),
  juleb_branch_id      text unique,    -- external key, nullable until synced
  name                 text not null,
  county               text,
  ppb_licence_no       text,           -- Pharmacy & Poisons Board licence
  pharmacist_in_charge text,
  is_active            boolean not null default true
);

-- Projection of the Juleb catalog. Juleb owns the truth; this is a read cache.
create table public.products (
  id                    uuid primary key default gen_random_uuid(),
  juleb_product_id      text unique,
  name                  text not null,
  generic_name          text,
  form                  text,          -- tablet, syrup, cream…
  strength              text,
  pack_size             text,
  requires_prescription boolean not null default false,
  is_controlled         boolean not null default false,
  price_minor           bigint not null,          -- KES cents
  vat_rate_bp           int not null default 0,   -- basis points
  image_url             text,
  is_active             boolean not null default true,
  synced_at             timestamptz
);

create table public.inventory_levels (
  branch_id     uuid references public.branches on delete cascade,
  product_id    uuid references public.products on delete cascade,
  qty_available int not null default 0,
  synced_at     timestamptz not null default now(),
  primary key (branch_id, product_id)
);

create type order_status as enum (
  'draft','awaiting_payment','paid','awaiting_rx_review','rx_rejected',
  'approved','pushed_to_juleb','fulfilling','out_for_delivery',
  'delivered','cancelled','refunded'
);

create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  order_no           text unique not null,
  user_id            uuid not null references auth.users on delete restrict,
  branch_id          uuid references public.branches,
  status             order_status not null default 'draft',
  requires_rx_review boolean not null default false,
  subtotal_minor     bigint not null default 0,
  delivery_fee_minor bigint not null default 0,
  total_minor        bigint not null default 0,
  currency           char(3) not null default 'KES',
  juleb_order_id     text,
  created_at         timestamptz not null default now()
);

create type rx_status as enum
  ('pending','approved','rejected','needs_clarification','expired');

create table public.prescriptions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users on delete cascade,
  order_id          uuid references public.orders on delete set null,
  storage_path      text not null,   -- private bucket object path, never a public URL
  status            rx_status not null default 'pending',
  prescriber_name   text,
  prescriber_reg_no text,
  issued_on         date,
  expires_on        date,
  reviewed_by       uuid references auth.users,
  reviewed_at       timestamptz,
  review_note       text,
  created_at        timestamptz not null default now(),
  -- a review decision must always carry a reviewer
  constraint rx_decision_has_reviewer check (
    status in ('pending','expired')
    or (reviewed_by is not null and reviewed_at is not null)
  )
);
```

Also build: `addresses`, `carts` / `cart_items`, `order_items`, `prescription_items` (the dispensing
decision: mapped product, qty approved, substitution note), `payments`, `deliveries`,
`juleb_outbox`, `juleb_sync_log`, `webhook_events` (unique `event_id` for idempotency),
`audit_log`, `consents`.

**The §3.2 invariant must be a database trigger**, not just app logic:

> `BEFORE UPDATE ON orders` — if `NEW.status` moves into any fulfilment state
> (`approved`, `pushed_to_juleb`, `fulfilling`, `out_for_delivery`, `delivered`) and the order
> contains any item whose `product.requires_prescription` is true, then a `prescriptions` row for
> this order must exist with `status = 'approved'` and a non-null `reviewed_by`.
> Otherwise `RAISE EXCEPTION`.

---

## 8. The Juleb integration boundary

This is the most important module in the codebase. Re-read §3.1 before writing a line of it.

### 8.1 The port

```ts
// packages/juleb/src/port.ts
export interface JulebClient {
  listBranches(): Promise<JulebBranch[]>;

  listProducts(args: { cursor?: string; updatedSince?: string }): Promise<Page<JulebProduct>>;

  getStock(args: { branchId: string; productIds: string[] }): Promise<JulebStockLevel[]>;

  /** idempotencyKey is our order id — a retry must never create a second Juleb order. */
  createOrder(draft: JulebOrderDraft, idempotencyKey: string): Promise<JulebOrderRef>;

  getOrder(julebOrderId: string): Promise<JulebOrder>;

  cancelOrder(julebOrderId: string, reason: string): Promise<void>;

  /** Juleb ships an Rx E-Prescription module; capability unconfirmed. Optional by design. */
  submitPrescription?(rx: JulebRxSubmission): Promise<JulebRxRef>;
}

export class JulebSpecUnavailableError extends Error {
  constructor(method: string) {
    super(
      `Juleb API spec unavailable for ${method}(). ` +
        `Do not guess the endpoint. See docs/integrations/juleb.md.`,
    );
  }
}
```

### 8.2 Drivers

- **`MockJulebClient`** — serves `src/__fixtures__/*.json`. Must simulate the unhappy paths too:
  pagination, `updatedSince` filtering, a stock shortfall, a rejected order, a 429, a timeout, and a
  duplicate-idempotency-key replay returning the *same* order ref.
- **`HttpJulebClient`** — real transport skeleton: base URL and credentials from env, retry with
  exponential backoff + jitter, circuit breaker, request/response logging to `juleb_sync_log` with
  credentials and PHI redacted. **Every method body is `throw new JulebSpecUnavailableError(...)`
  until the real spec is in hand.**
- Selected by `JULEB_DRIVER=mock|http`, resolved once in a factory. No `if (mock)` branches scattered
  through feature code.

### 8.3 Anti-corruption layer

Juleb types stay inside `packages/juleb`. Nothing outside it imports a `Juleb*` type. `mappers.ts`
converts to `packages/domain` types, and every inbound Juleb payload is parsed with Zod before
mapping — a schema change upstream must surface as a clean validation error, not a runtime crash deep
in the UI.

### 8.4 Sync topology

- **Pull — catalog**: Edge Function `sync-catalog`, scheduled via `pg_cron` + `pg_net`, incremental by
  `updatedSince`, upserts on `juleb_product_id`. Hourly.
- **Pull — stock**: Edge Function `sync-stock`, more frequent (5–15 min), per active branch.
- **Push — orders**: transactional **outbox**. A paid, Rx-approved order writes a `juleb_outbox` row in
  the same transaction as its status change. A worker drains the outbox, calls `createOrder` with the
  order id as idempotency key, and records the result. Retries are safe by construction.
- **Reconcile**: nightly job diffs local orders against Juleb and raises anything divergent into the
  admin sync-health view.
- Failure posture: a Juleb outage must never block browsing, cart, payment, or prescription review.
  It delays only the push, and the admin dashboard shows the backlog depth.

### 8.5 `docs/integrations/juleb.md` — create this in Phase 0

Contains: what we believe Juleb offers (POS, inventory, accounting, SFA, Rx e-prescription,
e-commerce, DSCSA compliance; an integration track record with Shopify, Salla, MS Dynamics, Wasfaty,
ZATCA/Fatoora and GS1 — so an HTTP integration surface clearly exists), what we do **not** know, and
the swap-in checklist:

1. Obtain sandbox credentials + spec from Juleb.
2. Write the Zod schemas from the real payloads.
3. Implement `HttpJulebClient` method by method.
4. Run the contract test suite (the same assertions the mock satisfies) against sandbox.
5. Flip `JULEB_DRIVER=http` in staging, watch `juleb_sync_log` for 48h, then production.

Open questions to put in that file: auth scheme and token lifetime · rate limits · pagination style ·
whether order creation is idempotent and how a key is passed · webhook availability and signature
scheme · whether the Rx E-Prescription module is reachable by API · sandbox availability ·
multi-branch addressing · whether Juleb or SplendMed owns the KRA eTIMS invoice.

---

## 9. Payments

### 9.1 M-Pesa (Daraja) — primary

Same port + driver pattern as Juleb, but here the spec **is** public, so implement it properly against
the live Daraja documentation. Verify every path, field name, and base URL against those docs as you
write — treat the names below as a map, not as gospel.

Flow: OAuth client-credentials token (cache it, it is short-lived) → **STK Push** to prompt the
customer's handset → respond `200` to Daraja immediately → await the **callback** → on success record
the M-Pesa receipt and move the order to `paid`. Reconcile stragglers with a transaction-status query
and a timeout sweep, because callbacks do get lost.

Required of the implementation:

- The callback handler is **public and unauthenticated by nature** — so it must verify the payload
  shape with Zod, be idempotent on `CheckoutRequestID`, write to `webhook_events` before acting, and
  never trust an amount from the callback over the amount we stored on the order.
- Never derive paid status from the client. Only the callback (or a server-side status query) can
  advance an order to `paid`.
- A pending STK push has a short wall-clock life. Model `payment_timeout` explicitly and release any
  held stock.
- Store the passkey and consumer secret in Supabase Function secrets — never in the repo, never in a
  `NEXT_PUBLIC_*` variable.

### 9.2 Card — secondary

Hosted fields or redirect via a Kenyan-market PSP. Keep it behind the same payments port so the choice
of PSP is a one-file change. §3.6 applies absolutely.

### 9.3 Cash on delivery

Supported for non-prescription orders at launch; settle on delivery confirmation.

---

## 10. Feature specs

### 10.1 Customer web app

The storefront targets the patterns in **docs/product/ux-reference-mydawa.md** — MyDawa
is the Kenyan market leader and the closest comparable, so a shopper arriving from it
should find SplendMed familiar. Read that document before building Phase 3. It also
records what must NOT be copied (their brand, copy, and unsubstantiated trust claims)
and four schema fields the §7 sketch omits.

- **Home** — brand-led, wellness-forward. Search, categories, "speak to a pharmacist" entry point.
- **Catalog & search** — Postgres full-text search across brand and generic names (patients search
  both ways: "Panadol" and "paracetamol"). Filter by category, availability, Rx-required.
- **Product page** — clear, unmissable "Prescription required" state. No dosage advice generated by
  the app; clinical copy comes only from supplied product data.
- **Cart & checkout** — the moment any Rx item is in the cart, checkout branches into prescription
  upload. Delivery vs branch pickup (Kisumu-first delivery zones). Live totals in KES, VAT handled per
  product rate.
- **Prescription upload** — camera or file, client-side downscale, multi-page, uploaded directly to the
  private bucket with a signed upload URL. Immediate legibility hints before submission.
- **Order tracking** — realtime status via Supabase Realtime, scoped to the user's own orders.
- **Account** — orders, prescription history and statuses, addresses, consents, and data-export and
  deletion requests (§11).
- Must be excellent on a mid-range Android phone over 3G: ship little JS, lazy-load, optimise images,
  and make the whole flow usable one-handed.

### 10.2 Pharmacist Rx console

This is a clinical safety tool. Design it as one.

- **Queue** — pending prescriptions, oldest first, with waiting time. Realtime. A claim mechanism so
  two pharmacists cannot review the same prescription simultaneously.
- **Review screen** — prescription image (zoom / rotate / multi-page) beside the ordered items.
  The pharmacist records prescriber name and registration number, issue and expiry dates, then per
  item: approve, adjust quantity, substitute (with a reason), or reject.
- **Decisions** — approve, reject with a reason, or request clarification. Rejection and clarification
  notify the patient with a clear, kind explanation and a path to fix it.
- **Every action is audited** — actor, timestamp, before/after, into `audit_log`. Reviews are immutable
  once submitted; a correction is a new event, never an edit.
- Controlled substances (`is_controlled`) get a stricter path: additional confirmation and a dedicated
  register view for inspection.

### 10.3 Admin

Branch management (including PPB licence numbers), **Juleb sync health** (last successful sync per
resource, outbox depth, recent failures with payloads), an audit log viewer with filters, user role
management, and product overrides where local data must deliberately diverge from Juleb.

---

## 11. Compliance & security

Research each item against current Kenyan requirements as you implement, and write findings to
`docs/compliance/`. Do not assume the notes below are current or complete — they are a starting map.

- **Pharmacy and Poisons Board (PPB)** — retail pharmacy licensing, a superintendent pharmacist, and
  the rule that prescription-only medicines are not supplied without a valid prescription. §3.2 is the
  software expression of this. Surface branch licence details in the UI where required.
- **Data Protection Act 2019 (Kenya)** / ODPC — health data is sensitive personal data. Implement
  explicit granular consent with versioning, purpose limitation, data subject access and erasure,
  breach-notification readiness, and a retention policy. Check data-localisation and cross-border
  transfer obligations **before** choosing the Supabase project region, and record the decision as an ADR.
- **KRA eTIMS** — electronic tax invoicing. Determine whether Juleb already transmits invoices (likely,
  given its ZATCA/Fatoora lineage) or whether SplendMed must. **Do not build an eTIMS integration until
  that ownership question is answered** — duplicate invoices are worse than none.
- **SHA / insurance** — out of scope for v1; leave a seam in the order model for a payer and claim
  reference so it can be added later without migration pain.
- Security baseline: strict CSP, no secrets in the client, rate-limited auth and upload endpoints,
  signed URLs only, server-side authorisation on every mutation (never rely on a hidden UI control),
  and dependency + secret scanning in CI.

---

## 12. Non-functional requirements

- **Accessibility**: WCAG 2.2 AA. Keyboard-complete, screen-reader labelled, visible focus, honest
  colour contrast (see the lime caveat in §6). The Rx console must be fully operable by keyboard.
- **Performance**: LCP < 2.5s on 3G / mid-range Android for catalog and product pages. Server-render by
  default; justify every client component.
- **Reliability**: every external call has a timeout, a retry policy, and a defined failure state.
  No unbounded retry, no silent catch.
- **Observability**: structured server logs with request ids and PHI redacted; `juleb_sync_log` and
  `webhook_events` are the operational source of truth for integration debugging.
- **i18n-ready**: English at launch, Swahili strings extractable from day one. No hardcoded
  user-facing copy inside components.

---

## 13. Build phases

Each phase ends at its acceptance gate with a commit. Do not start the next phase until the gate passes.

**Phase 0 — Foundation**
Monorepo, Next.js 15 + TS strict + Tailwind + shadcn themed to §6, Supabase project and local CLI,
`@supabase/ssr` session plumbing with middleware refresh, brand assets moved and `<Logo>` built,
`docs/integrations/juleb.md` written per §8.5, CI with lint + typecheck + the §3.4 secret grep.
*Gate:* app boots, a brand-correct landing page renders, `pnpm typecheck && pnpm lint && pnpm test`
is green.

**Phase 1 — Auth, roles, RLS spine**
Phone OTP + email auth, `profiles`, `user_roles`, `has_role()`, role-gated route groups, `audit_log`,
consent capture. *Gate:* the RLS test suite proves a patient cannot read another patient's rows, every
`public` table has `rowsecurity = true`, and role gates are enforced server-side.

**Phase 2 — Juleb port + mock driver**
`packages/juleb` complete per §8: port, mock driver with unhappy paths, mappers, Zod schemas, HTTP
driver skeleton that throws, contract test suite. *Gate:* contract tests pass against the mock, and a
grep confirms no fabricated Juleb URL or endpoint path exists anywhere in the repo.

**Phase 3 — Catalog**
`products` / `inventory_levels` / `branches`, `sync-catalog` and `sync-stock` Edge Functions on
`pg_cron`, storefront catalog, search, product pages, Rx-required states. *Gate:* the mock catalog
syncs into Postgres and renders; search finds products by both brand and generic name.

**Phase 4 — Cart, prescription upload, checkout**
Cart, addresses, delivery vs pickup, private Storage bucket with RLS + signed upload URLs, the Rx
upload flow, the order state machine, and the §7 database trigger. *Gate:* a trigger test proves an Rx
order cannot be forced into a fulfilment state without an approved, reviewer-stamped prescription —
attempted directly in SQL, bypassing the app.

**Phase 5 — Payments**
M-Pesa STK push, idempotent callback handler, timeout sweep, status reconciliation, card behind the
port, cash on delivery. *Gate:* a sandbox payment succeeds end-to-end; replaying the same callback
twice produces exactly one `paid` transition; a lost callback is recovered by the sweep.

**Phase 6 — Pharmacist Rx console**
Realtime queue with claim/release, review screen, per-item decisions, immutable audit trail, patient
notifications, controlled-substance path. *Gate:* a full approve and a full reject journey pass in
Playwright, and every action appears in `audit_log` with before/after state.

**Phase 7 — Order push + admin**
Transactional outbox, outbox worker, reconciliation job, sync-health dashboard, audit viewer, branch
and role admin. *Gate:* a Juleb outage simulated in the mock driver leaves browsing, payment, and
review fully functional, queues the push, and surfaces backlog depth in admin.

**Phase 8 — Hardening**
Accessibility audit against WCAG 2.2 AA, performance budget, CSP, rate limits, compliance docs
completed, seed data, README and runbook. *Gate:* §15 fully satisfied.

---

## 14. Testing strategy

- **RLS tests are not optional.** For each table, assert as user A that user B's rows are invisible and
  unwritable. Run them in CI against a real Postgres.
- **Contract tests** run the identical assertion suite against whichever `JulebClient` driver is
  configured. Today they run green on the mock; the day the real spec lands they become the acceptance
  criteria for the HTTP driver.
- **Webhook idempotency tests**: replay every callback twice and assert exactly one state transition.
- **E2E (Playwright)**: OTC purchase; Rx purchase through approval to delivery; Rx rejection and
  resubmission; payment timeout and recovery.
- **The §3.2 trigger test must attack the database directly** with raw SQL as a privileged role.
  Proving the app refuses it is not the same as proving the database refuses it.
- No test may depend on network access to Juleb or on a live M-Pesa account.

---

## 15. Definition of done

- [ ] All guardrails in §3 hold, each with a test that fails if it is broken.
- [ ] Zero fabricated Juleb endpoints in the repo; `docs/integrations/juleb.md` lists every open question.
- [ ] Every `public` table: RLS on, policies explicit, tested.
- [ ] A prescription-only order cannot reach fulfilment without a pharmacist's recorded approval —
      proven at the database level.
- [ ] No service-role key, M-Pesa secret, or PSP secret reachable from a browser bundle; CI enforces it.
- [ ] M-Pesa happy path, double-callback, and lost-callback cases all handled.
- [ ] Brand palette, Archivo, and logo clear-space rules applied; WCAG 2.2 AA verified.
- [ ] Juleb unavailability degrades gracefully and visibly, never fatally.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` green.
- [ ] README runbook: local setup, migrations, seeding, driver switching, deployment.
- [ ] Decisions recorded as ADRs in `docs/decisions/`.

---

## 16. Surface, don't guess

When you hit one of these, stop and ask rather than inventing an answer:

1. Any Juleb endpoint, payload, auth, or capability detail (§3.1).
2. Whether Juleb or SplendMed transmits the KRA eTIMS invoice.
3. The chosen card PSP and its account status.
4. The Supabase project region, given the DPA 2019 data-localisation analysis.
5. The delivery model — own riders, third-party courier, or both — and the Kisumu zone/fee structure.
6. Which branches exist, their PPB licence numbers, and the pharmacist-in-charge for each.
7. Whether clinical content (dosage, interactions, counselling notes) will be licensed from a data
   provider — **never generate clinical guidance in code or copy.**
