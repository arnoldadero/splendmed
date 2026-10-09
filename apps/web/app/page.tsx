import Link from 'next/link';

import { ProductGrid } from '@/components/product-card';
import { getCatalog, getConditions, getOffers } from '@/lib/catalog';

/**
 * Storefront homepage, composed per docs/product/ux-reference-mydawa.md: hero,
 * primary service CTAs, offers, then condition-led entry points.
 *
 * Copy is written for SplendMed's voice (§6: warm, plain-spoken, competent) — the
 * reference informs structure, not wording.
 */
export default async function HomePage() {
  const [offers, catalog, conditions] = await Promise.all([
    getOffers(),
    getCatalog(),
    getConditions(),
  ]);

  // "New" stands in for a recency sort until the catalog carries a created_at
  // from Juleb. Labelled honestly as a selection, not as arrivals.
  const featured = catalog.slice(0, 4);

  return (
    <>
      <section aria-labelledby="hero-heading" className="border-b border-border bg-secondary">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-teal">
            Pharmacy &amp; wellness · Kisumu
          </p>
          <h1
            id="hero-heading"
            className="mt-3 max-w-3xl text-4xl font-bold leading-tight text-balance sm:text-5xl"
          >
            Trusted medicine, and care that looks after the whole person.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Order what you need and have it checked by a licensed pharmacist before it leaves our
            counter.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/prescriptions/new"
              className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground"
            >
              Upload a prescription
            </Link>
            <Link
              href="/pharmacist"
              className="rounded-lg border border-brand-deep px-5 py-3 font-semibold"
            >
              Speak to a pharmacist
            </Link>
          </div>
        </div>
      </section>

      {offers.length > 0 && (
        <section aria-labelledby="offers-heading" className="mx-auto max-w-6xl px-4 py-12">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 id="offers-heading" className="text-2xl font-bold">
              Offers for you
            </h2>
            <Link href="/shop/offers" className="text-sm font-semibold text-brand-teal hover:underline">
              View all
            </Link>
          </div>
          <ProductGrid items={offers.slice(0, 4)} />
        </section>
      )}

      <section aria-labelledby="conditions-heading" className="border-y border-border bg-secondary">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 id="conditions-heading" className="text-2xl font-bold">
            Shop by condition
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Managing something ongoing? Start here.
          </p>
          <ul className="mt-6 flex flex-wrap gap-3">
            {conditions.map((condition) => (
              <li key={condition.slug}>
                <Link
                  href={`/shop/condition/${condition.slug}`}
                  className="inline-block rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-brand-teal"
                >
                  {condition.label}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    {condition.productCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="featured-heading" className="mx-auto max-w-6xl px-4 py-12">
        <h2 id="featured-heading" className="mb-6 text-2xl font-bold">
          From our shelves
        </h2>
        <ProductGrid items={featured} />
      </section>
    </>
  );
}
