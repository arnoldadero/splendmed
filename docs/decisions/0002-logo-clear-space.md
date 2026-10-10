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

## Resolution — 2026-10-10

Resolved by measurement rather than by waiting on trimmed exports.

Reading each PNG's alpha channel showed the wordmarks used **33%** of their canvas
and the icons **13%**. In the header at 32px the visible logo was about 14px tall,
with the enforced clear space added on top of the baked-in margin. Every file is
now cropped to its content plus a 6px margin for anti-aliased edges. Only
transparent canvas was removed — no pixel of the mark changed, so this stays
within the guideline's no-alteration rule. Originals are preserved in
`docs/brand/original-artboards/`.

A second, larger fault surfaced at the same time. The file mapped as "primary"
(`Main Logo 4- Combination@4x.png`) is the **light-grey wordmark for dark
backgrounds**, and it had been shipped on a white header. The full-colour primary
mark — teal Splend, lime Med — was the file dismissed as `Artboard 1@4x.png`. It
was chosen by filename rather than by looking at it.

Files are renamed to say what they are (`logo-colour`, `logo-on-dark`,
`icon-colour`, `icon-deep`), `<Logo>` defaults to `auto` — full colour on light,
on-dark in dark mode, swapped in CSS with no JavaScript — and the clear space is
now the guideline's exact 50%. Tests fail if an uncropped asset returns or if any
`/brand` path in source points at a missing file.
