import type { Money } from '@splendmed/domain';

/**
 * In-memory order and prescription store, for the demo only.
 *
 * Phase 4 puts this in Postgres with the §3.2 trigger and Supabase Storage
 * behind signed URLs. That needs a database, which is still blocked, so this
 * stands in: it makes the full journey — order, prescription, pharmacist
 * review, approval — walkable end to end today.
 *
 * Its limits, stated plainly rather than discovered mid-demo: state lives in
 * one server process, so a redeploy or a cold start empties it, and a second
 * instance would not see the first one's orders. Fine for a demo on one box;
 * not a database.
 */

export type DemoRxStatus = 'pending' | 'approved' | 'rejected';
export type DemoOrderStatus =
  | 'awaiting_rx_review'
  | 'approved'
  | 'rx_rejected'
  | 'fulfilling'
  | 'delivered';

export interface DemoOrderLine {
  readonly productId: string;
  readonly name: string;
  readonly strength: string | null;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly requiresPrescription: boolean;
  readonly isControlled: boolean;
}

export interface DemoPrescription {
  readonly id: string;
  /** Data URL of the uploaded image. Demo only — Phase 4 uses signed storage. */
  readonly imageDataUrl: string | null;
  readonly fileName: string | null;
  status: DemoRxStatus;
  prescriberName: string | null;
  prescriberRegNo: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export interface DemoOrder {
  readonly id: string;
  readonly orderNo: string;
  readonly placedAt: string;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly lines: readonly DemoOrderLine[];
  readonly subtotal: Money;
  readonly deliveryFee: Money;
  readonly total: Money;
  readonly fulfilment: 'delivery' | 'pickup';
  status: DemoOrderStatus;
  prescription: DemoPrescription | null;
}

/** A module-level Map survives between requests in one warm server process. */
const orders = new Map<string, DemoOrder>();
let sequence = 0;

export function nextOrderNo(): string {
  sequence += 1;
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `SM-${stamp}-${String(sequence).padStart(3, '0')}`;
}

export function putOrder(order: DemoOrder): void {
  orders.set(order.id, order);
}

export function getOrder(id: string): DemoOrder | undefined {
  return orders.get(id);
}

/** Newest first — the console wants the queue, the account wants history. */
export function listOrders(): readonly DemoOrder[] {
  return [...orders.values()].sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}

/** The pharmacist queue: oldest first, because waiting time is the priority. */
export function listPendingReview(): readonly DemoOrder[] {
  return [...orders.values()]
    .filter((o) => o.status === 'awaiting_rx_review' && o.prescription?.status === 'pending')
    .sort((a, b) => a.placedAt.localeCompare(b.placedAt));
}

export function countPendingReview(): number {
  return listPendingReview().length;
}

/**
 * Records a pharmacist decision.
 *
 * The §3.2 invariant in software form: an order carrying a prescription-only
 * item only reaches a fulfilment state through this function, and only with a
 * named reviewer attached. In Phase 4 the database enforces the same thing with
 * a trigger, so a bug here cannot bypass it.
 */
export function recordReview(args: {
  orderId: string;
  decision: 'approve' | 'reject';
  reviewer: string;
  // Explicit `| undefined`: tsconfig sets exactOptionalPropertyTypes, so an
  // optional property is not the same as one that may be passed as undefined,
  // and Zod's parse output carries the latter.
  prescriberName?: string | undefined;
  prescriberRegNo?: string | undefined;
  note?: string | undefined;
}): DemoOrder | undefined {
  const order = orders.get(args.orderId);
  if (!order?.prescription) return undefined;

  order.prescription.status = args.decision === 'approve' ? 'approved' : 'rejected';
  order.prescription.reviewedBy = args.reviewer;
  order.prescription.reviewedAt = new Date().toISOString();
  order.prescription.reviewNote = args.note ?? null;
  if (args.prescriberName) order.prescription.prescriberName = args.prescriberName;
  if (args.prescriberRegNo) order.prescription.prescriberRegNo = args.prescriberRegNo;

  order.status = args.decision === 'approve' ? 'approved' : 'rx_rejected';
  return order;
}

export const ORDER_STATUS_COPY: Record<DemoOrderStatus, { label: string; detail: string }> = {
  awaiting_rx_review: {
    label: 'Awaiting pharmacist review',
    detail: 'A registered pharmacist is checking your prescription. This is usually under an hour.',
  },
  approved: {
    label: 'Approved — preparing your order',
    detail: 'Your prescription was approved. We are picking and packing your items.',
  },
  rx_rejected: {
    label: 'Prescription needs attention',
    detail: 'Our pharmacist could not approve this prescription. See their note below.',
  },
  fulfilling: { label: 'Being prepared', detail: 'Your order is being packed at Kisumu CBD.' },
  delivered: { label: 'Delivered', detail: 'Your order has been delivered.' },
};
