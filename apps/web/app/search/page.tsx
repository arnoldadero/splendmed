import { ProductGrid } from '@/components/product-card';
import { getCatalog } from '@/lib/catalog';

export const metadata = { title: 'Search' };

/**
 * Interim search. Matches brand and generic name, because patients look for both
 * ("Panadol" and "paracetamol"). Phase 3 proper replaces this with Postgres
 * full-text search once the catalog projection exists; the matching rule here is
 * deliberately simple rather than a hand-rolled relevance algorithm that would be
 * thrown away.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const query = q.trim().toLowerCase();
  const catalog = await getCatalog();

  const results = query
    ? catalog.filter(({ product }) =>
        [product.name, product.genericName, product.brand?.name]
          .filter((v): v is string => Boolean(v))
          .some((field) => field.toLowerCase().includes(query)),
      )
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">{query ? `Results for "${q}"` : 'Search'}</h1>
      <p className="mt-2 text-muted-foreground">
        {query
          ? `${results.length} ${results.length === 1 ? 'match' : 'matches'}`
          : 'Search by brand name or generic name.'}
      </p>
      {query && (
        <div className="mt-8">
          <ProductGrid items={results} />
        </div>
      )}
    </div>
  );
}
