import type { Branch, OrderDraft, OrderRef, Product, StockLevel } from '@splendmed/domain';

import {
  JulebNotFoundError,
  JulebRateLimitError,
  JulebStockError,
  JulebTransportError,
} from '../errors';
import { toBranch, toProduct, toStockLevel } from '../mappers';
import type { JulebClient } from '../port';
import {
  julebBranchSchema,
  julebProductSchema,
  julebStockLevelSchema,
  type JulebBranch,
  type JulebProduct,
  type JulebStockLevel,
} from '../wire';

import branchesFixture from '../__fixtures__/branches.json';
import productsFixture from '../__fixtures__/products.json';
import stockFixture from '../__fixtures__/stock.json';

/**
 * Fixture-backed Juleb client. Every test runs against this (§8.2).
 *
 * It deliberately models the unhappy paths, because those are where integrations
 * actually break: pagination, incremental filtering, stock shortfall, idempotent
 * replay, throttling and transport failure. A mock that only ever succeeds would
 * let us build code that cannot survive the real thing.
 *
 * Fixtures are parsed through the same Zod schemas the HTTP driver will use, so a
 * fixture that drifts out of shape fails here rather than silently diverging from
 * what the real driver must accept.
 */

export interface MockJulebOptions {
  /** Page size for listProducts. Small by default so tests exercise paging. */
  pageSize?: number;
  /** Force the next N calls to fail with a transport error. */
  failNextCalls?: number;
  /** Force the next call to be throttled. */
  throttleNextCall?: boolean;
  /** Branch-scoped stock overrides, applied on top of the fixture. */
  stockOverrides?: Record<string, Record<string, number>>;
}

export class MockJulebClient implements JulebClient {
  readonly name = 'mock' as const;

  private readonly pageSize: number;
  private failuresRemaining: number;
  private throttleNext: boolean;
  private readonly stockOverrides: Record<string, Record<string, number>>;

  /** Idempotency ledger: order id -> the ref we already returned. */
  private readonly createdOrders = new Map<string, OrderRef>();
  private orderSequence = 0;

  constructor(options: MockJulebOptions = {}) {
    this.pageSize = options.pageSize ?? 4;
    this.failuresRemaining = options.failNextCalls ?? 0;
    this.throttleNext = options.throttleNextCall ?? false;
    this.stockOverrides = options.stockOverrides ?? {};
  }

  /** Simulated faults, checked before every operation. */
  private guard(operation: string): void {
    if (this.throttleNext) {
      this.throttleNext = false;
      throw new JulebRateLimitError(operation, 30);
    }
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new JulebTransportError(operation, { cause: new Error('simulated socket hang up') });
    }
  }

  private parsedProducts(): JulebProduct[] {
    return (productsFixture as unknown[]).map((raw) => julebProductSchema.parse(raw));
  }

  async listBranches(): Promise<readonly Branch[]> {
    this.guard('listBranches');
    const wire: JulebBranch[] = (branchesFixture as unknown[]).map((raw) =>
      julebBranchSchema.parse(raw),
    );
    return wire.map(toBranch);
  }

  async listProducts(
    args: { cursor?: string; updatedSince?: Date; limit?: number } = {},
  ): Promise<{ products: readonly Product[]; nextCursor: string | null }> {
    this.guard('listProducts');

    let wire = this.parsedProducts();

    // Incremental sync: strictly after the watermark, so a repeated sync at the
    // same timestamp does not re-fetch the whole catalog.
    if (args.updatedSince) {
      const since = args.updatedSince.getTime();
      wire = wire.filter((p) => new Date(p.updated_at).getTime() > since);
    }

    // Stable ordering is required for cursor paging to be correct at all.
    wire.sort((a, b) => a.updated_at.localeCompare(b.updated_at) || a.id.localeCompare(b.id));

    const size = args.limit ?? this.pageSize;
    const start = args.cursor ? wire.findIndex((p) => p.id === args.cursor) + 1 : 0;
    const slice = wire.slice(start, start + size);
    const nextIndex = start + size;
    const last = slice.at(-1);

    return {
      products: slice.map((p) => toProduct(p, 'listProducts')),
      nextCursor: nextIndex < wire.length && last ? last.id : null,
    };
  }

  async getStock(args: {
    branchId: string;
    julebProductIds: readonly string[];
  }): Promise<readonly StockLevel[]> {
    this.guard('getStock');
    const wanted = new Set(args.julebProductIds);
    const wire: JulebStockLevel[] = (stockFixture as unknown[])
      .map((raw) => julebStockLevelSchema.parse(raw))
      .filter((row) => row.branch_id === args.branchId && wanted.has(row.product_id))
      .map((row) => {
        const override = this.stockOverrides[args.branchId]?.[row.product_id];
        return override === undefined ? row : { ...row, quantity_available: override };
      });
    return wire.map((row) => toStockLevel(row, 'getStock'));
  }

  async createOrder(draft: OrderDraft): Promise<OrderRef> {
    this.guard('createOrder');

    // Idempotency. The outbox retries at-least-once, so replaying a draft must
    // return the original order rather than creating a duplicate (§8.4).
    const existing = this.createdOrders.get(draft.orderId);
    if (existing) return existing;

    const availability = await this.getStock({
      branchId: draft.julebBranchId ?? draft.branchId,
      julebProductIds: draft.lines.flatMap((l) => (l.julebProductId ? [l.julebProductId] : [])),
    });
    const availableByProduct = new Map(availability.map((s) => [s.productId, s.quantityAvailable]));

    const shortfalls = draft.lines.flatMap((line) => {
      if (!line.julebProductId) return [];
      const available = availableByProduct.get(line.julebProductId) ?? 0;
      return line.quantity > available
        ? [{ julebProductId: line.julebProductId, requested: line.quantity, available }]
        : [];
    });

    // Routine path, not an exception: our stock figures are a stale projection.
    if (shortfalls.length > 0) throw new JulebStockError(shortfalls);

    this.orderSequence += 1;
    const ref: OrderRef = {
      julebOrderId: `JO-MOCK-${String(this.orderSequence).padStart(5, '0')}`,
      status: 'accepted',
    };
    this.createdOrders.set(draft.orderId, ref);
    return ref;
  }

  async getOrder(julebOrderId: string): Promise<OrderRef> {
    this.guard('getOrder');
    for (const ref of this.createdOrders.values()) {
      if (ref.julebOrderId === julebOrderId) return ref;
    }
    throw new JulebNotFoundError('order', julebOrderId);
  }

  async cancelOrder(julebOrderId: string, _reason: string): Promise<void> {
    this.guard('cancelOrder');
    for (const [orderId, ref] of this.createdOrders.entries()) {
      if (ref.julebOrderId === julebOrderId) {
        this.createdOrders.set(orderId, { ...ref, status: 'cancelled' });
        return;
      }
    }
  }

  /** Test helpers, not part of the port. */
  reset(): void {
    this.createdOrders.clear();
    this.orderSequence = 0;
  }
}
