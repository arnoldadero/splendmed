# Product images

## How to add one

Drop a file into `apps/web/public/products/`, named after either the Juleb
product id or the product slug:

```
apps/web/public/products/JP-0001.jpg
apps/web/public/products/panadol-extra-500mg-65mg.webp
```

That is the whole process. No code change, no config. Restart the dev server so
the directory is re-read. `.webp`, `.avif`, `.jpg`, `.jpeg` and `.png` all work;
prefer WebP — the storefront targets a mid-range Android on 3G (§12).

Shoot or crop square. The card and detail page both use a square frame, and a
non-square image will be letterboxed rather than cropped, which looks worse.

## What the shopper sees, in order

1. **`image_url` from Juleb** — the distributor's own asset, once Juleb supplies
   one. Nothing to do; it wins automatically.
2. **A file in `public/products/`** — photography SplendMed supplies.
3. **A dosage-form illustration** — the fallback. A blister reads as a blister,
   a syrup as a bottle. Always present, so no product is ever imageless.

## Where to get images legitimately

This matters more for a pharmacy than for general retail, and the convenient
option is the one to avoid.

**Do not** pull images from Google Images, a competitor's storefront, or a
supplier's website without permission. Product packaging carries **two** separate
rights: copyright in the photograph, and trademark in the brand livery. Taking
them is infringement on both counts, and a pharmacy is a visible, regulated
business — not the kind that goes unnoticed.

Use one of these instead:

| Source | Notes |
|---|---|
| **Your own photography** | Best option. Legally clean, and it shows the actual pack the customer receives — including the strength and count on the box. A phone on a white surface near a window is genuinely sufficient. |
| **Manufacturer or distributor trade assets** | Haleon (Panadol), Novartis (Coartem), Roche (Accu-Chek) and the rest supply product imagery to trade customers. Ask your rep — this is routine and usually free. |
| **Juleb** | If Juleb already holds distributor imagery, it should come down the API. This is open question 7e in `docs/integrations/juleb.md`. |

### Sources that do not solve this

Checked, so nobody re-checks them:

- **NLM RxImage API** — shut down at the end of 2021. The pill photographs were
  removed from DailyMed at the same time.
- **DailyMed label images** — still available, but the images are submitted by
  manufacturers and are *not* public domain; NLM says so explicitly and puts the
  rights check on the user. They are also US products, not the Kenyan brands
  stocked here.
- **C3PI** — the pill-photography programme wound down in 2018.

There is no free, openly-licensed collection of current pharmaceutical packaging.

## A note on the current catalogue

The nine products visible today are **fixtures invented to exercise the Juleb
mock** — Panadol Extra, Coartem, Glucophage and so on. They are plausible Kenyan
pharmacy stock, but they are not SplendMed's actual catalogue, which arrives from
Juleb. Sourcing photography for these specific fixture SKUs would largely be
wasted effort; the pipeline above is the part that lasts.
