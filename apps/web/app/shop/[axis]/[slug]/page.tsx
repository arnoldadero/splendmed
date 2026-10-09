import { notFound } from 'next/navigation';

import { ProductGrid } from '@/components/product-card';
import { getByTaxon } from '@/lib/catalog';

const AXES = ['category', 'condition', 'brand'] as const;
type Axis = (typeof AXES)[number];

function isAxis(value: string): value is Axis {
  return (AXES as readonly string[]).includes(value);
}

const AXIS_PREFIX: Record<Axis, string> = {
  category: '',
  condition: 'For ',
  brand: '',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ axis: string; slug: string }>;
}) {
  const { axis, slug } = await params;
  if (!isAxis(axis)) return {};
  const { taxon } = await getByTaxon(axis, slug);
  return { title: taxon ? `${AXIS_PREFIX[axis]}${taxon.label}` : 'Not found' };
}

export default async function TaxonPage({
  params,
}: {
  params: Promise<{ axis: string; slug: string }>;
}) {
  const { axis, slug } = await params;
  if (!isAxis(axis)) notFound();

  const { taxon, items } = await getByTaxon(axis, slug);
  if (!taxon) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-teal">
        {axis === 'condition' ? 'Condition' : axis === 'brand' ? 'Brand' : 'Category'}
      </p>
      <h1 className="mt-2 text-3xl font-bold">
        {AXIS_PREFIX[axis]}
        {taxon.label}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {items.length} {items.length === 1 ? 'product' : 'products'}
      </p>

      {axis === 'condition' && (
        <p className="mt-4 max-w-2xl rounded-lg border border-border bg-secondary p-4 text-sm">
          These products are grouped for browsing only. They are not a treatment recommendation —
          speak to our pharmacist about what is right for you.
        </p>
      )}

      <div className="mt-8">
        <ProductGrid items={items} />
      </div>
    </div>
  );
}
