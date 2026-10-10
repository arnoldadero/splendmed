import type { JulebClient } from '@splendmed/juleb';

/**
 * Pulls branches, products and stock from Juleb into the Postgres projection
 * (§8.4). The same function backs the PGlite test, the one-off seed, and — once
 * deployed — the scheduled sync-catalog Edge Function, so what is tested is what
 * runs.
 *
 * Takes anything with a pg-style `query(text, params)` — node-postgres and
 * PGlite both qualify — and must run with rights that bypass RLS (the service
 * role, or the database owner): the catalogue has no write policies by design.
 *
 * Upserts are keyed on Juleb's ids, so a re-run converges rather than
 * duplicating, and every run is recorded in juleb_sync_log.
 */
export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface SyncResult {
  readonly branches: number;
  readonly products: number;
  readonly stockRows: number;
}

async function logRun(db: Queryable, resource: string, outcome: 'ok' | 'error', count: number, startedAt: number, error?: string) {
  await db.query(
    `insert into public.juleb_sync_log (direction, resource, outcome, item_count, duration_ms, error)
     values ('pull', $1, $2, $3, $4, $5)`,
    [resource, outcome, count, Date.now() - startedAt, error ?? null],
  );
}

export async function syncCatalog(db: Queryable, juleb: JulebClient): Promise<SyncResult> {
  const startedAt = Date.now();
  try {
    const branches = await juleb.listBranches();
    for (const b of branches) {
      await db.query(
        `insert into public.branches (juleb_branch_id, name, county, ppb_licence_no, pharmacist_in_charge, is_active, synced_at)
         values ($1, $2, $3, $4, $5, $6, now())
         on conflict (juleb_branch_id) do update set
           name = excluded.name, county = excluded.county, ppb_licence_no = excluded.ppb_licence_no,
           pharmacist_in_charge = excluded.pharmacist_in_charge, is_active = excluded.is_active,
           synced_at = excluded.synced_at`,
        [b.julebBranchId, b.name, b.county, b.ppbLicenceNo, b.pharmacistInCharge, b.isActive],
      );
    }
    await logRun(db, 'branches', 'ok', branches.length, startedAt);

    let products = 0;
    let cursor: string | null = null;
    do {
      const page = await juleb.listProducts(cursor ? { cursor, limit: 100 } : { limit: 100 });
      for (const p of page.products) {
        await db.query(
          `insert into public.products (juleb_product_id, slug, name, generic_name, brand_name, form, strength,
             pack_size, unit_label, dispensing_class, price_minor, compare_at_price_minor, vat_rate_bp,
             image_url, category_ids, condition_ids, is_active, synced_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, now())
           on conflict (juleb_product_id) do update set
             slug = excluded.slug, name = excluded.name, generic_name = excluded.generic_name,
             brand_name = excluded.brand_name, form = excluded.form, strength = excluded.strength,
             pack_size = excluded.pack_size, unit_label = excluded.unit_label,
             dispensing_class = excluded.dispensing_class, price_minor = excluded.price_minor,
             compare_at_price_minor = excluded.compare_at_price_minor, vat_rate_bp = excluded.vat_rate_bp,
             image_url = excluded.image_url, category_ids = excluded.category_ids,
             condition_ids = excluded.condition_ids, is_active = excluded.is_active,
             synced_at = excluded.synced_at`,
          [
            p.julebProductId, p.slug, p.name, p.genericName, p.brand?.name ?? null, p.form, p.strength,
            p.packSize, p.unitLabel, p.dispensing, p.price.minor, p.compareAtPrice?.minor ?? null,
            p.vatRateBasisPoints, p.imageUrl, [...p.categoryIds], [...p.conditionIds], p.isActive,
          ],
        );
        products += 1;
      }
      cursor = page.nextCursor;
    } while (cursor);
    await logRun(db, 'products', 'ok', products, startedAt);

    // Stock is keyed by our uuids, so resolve Juleb ids to them first.
    const branchRows = await db.query<{ id: string; juleb_branch_id: string }>(
      `select id, juleb_branch_id from public.branches where is_active and juleb_branch_id is not null`,
    );
    const productRows = await db.query<{ id: string; juleb_product_id: string }>(
      `select id, juleb_product_id from public.products`,
    );
    const productByJuleb = new Map(productRows.rows.map((r) => [r.juleb_product_id, r.id]));

    let stockRows = 0;
    for (const branch of branchRows.rows) {
      const levels = await juleb.getStock({
        branchId: branch.juleb_branch_id,
        julebProductIds: [...productByJuleb.keys()],
      });
      for (const level of levels) {
        const productId = productByJuleb.get(level.productId);
        if (!productId) continue;
        await db.query(
          `insert into public.inventory_levels (branch_id, product_id, qty_available, synced_at)
           values ($1, $2, $3, $4)
           on conflict (branch_id, product_id) do update set
             qty_available = excluded.qty_available, synced_at = excluded.synced_at`,
          [branch.id, productId, Math.max(0, level.quantityAvailable), level.syncedAt.toISOString()],
        );
        stockRows += 1;
      }
    }
    await logRun(db, 'stock', 'ok', stockRows, startedAt);

    return { branches: branches.length, products, stockRows };
  } catch (error) {
    // Recorded, then rethrown: a failed sync must be visible in the admin view
    // and must not be mistaken for an empty catalogue.
    await logRun(db, 'catalog', 'error', 0, startedAt, error instanceof Error ? error.message : String(error));
    throw error;
  }
}
