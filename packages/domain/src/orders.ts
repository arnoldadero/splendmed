import type { Money } from './money';

/**
 * Order lifecycle. Mirrors the order_status enum in the database, which is the
 * authority — this union exists so TypeScript can check transitions too.
 */
export const ORDER_STATUSES = [
  'draft',
  'awaiting_payment',
  'paid',
  'awaiting_rx_review',
  'rx_rejected',
  'approved',
  'pushed_to_juleb',
  'fulfilling',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'refunded',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * States in which the order is being prepared or has left the pharmacy. The §3.2
 * gate keys off this set: an order containing a prescription-only item may not
 * enter any of them without a pharmacist's recorded approval.
 */
export const FULFILMENT_STATUSES = [
  'approved',
  'pushed_to_juleb',
  'fulfilling',
  'out_for_delivery',
  'delivered',
] as const satisfies readonly OrderStatus[];

export function isFulfilmentStatus(status: OrderStatus): boolean {
  return (FULFILMENT_STATUSES as readonly OrderStatus[]).includes(status);
}

/**
 * Permitted transitions. Anything absent is a bug, not an unhandled case — an
 * order must never reach a state by accident.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ['awaiting_payment', 'cancelled'],
  awaiting_payment: ['paid', 'cancelled'],
  // Payment clears before review: we do not make a pharmacist assess an order
  // the customer has not committed to. Rx orders then queue for review.
  paid: ['awaiting_rx_review', 'approved', 'cancelled', 'refunded'],
  awaiting_rx_review: ['approved', 'rx_rejected', 'cancelled'],
  rx_rejected: ['awaiting_rx_review', 'cancelled', 'refunded'],
  approved: ['pushed_to_juleb', 'cancelled'],
  // Juleb may reject on stock (§3.7); that returns to approved for retry.
  pushed_to_juleb: ['fulfilling', 'approved', 'cancelled'],
  fulfilling: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function allowedTransitionsFrom(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

export type FulfilmentMethod = 'delivery' | 'pickup';

export interface OrderLine {
  readonly productId: string;
  /** External key, needed to place the order in Juleb. */
  readonly julebProductId: string | null;
  readonly quantity: number;
  readonly unitPrice: Money;
}

/** What we ask Juleb to create. Our order id travels as the idempotency key. */
export interface OrderDraft {
  readonly orderId: string;
  readonly orderNo: string;
  readonly branchId: string;
  readonly julebBranchId: string | null;
  readonly fulfilment: FulfilmentMethod;
  readonly lines: readonly OrderLine[];
  readonly subtotal: Money;
  readonly deliveryFee: Money;
  readonly total: Money;
  /** Set when a pharmacist approved a prescription for this order. */
  readonly prescriptionApprovalRef: string | null;
}

export interface OrderRef {
  readonly julebOrderId: string;
  readonly status: string;
}
