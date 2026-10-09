# 0002 — Enforce logo clear space in code, and flag the artboard caveat

- Status: accepted, with an open question for the brand owner
- Date: 2026-10-09

## Context

The brand guideline requires clear space around the logo of at least 50% of the height of the
entire logo, and forbids rotating, skewing, recolouring, shadowing, or locking text to it.
Those rules are unenforceable if logo files are referenced ad hoc with raw img tags.

While wiring the assets up, every supplied PNG measured about 1618x948 — including the icon
submarks, which are visually much smaller than the full wordmark. Identical canvas dimensions
across visually different marks means each file already carries transparent margin baked into
the export.

## Decision

1. A single Logo component is the only permitted way to render the logo. It applies clear
   space as padding, so neighbouring content physically cannot encroach on it. Section 6 of
   the build spec bans raw img tags on logo files.
2. The clear-space ratio lives in apps/web/lib/brand.ts as LOGO_CLEAR_SPACE_RATIO, not as a
   magic number at call sites.
3. The artboard caveat is documented in the component itself rather than silently compensated
   for. We do not trim or re-export the assets: the guideline forbids altering them, and
   guessing a crop is exactly the kind of invented precision this project avoids.

## Consequences

Enforced clear space is currently **additive** to the margin already inside each file, so the
effective gap exceeds the guideline minimum. Visually this reads as generous spacing rather
than as a defect, which is the safe direction to err.

## Open question for the brand owner

Request trimmed, tightly-cropped exports of each logo variant — transparent background, no
artboard padding — from Teilyn Media, who authored the guideline. With those, the enforced
50% becomes exact instead of approximate, and dense layouts such as the pharmacist console
header become usable.
