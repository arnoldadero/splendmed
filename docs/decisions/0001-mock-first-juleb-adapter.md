# 0001 — Mock-first Juleb adapter behind a port interface

- Status: accepted
- Date: 2026-10-09

## Context

Juleb is the system of record for SplendMed and the source of catalog, stock, pricing, and
invoicing. But Juleb publishes no public API documentation. Research across their site,
solutions pages, blog, and a third-party API profile found marketing claims of open API
connectivity and a real integration track record (Shopify, Salla, MS Dynamics, Wasfaty,
ZATCA/Fatoora, GS1) but no endpoints, no auth scheme, no payload shapes, and no OpenAPI
specification. One software directory even asserts Juleb offers no API access at all, which
contradicts the vendor's own claim.

SplendMed does not yet hold credentials or a spec.

An agentic build process under schedule pressure will, by default, invent a plausible
endpoint and write code against it. That code compiles, reads convincingly, passes review,
and is entirely fictional. It is the worst available failure mode, because it surfaces only
at integration time.

## Decision

All Juleb access goes through a JulebClient port interface with two drivers:

- MockJulebClient — fixture-backed, simulates unhappy paths, used by every test.
- HttpJulebClient — real transport skeleton whose every method throws
  JulebSpecUnavailableError until a real specification is in hand.

Driver selection is by JULEB_DRIVER=mock|http, resolved once in a factory. An
anti-corruption layer keeps Juleb types inside packages/juleb; nothing outside imports a
Juleb-prefixed type.

This is enforced mechanically, not by convention. scripts/guard-juleb.sh fails CI on any
hardcoded Juleb hostname, invented endpoint path, or inline Juleb network call, and
scripts/test-guards.sh proves that guard still fires.

## Consequences

- No feature blocks on Juleb access. Browsing, cart, payment, and prescription review are all
  buildable and testable now.
- The contract test suite the mock satisfies becomes the acceptance criteria for the real
  driver, so the swap-in is verifiable rather than hopeful.
- A Juleb outage in production degrades only the order push, which is queued in a
  transactional outbox and surfaced in admin. It cannot take down the storefront.
- Cost: the mock fixtures encode assumptions about Juleb's data model. Those assumptions will
  be wrong in detail. The mapper layer localises the correction to one file.

## Alternatives rejected

- **Guess the API from conventions.** Produces fiction that fails late. Rejected outright.
- **Block the build until Juleb responds.** Hands schedule control to a third party for work
  that does not need it.
- **Call Juleb directly from feature code once access arrives.** Spreads an unstable external
  contract through the codebase and makes the eventual schema change a refactor instead of a
  one-file edit.
