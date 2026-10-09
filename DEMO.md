# SplendMed — demo script

Live: **https://splendmed.vercel.app**

Five minutes, one continuous story: a patient orders a prescription medicine, a
pharmacist reviews it, the patient sees the outcome. Follow it in order — the
steps depend on each other.

---

## 1. The shelf (45 seconds)

Open **https://splendmed.vercel.app**

- 54 products across 14 categories. Prices in KES with thousands separators.
- Open **Shop by condition** in the nav. This is the point to make: patients do
  not think in categories, they think "I have malaria". Most pharmacy sites
  only offer category browsing.
- Click **Malaria**. Note the line stating these are grouped for browsing and
  are not a treatment recommendation.

## 2. Search the way patients search (30 seconds)

Type **paracetamol** in the search box.

Panadol, Panadol Advance, Hedex, Mara Moja and Calpol all come back — brand
names found by their generic ingredient. A patient told "take paracetamol" at a
clinic can find what is actually on the shelf.

## 3. Stock is honest (30 seconds)

On any listing, point out the three states: **In stock**, **Low stock**, and
out-of-stock items showing **Notify me** instead of a dead button.

Why it matters: stock comes from Juleb and is a cached projection, so it is
stale by definition. The site says "availability", never "7 left" — it does not
claim precision it does not have.

## 4. Prescription gating (45 seconds)

Open **Coartem** (malaria, prescription-only).

- The prescription notice sits **above** the add button, not at checkout. A
  shopper who discovers it after filling a basket has wasted their time.
- Open **Diazepam** to show the stricter wording for a controlled medicine.
- Note: the site never publishes dosage guidance. That is deliberate.

## 5. Order a prescription medicine (90 seconds)

1. Add **Coartem** to the cart.
2. Go to the cart. It warns that the basket contains prescription medicine.
3. **Checkout**. Fill in a name and a Kenyan mobile number (`0712345678`).
4. Upload a prescription — any photo will do for the demo. A preview appears.
5. **Place order**.

You land on the order page: **Awaiting pharmacist review**.

Try it without the upload to show the server refuse the order. The check is
server-side, so removing the field in the browser does not help.

## 6. The pharmacist side (90 seconds)

Open **https://splendmed.vercel.app/console** (a second tab or window).

- The order is in the queue, oldest first, with its waiting time.
- A controlled medicine would carry a red **Controlled** flag.
- Open it. The prescription image sits beside the requested items, because the
  decision is whether one justifies the other.
- Record your name, the prescriber and their registration number.
- **Approve and dispense.**

## 7. Close the loop (30 seconds)

Go back to the patient's order tab and refresh.

Status is now **Approved — preparing your order**, naming the reviewing
pharmacist. Run it again choosing **Reject** with a note, and the patient sees
the note and what to do next.

---

## If asked what is real

Be straight about this; it is more convincing than claiming everything works.

**Real and tested** — 150 unit tests, 22 row-level-security tests against real
Postgres, 15 browser tests against the live site.

- Catalogue, search, three-axis navigation, cart, order placement, prescription
  upload, pharmacist review, approval and rejection.
- The database schema for accounts, roles and audit, with its security policies
  proven — a patient cannot read another patient's record, cannot grant
  themselves a pharmacist role, and nobody can edit the audit trail.
- Works on a phone, and the navigation works with JavaScript switched off.

**Not real yet**

- **Payment.** No M-Pesa. Checkout says so plainly rather than pretending.
- **Accounts.** The schema and security are built and tested; the sign-in
  screen is not.
- **The catalogue is representative, not SplendMed's actual stock.** Real
  products and prices come from Juleb.
- **Orders live in memory**, so a redeploy clears them. Phase 4 moves them to
  Postgres.
- **Product images are illustrations by dosage form**, not photographs. Real
  photography drops in without a code change.

**The Juleb question, if it comes up:** Juleb publishes no public API
documentation. Rather than guess at endpoints, everything runs through a single
adapter with a mock behind it. The day credentials arrive, one driver is
written against the real specification and nothing else changes. There is a
build check that fails if anyone hardcodes a Juleb URL.

## Reset between runs

Orders are in memory. To clear the queue, redeploy or wait for the server to go
cold. To clear a cart, remove its lines.
