import type { Branch, OrderDraft, OrderRef, Product, StockLevel } from '@splendmed/domain';

/**
 * The Juleb boundary.
 *
 * Everything the application needs from Juleb goes through this interface. It is
 * expressed in SplendMed's domain types, not Juleb's wire shapes (§8.3), which is
 * what makes the upstream contract replaceable without touching feature code.
 *
 * Two implementations exist: a fixture-backed mock used by all tests, and an HTTP
 * driver whose every method throws until a real specification lands (§3.1).
 */
export interface JulebClient {
  /** Identifies the driver in logs and the admin sync-health view. */
  readonly name: 'mock' | 'http';

  listBranches(): Promise<readonly Branch[]>;

  /**
   * Catalog page. `updatedSince` makes the hourly sync incremental; omitting it
   * requests a full crawl, which should be rare.
   */
  listProducts(args?: {
    cursor?: string;
    updatedSince?: Date;
    limit?: number;
  }): Promise<{ products: readonly Product[]; nextCursor: string | null }>;

  getStock(args: {
    branchId: string;
    julebProductIds: readonly string[];
  }): Promise<readonly StockLevel[]>;

  /**
   * Places the order in Juleb.
   *
   * `draft.orderId` is the idempotency key: a retry of the same draft must return
   * the original order, never create a second one. The outbox worker relies on
   * this, because at-least-once delivery is the only guarantee it can offer.
   *
   * Throws JulebStockError when stock moved since our projection was synced —
   * a routine path, not an exception (§3.7).
   */
  createOrder(draft: OrderDraft): Promise<OrderRef>;

  getOrder(julebOrderId: string): Promise<OrderRef>;

  cancelOrder(julebOrderId: string, reason: string): Promise<void>;

  /**
   * Optional by design. Juleb lists an Rx E-Prescription module, but whether it
   * is reachable by API is unknown (their Q12). Callers must feature-detect
   * rather than assume, and the review workflow must work without it.
   */
  submitPrescription?(args: {
    orderId: string;
    julebOrderId: string | null;
    approvalRef: string;
  }): Promise<{ julebPrescriptionId: string }>;
}
