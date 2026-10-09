import Link from 'next/link';

import { formatMoney, type Availability } from '@splendmed/domain';

import { AddToCart } from '@/components/add-to-cart';
import { ProductImage } from '@/components/product-image';
import type { CatalogItem } from '@/lib/catalog';

/**
 * Product card, following the pattern documented in
 * docs/product/ux-reference-mydawa.md.
 *
 * Three details that matter more for a pharmacy than for general retail:
 *  - the unit suffix on the price, because "KES 450" means nothing without
 *    knowing whether it buys one tablet or a pack of 24;
 *  - an unmissable prescription-required state, since a shopper who only finds
 *    out at checkout has wasted their time;
 *  - "Notify me" instead of a dead disabled button when out of stock, which is a
 *    routine state here because our stock is a stale projection of Juleb (§3.7).
 */

const UNIT_SUFFIX: Record<string, string> = {
  piece: '/piece',
  pack: '/pack',
  bottle: '/bottle',
  tube: '/tube',
  sachet: '/sachet',
  vial: '/vial',
  tin: '/tin',
  box: '/box',
};

const AVAILABILITY_COPY: Record<Availability, { label: string; className: string }> = {
  in_stock: { label: 'In stock', className: 'text-brand-deep' },
  low_stock: { label: 'Low stock', className: 'text-amber-700' },
  out_of_stock: { label: 'Out of stock', className: 'text-muted-foreground' },
};

export function ProductCard({ item }: { item: CatalogItem }) {
  const { product, availability, discount } = item;
  const outOfStock = availability === 'out_of_stock';
  const needsRx = product.dispensing !== 'otc';
  const status = AVAILABILITY_COPY[availability];

  return (
    <article className="relative flex h-full flex-col rounded-xl border border-border bg-card p-4">
      {discount !== null && (
        <span className="absolute right-3 top-3 rounded-full bg-brand-lime px-2 py-0.5 text-xs font-bold text-brand-deep">
          {discount}% off
        </span>
      )}

      <div className="mb-3 flex aspect-square items-center justify-center rounded-lg bg-secondary p-5 text-brand-teal">
        <ProductImage product={product} className="h-full w-full" />
      </div>

      <h3 className="font-semibold leading-snug">
        <Link href={`/products/${product.slug}`} className="hover:underline">
          {product.name}
        </Link>
      </h3>

      {product.genericName && product.genericName !== product.name && (
        <p className="mt-0.5 text-xs text-muted-foreground">{product.genericName}</p>
      )}

      <p className="mt-1 text-xs text-muted-foreground">
        {[product.strength, product.packSize].filter(Boolean).join(' · ')}
      </p>

      {needsRx && (
        <p className="mt-2 inline-flex w-fit items-center rounded border border-brand-teal px-1.5 py-0.5 text-xs font-semibold text-brand-teal">
          Prescription required
        </p>
      )}

      <div className="mt-auto pt-3">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-lg font-bold">{formatMoney(product.price)}</span>
          <span className="text-xs text-muted-foreground">
            {UNIT_SUFFIX[product.unitLabel] ?? ''}
          </span>
          {product.compareAtPrice && (
            <s className="text-sm text-muted-foreground">{formatMoney(product.compareAtPrice)}</s>
          )}
        </p>

        <p className={`mt-1 text-xs font-medium ${status.className}`}>{status.label}</p>

        <AddToCart
          productId={product.id}
          outOfStock={outOfStock}
          needsPrescription={needsRx}
          className={
            outOfStock
              ? 'mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm font-semibold'
              : 'mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground'
          }
        />
      </div>
    </article>
  );
}

export function ProductGrid({ items }: { items: readonly CatalogItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-border p-8 text-center text-muted-foreground">
        Nothing here yet. Try another category.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((item) => (
        <li key={item.product.id}>
          <ProductCard item={item} />
        </li>
      ))}
    </ul>
  );
}
