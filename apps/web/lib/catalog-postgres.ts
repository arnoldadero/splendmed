import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { money, type DispensingClass, type Product, type UnitLabel } from '@splendmed/domain';

/**
 * Reads the catalogue from the Postgres projection that sync-catalog fills
 * (packages/db/src/sync-catalog.ts).
 *
 * Uses the publishable key, so every read goes through RLS as an anonymous
 * shopper — the same rights a browser has. The catalogue policies allow public
 * reads of active rows and nothing else, so this module cannot see or change
 * anything a shopper could not.
 *
 * `id` is Juleb's product id, as on the mock path, so switching source does not
 * invalidate a shopper's cart cookie.
 */

interface ProductRow {
  juleb_product_id: string;
  slug: string;
  name: string;
  generic_name: string | null;
  brand_name: string | null;
  form: string | null;
  strength: string | null;
  pack_size: string | null;
  unit_label: string;
  dispensing_class: string;
  price_minor: number;
  compare_at_price_minor: number | null;
  vat_rate_bp: number;
  image_url: string | null;
  category_ids: string[];
  condition_ids: string[];
  is_active: boolean;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function toProduct(r: ProductRow): Product {
  return {
    id: r.juleb_product_id,
    julebProductId: r.juleb_product_id,
    slug: r.slug,
    name: r.name,
    genericName: r.generic_name,
    brand: r.brand_name ? { id: slugify(r.brand_name), slug: slugify(r.brand_name), name: r.brand_name } : null,
    form: r.form,
    strength: r.strength,
    packSize: r.pack_size,
    unitLabel: r.unit_label as UnitLabel,
    // Constrained by a CHECK in the schema, so the cast cannot admit a value the
    // domain union does not have.
    dispensing: r.dispensing_class as DispensingClass,
    price: money(Number(r.price_minor)),
    compareAtPrice: r.compare_at_price_minor === null ? null : money(Number(r.compare_at_price_minor)),
    vatRateBasisPoints: r.vat_rate_bp,
    imageUrl: r.image_url,
    categoryIds: r.category_ids,
    conditionIds: r.condition_ids,
    isActive: r.is_active,
  };
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'CATALOG_SOURCE=postgres needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface Shelf {
  readonly products: readonly Product[];
  /** Units available at the branch, keyed by Juleb product id. */
  readonly quantities: ReadonlyMap<string, number>;
}

export async function loadShelfFromPostgres(julebBranchId: string): Promise<Shelf> {
  const db = client();

  const [products, branch] = await Promise.all([
    db.from('products').select('*').eq('is_active', true).order('name'),
    db.from('branches').select('id').eq('juleb_branch_id', julebBranchId).maybeSingle(),
  ]);
  if (products.error) throw new Error(`catalogue read failed: ${products.error.message}`);
  if (branch.error) throw new Error(`branch read failed: ${branch.error.message}`);

  const quantities = new Map<string, number>();
  if (branch.data) {
    const levels = await db
      .from('inventory_levels')
      .select('qty_available, products!inner(juleb_product_id)')
      .eq('branch_id', branch.data.id);
    if (levels.error) throw new Error(`stock read failed: ${levels.error.message}`);
    for (const row of levels.data as unknown as {
      qty_available: number;
      products: { juleb_product_id: string };
    }[]) {
      quantities.set(row.products.juleb_product_id, row.qty_available);
    }
  }

  return { products: (products.data as ProductRow[]).map(toProduct), quantities };
}
