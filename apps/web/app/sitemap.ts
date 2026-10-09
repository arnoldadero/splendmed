import type { MetadataRoute } from 'next';

import { getBrands, getCatalog, getCategories, getConditions } from '@/lib/catalog';
import { siteUrl } from '@/lib/site';

/**
 * Sitemap, generated from the live catalogue rather than hand-maintained, so a
 * product added in Juleb becomes discoverable without anyone remembering to
 * edit a list.
 *
 * Cart, checkout and account are excluded — they are disallowed in robots.ts
 * and have nothing to index.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [catalog, categories, conditions, brands] = await Promise.all([
    getCatalog(),
    getCategories(),
    getConditions(),
    getBrands(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/shop`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/shop/offers`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/prescriptions/new`, changeFrequency: 'monthly', priority: 0.7 },
  ];

  const taxonRoutes: MetadataRoute.Sitemap = [
    ...categories.map((t) => ({ url: `${base}/shop/category/${t.slug}`, priority: 0.6 })),
    ...conditions.map((t) => ({ url: `${base}/shop/condition/${t.slug}`, priority: 0.6 })),
    ...brands.map((t) => ({ url: `${base}/shop/brand/${t.slug}`, priority: 0.5 })),
  ];

  const productRoutes: MetadataRoute.Sitemap = catalog.map(({ product }) => ({
    url: `${base}/products/${product.slug}`,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...taxonRoutes, ...productRoutes];
}
