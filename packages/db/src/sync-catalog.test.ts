import { MockJulebClient } from '@splendmed/juleb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDb, type TestDb } from './harness';
import { syncCatalog } from './sync-catalog';

/**
 * Phase 3 gate: "the mock catalog syncs into Postgres and renders; search finds
 * products by both brand and generic name."
 */
let t: TestDb;

beforeAll(async () => {
  t = await createTestDb();
});

afterAll(async () => {
  await t?.close();
});

const count = async (table: string) =>
  Number((await t.db.query<{ n: string }>(`select count(*) n from public.${table}`)).rows[0]!.n);

describe('syncCatalog', () => {
  it('pulls the whole mock catalogue into Postgres', async () => {
    const result = await syncCatalog(t.db, new MockJulebClient());
    expect(result.products).toBeGreaterThanOrEqual(50);
    expect(await count('products')).toBe(result.products);
    expect(await count('branches')).toBe(result.branches);
    expect(await count('inventory_levels')).toBe(result.stockRows);
  });

  // The hourly schedule re-runs this constantly; it must converge, not grow.
  it('is idempotent: a second run changes counts by nothing', async () => {
    const before = await count('products');
    await syncCatalog(t.db, new MockJulebClient());
    expect(await count('products')).toBe(before);
  });

  it('preserves the dispensing classification, which the §3.2 gate depends on', async () => {
    const rows = await t.db.query<{ dispensing_class: string; requires_prescription: boolean }>(
      `select dispensing_class, requires_prescription from public.products where name = 'Coartem'`,
    );
    expect(rows.rows[0]).toMatchObject({ dispensing_class: 'pom', requires_prescription: true });
  });

  it('stores money as exact integer minor units', async () => {
    const rows = await t.db.query<{ price_minor: string }>(
      `select price_minor from public.products where name = 'Panadol Extra'`,
    );
    expect(Number(rows.rows[0]!.price_minor)).toBe(45000);
  });

  it('search finds brands by their generic ingredient', async () => {
    const names = (
      await t.db.query<{ name: string }>(`select name from public.search_products('paracetamol')`)
    ).rows.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(['Panadol Extra', 'Calpol Paediatric Suspension']));
  });

  it('search finds a product by its brand', async () => {
    const names = (
      await t.db.query<{ name: string }>(`select name from public.search_products('panadol')`)
    ).rows.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(['Panadol Extra', 'Panadol Advance']));
  });

  it('records every run in the sync log, which the admin view reads', async () => {
    const rows = await t.db.query<{ resource: string; outcome: string }>(
      `select resource, outcome from public.juleb_sync_log`,
    );
    expect(rows.rows.length).toBeGreaterThan(0);
    expect(rows.rows.every((r) => r.outcome === 'ok')).toBe(true);
  });

  it('records a failure and rethrows it, rather than looking like an empty catalogue', async () => {
    const flaky = new MockJulebClient({ failNextCalls: 1 });
    await expect(syncCatalog(t.db, flaky)).rejects.toThrow();
    const errors = await t.db.query(`select id from public.juleb_sync_log where outcome = 'error'`);
    expect(errors.rows.length).toBeGreaterThan(0);
  });
});
