# Juleb integration

**Status: no API specification in hand. Do not write HTTP calls against Juleb yet.**

This document exists because the single largest risk to this integration is an agent or
developer confidently inventing a Juleb endpoint that does not exist. Guardrail §3.1 of
`prompts/BUILD_SPLENDMED.md` makes that a build failure. This file records what we actually
know, what we do not, and the exact steps to close the gap.

---

## What Juleb is

Juleb is a Saudi Arabia-based pharma-tech and retail software company selling an integrated
cloud platform for the health, retail, and distribution sectors. For SplendMed it is the
**system of record**: it runs the ERP, POS, inventory, and accounting. Our platform is the
digital patient experience layer on top of it.

## What we believe Juleb offers (evidenced)

From Juleb's own marketing surface:

| Capability | Evidence |
|---|---|
| Accounting | Listed as a core solution |
| Inventory management | Listed as a core solution |
| Sales Force Automation (SFA) | Listed as a core solution |
| Point of Sale (POS) | Listed as a core solution |
| **Rx E-Prescription** | Listed as a core solution — relevant to our Phase 6 console |
| E-commerce platform | Listed as a core solution |
| DSCSA compliance | Listed — US drug supply chain, not Kenya-relevant |

And an integration track record that proves a real HTTP surface exists:

- E-commerce / aggregators: Shopify, Salla, HungerStation, Wasfaty
- ERP: Microsoft Dynamics
- Payments: Geidea, Alhamrani
- Compliance / standards: ZATCA, Fatoora, GS1, RSD

Juleb's own material describes the platform as "modular and unified" with "open API"
connectivity, and their Wasfaty integration is described as working via API. So an API
exists. **Its shape is simply not published.**

## What we do NOT know — do not guess any of this

- Base URL(s), and whether sandbox and production differ
- Authentication scheme (OAuth2 client credentials? static API key? signed requests?) and
  token lifetime
- Any endpoint path, HTTP method, request shape, or response shape
- Field names and types for products, stock, branches, orders, prescriptions
- Pagination style (cursor? page/offset? link headers?)
- Rate limits and throttling behaviour
- Whether order creation is idempotent, and if so how an idempotency key is supplied
- Whether outbound webhooks exist, what events they carry, and how they are signed
- Whether the Rx E-Prescription module is reachable by API at all
- Error taxonomy and retry semantics
- Whether a sandbox/test tenant is available

One third-party software directory states outright that Juleb ERP provides no API access,
which contradicts Juleb's own "open API" claim. Until we have credentials and a spec in
writing, **treat the existence of any specific endpoint as unverified.**

## How this repo handles the gap

All Juleb access goes through a port interface with two drivers (§8):

```
packages/juleb/src/port.ts          JulebClient interface — our contract, not theirs
packages/juleb/src/drivers/mock.ts  fixture-backed; every test runs against this
packages/juleb/src/drivers/http.ts  real driver; every method throws until the spec lands
packages/juleb/src/mappers.ts       anti-corruption layer: Juleb shapes never leak outward
```

`HttpJulebClient` methods throw `JulebSpecUnavailableError` rather than making up a request.
Selection is by `JULEB_DRIVER=mock|http`, resolved once in a factory.

Consequences deliberately designed in:

- Nothing in the product roadmap blocks on Juleb access. Browsing, cart, payment, and
  prescription review all work against the mock.
- A Juleb outage degrades only the order push, which is queued in a transactional outbox
  and surfaced in the admin sync-health view.
- Local inventory is a **projection** and is advisory only (§3.7). It is re-validated at
  checkout, and a stock rejection is a handled path.

## Swap-in checklist (run this when access is granted)

1. Obtain sandbox credentials and the written API specification from Juleb.
2. Capture real request/response payloads from sandbox; write Zod schemas from the actual
   payloads, not from the spec prose.
3. Implement `HttpJulebClient` one method at a time, replacing each thrown
   `JulebSpecUnavailableError`.
4. Run the contract test suite — the same assertions the mock already satisfies — against
   sandbox. Treat it as the acceptance criteria.
5. Flip `JULEB_DRIVER=http` in staging. Watch `juleb_sync_log` for 48h. Then production.

## Questions for Juleb

Send these to Juleb as a single list when opening the integration conversation.

**Access and auth**
1. Is there a sandbox or test tenant, and how do we get credentials for it?
2. What is the authentication scheme, and what is the token lifetime and refresh flow?
3. Is there written API documentation or an OpenAPI/Swagger specification we can have?

**Catalog and stock**
4. How do we read the product catalog, and does it support incremental sync by
   last-modified timestamp?
5. Is `requires_prescription` (or an equivalent POM/Rx classification) exposed per product?
   This is critical — our §3.2 safety gate depends on it.
6. How is stock exposed per branch, and what is the acceptable polling frequency?
7. Are prices and VAT/tax rates returned per product, and in which currency for a Kenyan
   tenant?
7a. Is a **unit of sale** exposed per product (pieces, packets, bottles, tube)? The
    storefront shows it as a price suffix and it prevents real confusion.
7b. Is there a **compare-at / was-price** so we can render a struck-through original
    and derive a discount badge, or is promotional pricing modelled some other way?
7c. Are products tagged against **health conditions** (diabetes, hypertension,
    malaria)? "Shop by condition" is how patients navigate and it is a separate
    taxonomy from categories.
7d. Is **brand** a first-class entity with a stable id, or only a text field?

**Orders**
8. How do we create an order, and is creation idempotent? If so, how is the idempotency key
   passed?
9. Can an order carry a reference to an externally-approved prescription?
10. How do we read order status back, and are there outbound webhooks for status changes?
11. If webhooks exist, how are they signed so we can verify authenticity?

**Prescriptions**
12. Is the Rx E-Prescription module reachable by API, and what can it accept?

**Operational**
13. What are the rate limits?
14. What pagination style do list endpoints use?
15. How are errors structured, and which are safely retryable?
16. Multi-branch: how is a branch addressed in requests?

**Compliance — blocking for our Phase 5/8**
17. **Does Juleb transmit the KRA eTIMS invoice for a Kenyan tenant, or must SplendMed do
    it?** Duplicate invoices are worse than none, so we will not build eTIMS until this is
    answered in writing.
18. Is the Kenyan deployment subject to the same ZATCA/Fatoora e-invoicing pipeline as the
    Saudi one, or is there a Kenya-specific path?

---

## Sources

- <https://juleb.com/> — product overview, integration logos
- <https://juleb.com/solutions/en> — module list
- <https://juleb.com/blog/wasfaty-juleb-integration-pharmacy-management/en> — API-based
  aggregator integration
- <https://github.com/api-evangelist/juleb> — third-party API profile; confirms no public
  spec is published
- <https://softwarefinder.com/enterprise-resource-planning-software/juleb-erp> — directory
  listing that claims no API access (contradicts Juleb's own claim; noted as unresolved)

_Last verified: 2026-10-09._
