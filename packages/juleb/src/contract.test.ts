import { availabilityOf, money, requiresPrescription, type OrderDraft } from '@splendmed/domain';
import { beforeEach, describe, expect, it } from 'vitest';

import { HttpJulebClient } from './drivers/http';
import { MockJulebClient } from './drivers/mock';
import {
  JulebNotFoundError,
  JulebRateLimitError,
  JulebSpecUnavailableError,
  JulebStockError,
  JulebTransportError,
} from './errors';
import { parseDriverName } from './factory';
import type { JulebClient } from './port';

/**
 * The Juleb contract suite.
 *
 * These assertions define what any JulebClient must do. Today they run against
 * the mock; the day a real specification lands they become the acceptance
 * criteria for HttpJulebClient (swap-in checklist step 4). That is the whole
 * point of writing them as a contract rather than as mock-specific tests.
 */

const KSM1 = 'JB-KSM-001';

function draftFor(
  orderId: string,
  lines: { julebProductId: string; quantity: number }[],
): OrderDraft {
  return {
    orderId,
    orderNo: `SM-${orderId}`,
    branchId: KSM1,
    julebBranchId: KSM1,
    fulfilment: 'delivery',
    lines: lines.map((l) => ({
      productId: l.julebProductId,
      julebProductId: l.julebProductId,
      quantity: l.quantity,
      unitPrice: money(45000),
    })),
    subtotal: money(45000),
    deliveryFee: money(20000),
    total: money(65000),
    prescriptionApprovalRef: null,
  };
}

describe('JulebClient contract (mock driver)', () => {
  let client: MockJulebClient;

  beforeEach(() => {
    client = new MockJulebClient();
  });

  describe('listBranches', () => {
    it('returns branches mapped into domain shape', async () => {
      const branches = await client.listBranches();
      expect(branches.length).toBeGreaterThan(0);
      expect(branches[0]).toMatchObject({
        julebBranchId: expect.any(String),
        name: expect.any(String),
      });
    });

    it('surfaces the PPB licence, which the UI is required to show', async () => {
      const branches = await client.listBranches();
      const active = branches.filter((b) => b.isActive);
      expect(active.length).toBeGreaterThan(0);
      expect(active[0]!.ppbLicenceNo).toBeTruthy();
    });

    it('includes inactive branches so callers decide, not the driver', async () => {
      const branches = await client.listBranches();
      expect(branches.some((b) => !b.isActive)).toBe(true);
    });
  });

  describe('listProducts', () => {
    it('paginates with a stable cursor and terminates', async () => {
      const seen: string[] = [];
      let cursor: string | null | undefined;
      let pages = 0;

      do {
        const page = await client.listProducts(cursor ? { cursor } : {});
        seen.push(...page.products.map((p) => p.id));
        cursor = page.nextCursor;
        pages += 1;
        expect(pages).toBeLessThan(20); // guard against a cursor that never advances
      } while (cursor);

      expect(pages).toBeGreaterThan(1); // proves paging actually happened
      expect(new Set(seen).size).toBe(seen.length); // no duplicates across pages
    });

    it('filters incrementally and strictly after the watermark', async () => {
      const all = await client.listProducts({ limit: 100 });
      const recent = await client.listProducts({
        updatedSince: new Date('2026-10-05T00:00:00Z'),
        limit: 100,
      });
      expect(recent.products.length).toBeGreaterThan(0);
      expect(recent.products.length).toBeLessThan(all.products.length);
    });

    it('re-syncing at the same watermark returns nothing, so sync is not O(catalog)', async () => {
      const page = await client.listProducts({ updatedSince: new Date('2030-01-01T00:00:00Z') });
      expect(page.products).toHaveLength(0);
      expect(page.nextCursor).toBeNull();
    });

    it('normalises every dispensing vocabulary variant in the fixtures', async () => {
      const page = await client.listProducts({ limit: 100 });
      for (const product of page.products) {
        expect(['otc', 'pom', 'controlled']).toContain(product.dispensing);
      }
    });

    it('classifies prescription-only and controlled items as requiring a prescription', async () => {
      const page = await client.listProducts({ limit: 100 });
      const pom = page.products.find((p) => p.dispensing === 'pom');
      const controlled = page.products.find((p) => p.dispensing === 'controlled');
      expect(pom).toBeDefined();
      expect(controlled).toBeDefined();
      expect(requiresPrescription(pom!.dispensing)).toBe(true);
      expect(requiresPrescription(controlled!.dispensing)).toBe(true);
    });

    it('converts money to exact integer minor units', async () => {
      const page = await client.listProducts({ limit: 100 });
      const metformin = page.products.find((p) => p.name === 'Glucophage');
      // "890.50" must be exactly 89050 cents, with no floating-point drift.
      expect(metformin!.price.minor).toBe(89050);
      expect(Number.isInteger(metformin!.price.minor)).toBe(true);
    });

    it('carries the MyDawa-style display fields the storefront needs', async () => {
      const page = await client.listProducts({ limit: 100 });
      const discounted = page.products.find((p) => p.compareAtPrice !== null);
      expect(discounted).toBeDefined();
      expect(discounted!.compareAtPrice!.minor).toBeGreaterThan(discounted!.price.minor);
      expect(discounted!.unitLabel).toBeTruthy();
    });

    it('exposes both brand and generic names, since patients search either way', async () => {
      const page = await client.listProducts({ limit: 100 });
      const panadol = page.products.find((p) => p.name === 'Panadol Extra');
      expect(panadol!.genericName).toMatch(/Paracetamol/i);
      expect(panadol!.brand?.name).toBe('Panadol');
    });
  });

  describe('getStock', () => {
    it('returns levels only for the requested branch and products', async () => {
      const levels = await client.getStock({ branchId: KSM1, julebProductIds: ['JP-0001'] });
      expect(levels).toHaveLength(1);
      expect(levels[0]).toMatchObject({ branchId: KSM1, productId: 'JP-0001' });
    });

    it('reports a synced-at timestamp, because the figure is a stale projection', async () => {
      const levels = await client.getStock({ branchId: KSM1, julebProductIds: ['JP-0001'] });
      expect(levels[0]!.syncedAt).toBeInstanceOf(Date);
    });

    it('bands availability rather than implying false precision', async () => {
      const levels = await client.getStock({
        branchId: KSM1,
        julebProductIds: ['JP-0001', 'JP-0003', 'JP-0004'],
      });
      const byProduct = new Map(levels.map((l) => [l.productId, availabilityOf(l)]));
      expect(byProduct.get('JP-0001')).toBe('in_stock');
      expect(byProduct.get('JP-0003')).toBe('low_stock');
      expect(byProduct.get('JP-0004')).toBe('out_of_stock');
    });
  });

  describe('createOrder', () => {
    it('accepts an order that is within stock', async () => {
      const ref = await client.createOrder(
        draftFor('ord-1', [{ julebProductId: 'JP-0001', quantity: 2 }]),
      );
      expect(ref.julebOrderId).toMatch(/^JO-MOCK-/);
    });

    // The outbox retries at-least-once, so this is the property that prevents a
    // customer being charged once and sent two orders.
    it('is idempotent on our order id', async () => {
      const draft = draftFor('ord-2', [{ julebProductId: 'JP-0001', quantity: 1 }]);
      const first = await client.createOrder(draft);
      const second = await client.createOrder(draft);
      expect(second.julebOrderId).toBe(first.julebOrderId);
    });

    it('rejects with a structured shortfall when stock moved', async () => {
      const draft = draftFor('ord-3', [{ julebProductId: 'JP-0004', quantity: 1 }]);
      const error = await client.createOrder(draft).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(JulebStockError);
      const stockError = error as JulebStockError;
      expect(stockError.shortfalls[0]).toMatchObject({
        julebProductId: 'JP-0004',
        requested: 1,
        available: 0,
      });
      expect(stockError.retryable).toBe(false);
    });

    it('does not record an order that was rejected for stock', async () => {
      const draft = draftFor('ord-4', [{ julebProductId: 'JP-0004', quantity: 1 }]);
      await expect(client.createOrder(draft)).rejects.toBeInstanceOf(JulebStockError);
      await expect(client.getOrder('JO-MOCK-00001')).rejects.toBeInstanceOf(JulebNotFoundError);
    });
  });

  describe('getOrder and cancelOrder', () => {
    it('reads back an order we created', async () => {
      const ref = await client.createOrder(
        draftFor('ord-5', [{ julebProductId: 'JP-0001', quantity: 1 }]),
      );
      await expect(client.getOrder(ref.julebOrderId)).resolves.toMatchObject({
        julebOrderId: ref.julebOrderId,
      });
    });

    it('raises not-found for an unknown order, not a generic failure', async () => {
      await expect(client.getOrder('JO-DOES-NOT-EXIST')).rejects.toBeInstanceOf(JulebNotFoundError);
    });

    it('marks a cancelled order cancelled', async () => {
      const ref = await client.createOrder(
        draftFor('ord-6', [{ julebProductId: 'JP-0001', quantity: 1 }]),
      );
      await client.cancelOrder(ref.julebOrderId, 'customer changed their mind');
      await expect(client.getOrder(ref.julebOrderId)).resolves.toMatchObject({
        status: 'cancelled',
      });
    });
  });

  describe('failure modes', () => {
    it('classifies transport failure as retryable', async () => {
      const flaky = new MockJulebClient({ failNextCalls: 1 });
      const error = await flaky.listBranches().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(JulebTransportError);
      expect((error as JulebTransportError).retryable).toBe(true);
      // Recovers on the next attempt, which is what backoff relies on.
      await expect(flaky.listBranches()).resolves.toBeDefined();
    });

    it('classifies throttling as retryable and carries a delay', async () => {
      const throttled = new MockJulebClient({ throttleNextCall: true });
      const error = await throttled.listProducts().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(JulebRateLimitError);
      expect((error as JulebRateLimitError).retryAfterSeconds).toBe(30);
      expect((error as JulebRateLimitError).retryable).toBe(true);
    });

    it('lets a test force a stock shortfall via overrides', async () => {
      const empty = new MockJulebClient({ stockOverrides: { [KSM1]: { 'JP-0001': 0 } } });
      await expect(
        empty.createOrder(draftFor('ord-7', [{ julebProductId: 'JP-0001', quantity: 1 }])),
      ).rejects.toBeInstanceOf(JulebStockError);
    });
  });
});

/**
 * Guardrail §3.1, enforced as a test rather than a convention.
 *
 * If someone implements a method against a guessed endpoint, this fails.
 */
describe('HttpJulebClient refuses to invent an API', () => {
  const client = new HttpJulebClient({
    baseUrl: undefined,
    clientId: undefined,
    clientSecret: undefined,
  });

  const operations: [string, () => unknown][] = [
    ['listBranches', () => client.listBranches()],
    ['listProducts', () => client.listProducts()],
    ['getStock', () => client.getStock()],
    ['createOrder', () => client.createOrder(draftFor('x', []))],
    ['getOrder', () => client.getOrder('x')],
    ['cancelOrder', () => client.cancelOrder('x', 'y')],
  ];

  it.each(operations)('%s throws JulebSpecUnavailableError', (_name, call) => {
    expect(call).toThrow(JulebSpecUnavailableError);
  });

  it('points the reader at the swap-in checklist', () => {
    expect(() => client.listProducts()).toThrow(/docs\/integrations\/juleb\.md/);
  });

  it('reports itself unconfigured when credentials are absent', () => {
    expect(client.isConfigured).toBe(false);
  });

  it('satisfies the same structural interface as the mock', () => {
    const mock: JulebClient = new MockJulebClient();
    const http: JulebClient = client;
    expect(http.name).toBe('http');
    expect(mock.name).toBe('mock');
  });
});

describe('driver selection', () => {
  it('defaults to mock when unset, rather than a driver that always throws', () => {
    expect(parseDriverName(undefined)).toBe('mock');
    expect(parseDriverName('')).toBe('mock');
  });

  it('accepts the two known drivers', () => {
    expect(parseDriverName('mock')).toBe('mock');
    expect(parseDriverName('http')).toBe('http');
  });

  it('rejects a typo loudly instead of falling back', () => {
    expect(() => parseDriverName('htttp')).toThrow(/JULEB_DRIVER/);
  });
});
