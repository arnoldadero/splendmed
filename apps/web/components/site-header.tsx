import Link from 'next/link';

import { Logo } from '@/components/logo';
import { getBrands, getCategories, getConditions } from '@/lib/catalog';

/**
 * Storefront header.
 *
 * Three orthogonal ways into the catalog, per the MyDawa reference: by category
 * (how people browse), by condition (how patients actually think), and by brand
 * (OTC brand loyalty is strong in Kenya). The condition axis is the one generic
 * commerce templates omit and the one this brand's wellness positioning needs.
 *
 * The delivery location sits in the header rather than at checkout because the
 * zone changes both availability and fee — a shopper should see it before they
 * fill a basket.
 */
export async function SiteHeader() {
  const [categories, conditions, brands] = await Promise.all([
    getCategories(),
    getConditions(),
    getBrands(),
  ]);

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <Link href="/" aria-label="SplendMed Pharmacy home">
          <Logo variant="primary" height={32} priority />
        </Link>

        <form action="/search" role="search" className="order-last w-full sm:order-none sm:flex-1">
          <label htmlFor="q" className="sr-only">
            Search for a medicine or product
          </label>
          <input
            id="q"
            name="q"
            type="search"
            placeholder="Search by brand or generic name"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </form>

        <span className="text-xs text-muted-foreground">
          Deliver to <strong className="font-semibold text-foreground">Kisumu CBD</strong>
        </span>

        <Link href="/account" className="text-sm font-semibold hover:underline">
          Sign in
        </Link>

        <Link href="/cart" className="text-sm font-semibold hover:underline">
          Cart <span className="text-muted-foreground">(0)</span>
        </Link>
      </div>

      <nav aria-label="Catalog" className="mx-auto max-w-6xl px-4 pb-3">
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <TaxonMenu title="Shop by category" axis="category" taxa={categories} />
          <TaxonMenu title="Shop by condition" axis="condition" taxa={conditions} />
          <TaxonMenu title="Shop by brand" axis="brand" taxa={brands} />
          <li>
            <Link href="/prescriptions/new" className="font-semibold text-brand-teal hover:underline">
              Upload a prescription
            </Link>
          </li>
        </ul>
      </nav>
    </header>
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
      {/* <details> gives a keyboard-operable disclosure with no JavaScript, which
          keeps the nav working on a slow connection (§12). */}
      <details className="group">
        <summary className="cursor-pointer font-semibold marker:content-none">
          {title}
          <span aria-hidden="true" className="ml-1 text-muted-foreground group-open:hidden">
            +
          </span>
          <span aria-hidden="true" className="ml-1 hidden text-muted-foreground group-open:inline">
            −
          </span>
        </summary>
        <ul className="mt-2 space-y-1 pl-2">
          {taxa.map((taxon) => (
            <li key={taxon.slug}>
              <Link href={`/shop/${axis}/${taxon.slug}`} className="hover:underline">
                {taxon.label}{' '}
                <span className="text-xs text-muted-foreground">({taxon.productCount})</span>
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}
