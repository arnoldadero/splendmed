import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatMoney } from '@splendmed/domain';

import { ProductImage } from '@/components/product-image';
import { getProductBySlug } from '@/lib/catalog';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getProductBySlug(slug);
  return { title: item?.product.name ?? 'Not found' };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getProductBySlug(slug);
  if (!item) notFound();

  const { product, availability, discount } = item;
  const needsRx = product.dispensing !== 'otc';
  const outOfStock = availability === 'out_of_stock';

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="flex aspect-square items-center justify-center rounded-xl bg-secondary p-16 text-brand-teal">
          <ProductImage product={product} className="h-full w-full" />
        </div>

        <div>
          {product.brand && (
            <Link
              href={`/shop/brand/${product.brand.slug}`}
              className="text-sm font-semibold text-brand-teal hover:underline"
            >
              {product.brand.name}
            </Link>
          )}
          <h1 className="mt-1 text-3xl font-bold">{product.name}</h1>
          {product.genericName && (
            <p className="mt-1 text-muted-foreground">{product.genericName}</p>
          )}

          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
            {product.form && (
              <>
                <dt className="text-muted-foreground">Form</dt>
                <dd className="font-medium">{product.form}</dd>
              </>
            )}
            {product.strength && (
              <>
                <dt className="text-muted-foreground">Strength</dt>
                <dd className="font-medium">{product.strength}</dd>
              </>
            )}
            {product.packSize && (
              <>
                <dt className="text-muted-foreground">Pack size</dt>
                <dd className="font-medium">{product.packSize}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Sold as</dt>
            <dd className="font-medium">{product.unitLabel}</dd>
          </dl>

          <p className="mt-6 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-bold">{formatMoney(product.price)}</span>
            {product.compareAtPrice && (
              <s className="text-muted-foreground">{formatMoney(product.compareAtPrice)}</s>
            )}
            {discount !== null && (
              <span className="rounded-full bg-brand-lime px-2 py-0.5 text-xs font-bold text-brand-deep">
                {discount}% off
              </span>
            )}
          </p>

          {/*
            Unmissable, above the add-to-cart control. §10.1 and the MyDawa
            reference both put this here: a shopper who discovers it at checkout
            has wasted their time.
          */}
          {needsRx && (
            <div className="mt-6 rounded-lg border border-brand-teal bg-brand-teal/5 p-4">
              <h2 className="font-semibold text-brand-deep">
                {product.dispensing === 'controlled'
                  ? 'Controlled medicine — prescription required'
                  : 'Prescription required'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A pharmacist registered with the Pharmacy and Poisons Board will check your
                prescription before this is dispensed. You can add it to your basket now and upload
                the prescription at checkout.
              </p>
            </div>
          )}

          <button
            type="button"
            className={
              outOfStock
                ? 'mt-6 w-full rounded-lg border border-border px-5 py-3 font-semibold sm:w-auto'
                : 'mt-6 w-full rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground sm:w-auto'
            }
          >
            {outOfStock ? 'Notify me when available' : 'Add to cart'}
          </button>

          {/*
            Availability, not a count. Stock is a stale projection of Juleb
            (§3.7) and "7 left" would imply precision we do not have.
          */}
          <p className="mt-3 text-sm text-muted-foreground">
            {availability === 'in_stock' && 'In stock at Kisumu CBD.'}
            {availability === 'low_stock' && 'Low stock at Kisumu CBD — we will confirm on ordering.'}
            {outOfStock && 'Not currently available at Kisumu CBD.'}
          </p>

          <p className="mt-6 text-xs text-muted-foreground">
            We do not publish dosage or treatment guidance online. Ask our pharmacist.
          </p>
        </div>
      </div>
    </div>
  );
}
