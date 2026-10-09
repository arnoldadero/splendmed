# Deployment

Target: **Vercel**, region `fra1` (Frankfurt). Vercel has no African region;
Frankfurt is the closest with full feature support. Expect roughly 150-200ms from
Nairobi. If latency becomes a real complaint, Cloudflare Workers via OpenNext has
a Nairobi edge presence — revisit then, not before.

Repo: <https://github.com/arnoldadero/splendmed> (public, `main` is the deploy branch).

## One-time setup

```bash
vercel login
vercel link
```

Then set the environment variables. Only two are needed for the storefront:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
```

Repeat for `preview` so pull-request deploys work too.

**Never set `SUPABASE_SERVICE_ROLE_KEY` as a `NEXT_PUBLIC_*` variable.** The
anon key is designed to be public and ships in the browser bundle; the service
role key bypasses every row-level security policy. `scripts/guard-secrets.sh`
fails the build if the two are ever confused (§3.4).

`JULEB_DRIVER` is not set, which means it defaults to `mock` — correct until a
real Juleb specification and sandbox credentials exist (§3.1).

## Deploy

```bash
vercel --prod
```

Once the GitHub integration is connected, pushes to `main` deploy automatically
and pull requests get preview URLs.

## What is actually live

The storefront reads the **Juleb mock driver**, so the catalogue is nine invented
fixture products, not SplendMed's real stock. Working: browsing by category,
condition and brand, search, product pages, offers. Not working: cart, checkout,
payment, prescription upload, accounts — those are Phases 4 to 6.

The placeholder PPB licence number in the fixtures is **not rendered anywhere**;
it exists only in `packages/juleb/src/__fixtures__/branches.json`. Verified before
the repo was made public. Do not surface branch licence details in the UI until
real licence numbers replace the placeholders.

## Known blockers

| Blocker | Effect |
|---|---|
| GitHub Actions billing lock on the account | CI cannot run. The workflow is correct; the job is refused before it starts. |
| Local Docker filesystem read-only | `supabase start` fails, so Phase 1 migrations cannot be applied locally. A hosted Supabase project sidesteps this entirely. |

## Security headers

`vercel.json` sets HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options:
DENY`, and a `Permissions-Policy` denying camera, microphone, geolocation and
payment — nothing needs them yet, and prescription upload in Phase 4 will need
camera access explicitly re-granted at that point.
