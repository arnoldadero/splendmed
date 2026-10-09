import { ProductGrid } from '@/components/product-card';
import { getCatalog } from '@/lib/catalog';

export const metadata = {
  title: 'All products',
  description: 'Every product currently stocked at SplendMed Pharmacy, Kisumu.',
};

/** Shop index. /shop previously 404'd, which the sitemap and 404 page both link to. */
export default async function ShopPage() {
  const catalog = await getCatalog();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">All products</h1>
      <p className="mt-2 text-muted-foreground">
        {catalog.length} {catalog.length === 1 ? 'product' : 'products'} in stock at Kisumu CBD.
        Narrow it down by category, condition or brand from the menu above.
      </p>
      <div className="mt-8">
        <ProductGrid items={catalog} />
      </div>
    </div>
  );
}
