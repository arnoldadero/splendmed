# SplendMed

Digital pharmacy platform for **SplendMed Pharmacy**, Kisumu, Kenya — a customer-facing
ordering experience plus an internal pharmacist console for verifying prescriptions.

[Juleb](https://juleb.com/) is the system of record: it runs the ERP, POS, inventory, and
accounting. This repository is the digital patient experience layer on top of it.

The full specification lives in **[prompts/BUILD_SPLENDMED.md](prompts/BUILD_SPLENDMED.md)**.
Section references like §3.1 throughout the codebase point there.

## Status

| Phase | Scope | State |
|---|---|---|
| 0 | Foundation — monorepo, brand system, Supabase plumbing, CI guardrails | **done** |
| 2 | Juleb port, mock driver, contract tests | **done** |
| 3 | Storefront UI (MyDawa patterns), reading the mock | **partial** — UI done, Postgres projection pending |
| 1 | Auth, roles, RLS spine | **blocked** — needs a working local database |
| 4 | Cart, prescription upload, checkout | pending |
| 5 | Payments (M-Pesa) | pending |
| 6 | Pharmacist Rx console | pending |
| 7 | Order push + admin | pending |
| 8 | Hardening | pending |

> **Phases 1 and 4-8 are blocked on the local database.** `supabase start` fails on
> this machine with `Error response from daemon: read-only file system` — Docker's VM
> disk cannot be written to. Phases 2 and 3 were built without it: the Juleb mock and
> the storefront need no Postgres. See "Known blocker" below.

## Requirements

- Node >= 20.11 (developed on 22)
- pnpm 9.15
- Docker, for the local Supabase stack

## Setup

```bash
pnpm install
```

Copy the env template, start the local Supabase stack, and paste the printed anon key into
apps/web/.env.local:

```bash
pnpm db:start
```

Then run the app:

```bash
pnpm dev
```

## Verification

The Phase 0 acceptance gate. Run before every commit:

```bash
pnpm verify
```

That chain is typecheck, then lint, then test, then guard. The guard step is not optional
tidiness; it is the mechanical enforcement of two non-negotiable guardrails:

- **scripts/guard-secrets.sh** (§3.4) — fails if a secret is exposed through a NEXT_PUBLIC_
  variable, read outside a server-only module, referenced from a client component, or
  committed as a literal.
- **scripts/guard-juleb.sh** (§3.1) — fails if any hardcoded Juleb hostname, invented
  endpoint path, or inline Juleb network call appears in source.
- **scripts/test-guards.sh** — proves both guards still fire, using deliberate violation
  fixtures plus clean-file negative controls. A guard that never fires is theatre.

## Juleb integration

**Juleb publishes no public API documentation.** Endpoints, auth, and payloads are available
only under a partner agreement, and we do not have them yet. Nothing in the roadmap blocks on
this: all Juleb access goes through a port interface with a fixture-backed mock driver, and
the HTTP driver throws JulebSpecUnavailableError rather than guessing a request.

Read **[docs/integrations/juleb.md](docs/integrations/juleb.md)** before touching anything
Juleb-related. It records what we know, what we do not, the swap-in checklist, and the open
questions to put to Juleb.

## Brand

The palette, typeface, and logo rules come from the brand guideline and are encoded in
apps/web/lib/brand.ts and apps/web/app/globals.css. The guideline forbids recolouring or
distorting the logo, so every usage goes through the Logo component — a raw img tag on a
logo file is a review failure.

## Layout

```
apps/web/          Next.js 15 app (App Router, RSC, Tailwind v4)
packages/          juleb port + drivers, payments, shared domain  (from Phase 2)
supabase/          migrations, Edge Functions, seed
docs/              integrations, compliance, ADRs
scripts/           CI guardrails and their regression test
prompts/           the build specification
```

## Known blocker: local database

`pnpm db:start` currently fails:

```
Error response from daemon: read-only file system
```

Docker's own VM filesystem is read-only, so no Supabase image can be pulled. The host
C: drive also reached 100% full during this work (it has since recovered to a few GB).
Two things to check, in order:

1. **Docker Desktop disk.** Its WSL data sits at
   `%LOCALAPPDATA%\Docker\wsl` and measured ~26 GB. Reclaiming space inside Docker
   (`docker system prune`) or growing its disk image in Docker Desktop settings is the
   likely fix. Note another project's Supabase stack (`shika-sales`) is running on this
   machine — pruning will affect it, so check with its owner first.
2. **Host disk.** C: is 238 GB and was at 100%. `AppData` alone is 52 GB.

Our ports were moved off the defaults (`5432x` to `5442x`) because `shika-sales`
already holds them, so the two stacks can run side by side once Docker is healthy.
