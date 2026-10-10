import {
  availabilityOf,
  discountPercent,
  type Availability,
  type Product,
} from '@splendmed/domain';
import { getJulebClient } from '@splendmed/juleb';

import { loadShelfFromPostgres } from '@/lib/catalog-postgres';
import { localImageFor } from '@/lib/product-images';

/**
 * Server-side catalog access.
 *
 * Reads the Postgres projection in production and the Juleb port in tests (see
 * catalogSource below). The component layer takes domain types, so the source
 * can change without anything above this module noticing.
 *
 * Never import this from a client component — it resolves the Juleb driver, which
 * reads server-only configuration.
 */

const DEFAULT_BRANCH = 'JB-KSM-001';

/**
 * Human labels for Juleb's taxonomy ids.
 *
 * Juleb returns category and condition ids but we have not been told whether it
 * exposes display names for them (questions 7c and 5 in docs/integrations/juleb.md).
 * Until then the labels live here rather than being derived from the id, because
 * de-slugging "JC-MUMANDBABY" into something presentable is guesswork.
 */
const CATEGORY_LABELS: Record<string, string> = {
  'JC-PAINRELIEF': 'Pain and Fever',
  'JC-ANTIMALARIAL': 'Malaria Treatment',
  'JC-ANTIBIOTIC': 'Antibiotics',
  'JC-ENDOCRINE': 'Diabetes Care',
  'JC-CARDIOVASCULAR': 'Heart and Blood Pressure',
  'JC-RESPIRATORY': 'Asthma and Breathing',
  'JC-COUGHCOLD': 'Cough, Cold and Allergy',
  'JC-DIGESTIVE': 'Stomach and Digestion',
  'JC-SKINCARE': 'Skin Treatment',
  'JC-PERSONALCARE': 'Personal Care',
  'JC-MUMANDBABY': 'Mum and Baby',
  'JC-SUPPLEMENTS': 'Supplements and Nutrition',
  'JC-DEVICES': 'Medical Devices',
  'JC-CNS': 'Mental Health',
};

const CONDITION_LABELS: Record<string, string> = {
  'JH-PAIN': 'Pain',
  'JH-FEVER': 'Fever',
  'JH-MALARIA': 'Malaria',
  'JH-INFECTION': 'Infection',
  'JH-DIABETES': 'Diabetes',
  'JH-HYPERTENSION': 'High Blood Pressure',
  'JH-ASTHMA': 'Asthma',
  'JH-COUGH': 'Cough and Cold',
  'JH-ALLERGY': 'Allergies',
  'JH-INDIGESTION': 'Heartburn and Indigestion',
  'JH-SKIN': 'Skin Conditions',
  'JH-IMMUNITY': 'Immunity',
  'JH-ANAEMIA': 'Anaemia',
  'JH-PREGNANCY': 'Pregnancy',
  'JH-ANXIETY': 'Anxiety and Sleep',
};

export interface Taxon {
  readonly id: string;
  readonly slug: string;
  readonly label: string;
  readonly productCount: number;
}

/** A product plus everything the card needs, resolved once on the server. */
export interface CatalogItem {
  readonly product: Product;
  readonly availability: Availability;
  readonly discount: number | null;
}

function slugForTaxon(id: string): string {
  return id.replace(/^J[CH]-/, '').toLowerCase();
}

/**
 * Where the catalogue comes from — the single decision point (§8.2 forbids
 * `if (mock)` branches scattered through feature code).
 *
 *  - `postgres`: the projection that sync-catalog fills. Production.
 *  - `juleb`: straight through the Juleb port. Tests and local runs without a
 *    database.
 *
 * Explicit rather than inferred from whether Supabase is configured, so a
 * misconfigured deploy fails loudly instead of quietly serving the mock.
 */
function catalogSource(): 'postgres' | 'juleb' {
  const source = process.env.CATALOG_SOURCE ?? 'juleb';
  if (source === 'postgres' || source === 'juleb') return source;
  throw new Error(`CATALOG_SOURCE must be "postgres" or "juleb", received "${source}"`);
}

async function loadShelf(): Promise<{
  products: readonly Product[];
  quantities: ReadonlyMap<string, number>;
}> {
  if (catalogSource() === 'postgres') {
    return loadShelfFromPostgres(DEFAULT_BRANCH);
  }

  const client = getJulebClient();
  const collected: Product[] = [];
  let cursor: string | null = null;
  do {
    const page = await client.listProducts(cursor ? { cursor, limit: 100 } : { limit: 100 });
    collected.push(...page.products);
    cursor = page.nextCursor;
  } while (cursor);
  const products = collected.filter((p) => p.isActive);

  const stock = await client.getStock({
    branchId: DEFAULT_BRANCH,
    julebProductIds: products.flatMap((p) => (p.julebProductId ? [p.julebProductId] : [])),
  });
  return { products, quantities: new Map(stock.map((s) => [s.productId, s.quantityAvailable])) };
}

export async function getCatalog(): Promise<readonly CatalogItem[]> {
  const { products, quantities } = await loadShelf();

  return products.map((product) => {
    const quantity = product.julebProductId ? quantities.get(product.julebProductId) : undefined;
    const level = quantity === undefined ? undefined : { quantityAvailable: quantity };
    return {
      // Juleb's own image wins; otherwise fall back to photography supplied in
      // public/products/. ProductImage draws the dosage form if neither exists.
      product: {
        ...product,
        imageUrl:
          product.imageUrl ?? localImageFor([product.julebProductId, product.slug]),
      },
      // No stock row means we have no information, which is not the same as
      // "in stock". Treat the unknown case as unavailable rather than promising
      // something we cannot fulfil (§3.7).
      availability: level ? availabilityOf(level) : 'out_of_stock',
      discount: discountPercent(product.price, product.compareAtPrice),
    };
  });
}

export async function getProductBySlug(slug: string): Promise<CatalogItem | undefined> {
  const catalog = await getCatalog();
  return catalog.find((item) => item.product.slug === slug);
}

function taxaFrom(
  catalog: readonly CatalogItem[],
  pick: (item: CatalogItem) => readonly string[],
  labels: Record<string, string>,
): readonly Taxon[] {
  const counts = new Map<string, number>();
  for (const item of catalog) {
    for (const id of pick(item)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, productCount]) => ({
      id,
      slug: slugForTaxon(id),
      label: labels[id] ?? id,
      productCount,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function getCategories(): Promise<readonly Taxon[]> {
  const catalog = await getCatalog();
  return taxaFrom(catalog, (i) => i.product.categoryIds, CATEGORY_LABELS);
}

export async function getConditions(): Promise<readonly Taxon[]> {
  const catalog = await getCatalog();
  return taxaFrom(catalog, (i) => i.product.conditionIds, CONDITION_LABELS);
}

export async function getBrands(): Promise<readonly Taxon[]> {
  const catalog = await getCatalog();
  const counts = new Map<string, { label: string; count: number }>();
  for (const { product } of catalog) {
    if (!product.brand) continue;
    const existing = counts.get(product.brand.slug);
    counts.set(product.brand.slug, {
      label: product.brand.name,
      count: (existing?.count ?? 0) + 1,
    });
  }
  return [...counts.entries()]
    .map(([slug, v]) => ({ id: slug, slug, label: v.label, productCount: v.count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function getByTaxon(
  axis: 'category' | 'condition' | 'brand',
  slug: string,
): Promise<{ taxon: Taxon | undefined; items: readonly CatalogItem[] }> {
  const catalog = await getCatalog();
  const taxa =
    axis === 'category'
      ? await getCategories()
      : axis === 'condition'
        ? await getConditions()
        : await getBrands();
  const taxon = taxa.find((t) => t.slug === slug);
  if (!taxon) return { taxon: undefined, items: [] };

  const items = catalog.filter((item) =>
    axis === 'brand'
      ? item.product.brand?.slug === slug
      : (axis === 'category' ? item.product.categoryIds : item.product.conditionIds).includes(
          taxon.id,
        ),
  );
  return { taxon, items };
}

/** Offers carousel: anything with a genuine discount, deepest first. */
export async function getOffers(): Promise<readonly CatalogItem[]> {
  const catalog = await getCatalog();
  return catalog
    .filter((i) => i.discount !== null)
    .sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0));
}
