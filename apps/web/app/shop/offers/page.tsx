import { ProductGrid } from '@/components/product-card';
import { getOffers } from '@/lib/catalog';

export const metadata = { title: 'Offers' };

export default async function OffersPage() {
  const offers = await getOffers();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Offers</h1>
      <p className="mt-2 text-muted-foreground">
        {offers.length} {offers.length === 1 ? 'product' : 'products'} currently reduced, deepest
        discount first.
      </p>
      <div className="mt-8">
        <ProductGrid items={offers} />
      </div>
    </div>
  );
}
