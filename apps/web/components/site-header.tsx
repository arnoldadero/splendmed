import Link from 'next/link';

import { Logo } from '@/components/logo';
import { getCartCount } from '@/lib/cart';
import { getBrands, getCategories, getConditions } from '@/lib/catalog';

/**
 * Storefront header.
 *
 * Reviewed against the ui-ux-pro-max checklist; the decisions below trace to it.
 *
 *  - The trust strip carries two claims the site enforces: every prescription is
 *    checked by a registered pharmacist, and delivery is to a stated area. It sits
 *    outside the sticky region and scrolls away — it is information, not
 *    navigation.
 *  - Sticky from md upward only. On a phone the full header is ~200px, which
 *    pinned would take a third of the screen away from the products
 *    (content-priority). The html scroll-padding in globals.css keeps focused
 *    elements clear of it where it is sticky (WCAG 2.2 Focus Not Obscured).
 *  - Every interactive item is at least 44px tall (touch-target-size). Most of
 *    this audience shops on a phone.
 *  - Dropdown panels overlay rather than expand inline, and on small screens span
 *    the nav's width, so a panel opened near the right edge cannot run off the
 *    viewport and cause horizontal scroll.
 */
export async function SiteHeader() {
  const [categories, conditions, brands, cartCount] = await Promise.all([
    getCategories(),
    getConditions(),
    getBrands(),
    getCartCount(),
  ]);

  return (
    <>
      <div className="bg-brand-deep text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-1.5 text-xs">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full bg-brand-lime"
            />
            Every prescription checked by a registered pharmacist
          </span>
          <span>
            Delivering in <strong className="font-semibold">Kisumu</strong> · Collect at Kisumu
            CBD
          </span>
        </div>
      </div>

      <header className="z-40 border-b border-border bg-background md:sticky md:top-0 md:bg-background/95 md:shadow-sm md:backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr] items-center gap-x-3 px-2 sm:grid-cols-[auto_1fr_auto] sm:gap-x-4 sm:px-4">
          <Link href="/" aria-label="SplendMed Pharmacy home" className="justify-self-start rounded-lg">
            {/* 40px mark with the guideline's full 50% clear space: 20px each side. */}
            <Logo height={40} priority />
          </Link>

          <div className="flex items-center justify-end gap-1 sm:order-last">
            <Link
              href="/account"
              className="hidden min-h-11 items-center rounded-lg px-3 text-sm font-semibold hover:bg-secondary sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/cart"
              aria-label={`Cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-deep"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 6h15l-1.5 9h-12z" />
                <path d="M6 6 5 3H2" />
                <circle cx="9" cy="20" r="1.5" />
                <circle cx="18" cy="20" r="1.5" />
              </svg>
              {/* The aria-label states the full count, so the visible text is not
                  announced twice. */}
              <span aria-hidden="true">Cart</span>
              <span aria-hidden="true" data-testid="cart-count" className="tabular-nums">
                ({cartCount})
              </span>
            </Link>
          </div>

          <form action="/search" role="search" className="col-span-2 pb-3 sm:col-span-1 sm:pb-0">
            <label htmlFor="q" className="sr-only">
              Search for a medicine or product
            </label>
            <div className="relative">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              {/* 16px on phones: anything smaller makes iOS Safari zoom the page on focus. */}
              <input
                id="q"
                name="q"
                type="search"
                enterKeyHint="search"
                placeholder="Search medicines by brand or generic name"
                className="min-h-11 w-full rounded-full border border-input bg-background py-2 pl-10 pr-4 text-base focus:border-primary sm:text-sm"
              />
            </div>
          </form>
        </div>

        <nav aria-label="Catalog" className="border-t border-border">
          <ul className="relative mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 px-2 text-sm sm:px-4">
            <TaxonMenu title="Shop by category" axis="category" taxa={categories} />
            <TaxonMenu title="Shop by condition" axis="condition" taxa={conditions} />
            <TaxonMenu title="Shop by brand" axis="brand" taxa={brands} />
            <li>
              <Link
                href="/shop/offers"
                className="flex min-h-11 items-center rounded-lg px-3 font-semibold hover:bg-secondary"
              >
                Offers
              </Link>
            </li>
            <li className="sm:ml-auto">
              <Link
                href="/checkout"
                className="flex min-h-11 items-center rounded-lg px-3 font-semibold text-primary hover:bg-secondary"
              >
                Upload a prescription
              </Link>
            </li>
            <li>
              {/* Reachable during the demo. Phase 6 gates this to the pharmacist role. */}
              <Link
                href="/console"
                className="flex min-h-11 items-center rounded-lg px-3 font-medium text-muted-foreground hover:bg-secondary"
              >
                Pharmacist console
              </Link>
            </li>
          </ul>
        </nav>
      </header>
    </>
  );
}

function TaxonMenu({
  title,
  axis,
  taxa,
}: {
  title: string;
  axis: 'category' | 'condition' | 'brand';
  taxa: readonly { slug: string; label: string; productCount: number }[];
}) {
  return (
    <li>
      {/*
        <details> is a keyboard-operable disclosure with no JavaScript, which keeps
        the nav working on a slow connection (§12). Positioned relative to the whole
        nav on small screens, so the panel spans it instead of running off the right
        edge; relative to its own summary from sm upward.
      */}
      <details className="group sm:relative">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-lg px-3 font-semibold hover:bg-secondary group-open:bg-secondary marker:content-none [&::-webkit-details-marker]:hidden">
          {title}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <ul className="absolute left-2 right-2 top-full z-50 mt-1 grid max-h-[70vh] gap-0.5 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-xl sm:left-0 sm:right-auto sm:w-72">
          {taxa.map((taxon) => (
            <li key={taxon.slug}>
              <Link
                href={`/shop/${axis}/${taxon.slug}`}
                className="flex min-h-11 items-center justify-between rounded-lg px-3 hover:bg-secondary"
              >
                <span>{taxon.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {taxon.productCount}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}
