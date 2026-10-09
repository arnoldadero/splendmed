# UX reference: MyDawa

SplendMed's storefront should feel familiar to a Kenyan online-pharmacy shopper. MyDawa
(<https://mydawa.com/>) is the market leader and the closest comparable: same country, same
regulator (Pharmacy and Poisons Board), same payment habits, same prescription workflow.
Patterns below are drawn from their live site on 2026-10-09 and are the target for §10.1.

## What to mimic — structural patterns

These are conventional e-commerce and pharmacy patterns. Adopting them lowers the learning
curve for a shopper arriving from MyDawa.

### Navigation

Three orthogonal ways into the catalog, not just one:

| Entry point | Why it matters for a pharmacy |
|---|---|
| **Shop by Category** | Browsing behaviour — "Mum and Baby", "Personal Care", "Supplements" |
| **Shop by Condition** | How patients actually think — "Diabetes", "Hypertension", "Malaria" |
| **Shop by Brand** | Brand loyalty is strong in Kenyan OTC — plus "Browse all brands" |

Plus a **Services** menu (Submit a Prescription, Book a Consultation) and a **Health Centre**
grouping chronic-care programmes. The condition-based axis is the one most e-commerce
templates miss and the one most valuable here — SplendMed's wellness positioning depends on it.

### Header

- Logo, search, **delivery location selector** (MyDawa shows "Delivery to 80100, Mombasa"),
  Deals, Sign In, cart with running total.
- Location in the header, not buried at checkout. Delivery zone changes availability and fee,
  so the shopper should see it before they fill a basket.

### Search

- Overlay panel, not just an inline input.
- **Recent searches** (with "Clear all") and **trending searches** as a ranked list.
- An **Upload Prescription** button inside the search panel — searching for a POM is exactly
  when a shopper discovers they need one.

### Product card

- Discount badge ("25% Off").
- Struck-through original price beside the current price.
- **Unit suffix** on the price — "/pieces", "/packets", "/bottles", "/tube". Pharmacy items
  are sold in wildly different units and the suffix prevents real confusion.
- Wishlist and quick-view affordances.
- **"Notify Me" replaces "Add to Cart" when out of stock** rather than a dead disabled
  button. This matters more for us than for them: our stock is a stale projection of Juleb
  (§3.7), so out-of-stock is a routine state, not an edge case.

### Homepage composition

Hero with a brand line, then a promotional banner carousel, then "Get Started" category
tiles carrying the two primary CTAs (Speak to a Pharmacist, Upload a Prescription), then
product carousels: Offers, New arrivals, seasonal/popular. A guided-recommendation promo
(MyDawa runs a supplement quiz).

### Pricing and cart

- KES with thousands separators: "KES 1,795".
- Cart drawer with a real empty state ("Your cart is empty" + "Start Shopping"), not a blank panel.

### Account

- Sign-in framed around benefit, not obligation: "access your orders, wishlist, and
  personalised health services".
- Saved addresses and faster checkout as the stated reason to create an account.
- Free account creation.

## What NOT to copy

- **Their brand.** No MyDawa name, logo, colours, or typography. SplendMed has its own
  guideline (§6) and it governs.
- **Their copy verbatim.** Headings and microcopy must be written for SplendMed's voice —
  the brand values call for warm and plain-spoken (§6). "What's your MYDAWA thing?" is theirs.
- **Their prices or product data.** Ours come from Juleb.
- **Unsubstantiated trust claims.** MyDawa's title claims "Kenya's Most Trusted Online
  Pharmacy" and the page shows no licence number or regulator badge to back it. We go the
  other way: surface the actual PPB licence and the pharmacist-in-charge per branch. For a
  new entrant, verifiable specifics beat superlatives.
- **Clinical guidance we have not licensed.** They run condition hubs and a supplement quiz.
  We may build the condition *navigation* without generating dosage or treatment advice
  (§16.7).

## Mapping to phases

| Pattern | Phase |
|---|---|
| Category / condition / brand navigation, search overlay, product cards, homepage carousels | 3 |
| Delivery location selector, cart drawer, prescription upload in checkout | 4 |
| Wishlist, notify-me subscriptions | 4 (schema), later for notification delivery |
| Consultation booking, condition hubs, chronic-care programmes | out of scope for v1 — see §10 |

## Schema implications

Recorded here so Phase 3 does not have to rediscover them:

- `products` needs a **`unit_label`** ("pieces", "packets", "bottles", "tube") for the price
  suffix, and a **`compare_at_price_minor`** to render a struck-through original and derive
  the discount badge. Neither is in the §7 sketch.
- Conditions are a **separate taxonomy** from categories, many-to-many against products.
  A single category tree cannot express "shop by condition".
- Brands need to be an entity, not a text field, to support a brand index page.
- Out-of-stock needs a **notify-me subscription** table keyed on product + user.

All four originate in Juleb for a real catalog, so they go on the open-questions list in
docs/integrations/juleb.md.
