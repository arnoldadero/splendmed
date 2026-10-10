import { cookies } from 'next/headers';

import { money, type Money } from '@splendmed/domain';

/**
 * Demo order store, held in a cookie.
 *
 * It started in-process and that broke on Vercel: an order created by one
 * serverless instance was invisible to the next request, which landed on a
 * different one, so the order page 404'd. A cookie travels with the browser and
 * is therefore immune to that.
 *
 * What this buys and what it costs: a demo driven from one browser works
 * completely — the presenter is both patient and pharmacist, and both read the
 * same cookie. A second device sees nothing, because it has a different cookie.
 * For a presented demo that is the right trade; Phase 4 replaces it with
 * Postgres, where orders are genuinely shared and the §3.2 trigger enforces the
 * prescription gate in the database.
 *
 * The prescription image does not fit in a 4KB cookie, so it lives in
 * localStorage keyed by order id and is loaded client-side on the review
 * screen. Phase 4 puts it in Supabase Storage behind a signed URL, which is
 * what §3.5 actually requires for PHI.
 */

const COOKIE = 'splendmed_demo_orders';
const MAX_ORDERS = 8;

export type DemoRxStatus = 'pending' | 'approved' | 'rejected';
export type DemoOrderStatus = 'awaiting_rx_review' | 'approved' | 'rx_rejected' | 'delivered';

export interface DemoOrderLine {
  readonly productId: string;
  readonly name: string;
  readonly strength: string | null;
  readonly quantity: number;
  readonly unitPriceMinor: number;
  readonly rx: boolean;
  readonly controlled: boolean;
}

export interface DemoOrder {
  readonly id: string;
  readonly orderNo: string;
  readonly placedAt: string;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly fulfilment: 'delivery' | 'pickup';
  readonly lines: readonly DemoOrderLine[];
  readonly subtotalMinor: number;
  readonly deliveryFeeMinor: number;
  readonly totalMinor: number;
  status: DemoOrderStatus;
  /** True when a prescription was attached; the image lives in localStorage. */
  hasPrescription: boolean;
  rxStatus: DemoRxStatus | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  prescriberName: string | null;
  prescriberRegNo: string | null;
}

export const asMoney = (minor: number): Money => money(minor, 'KES');

async function read(): Promise<DemoOrder[]> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(parsed) ? (parsed as DemoOrder[]) : [];
  } catch {
    // A malformed cookie is user-controlled input, not an exception worth
    // propagating. Start clean rather than failing the page.
    return [];
  }
}

async function write(orders: readonly DemoOrder[]): Promise<void> {
  const trimmed = orders.slice(0, MAX_ORDERS);
  (await cookies()).set(COOKIE, encodeURIComponent(JSON.stringify(trimmed)), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24,
  });
}

export function nextOrderNo(): string {
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `SM-${stamp}-${Math.floor(100 + Math.random() * 900)}`;
}

export async function putOrder(order: DemoOrder): Promise<void> {
  const orders = await read();
  await write([order, ...orders.filter((o) => o.id !== order.id)]);
}

export async function getOrder(id: string): Promise<DemoOrder | undefined> {
  return (await read()).find((o) => o.id === id);
}

export async function listOrders(): Promise<readonly DemoOrder[]> {
  return read();
}

/** Pharmacist queue: oldest first, because waiting time is the priority. */
export async function listPendingReview(): Promise<readonly DemoOrder[]> {
  return (await read())
    .filter((o) => o.status === 'awaiting_rx_review' && o.rxStatus === 'pending')
    .sort((a, b) => a.placedAt.localeCompare(b.placedAt));
}

/**
 * Records a pharmacist decision — the only path into a fulfilment state, and it
 * refuses to run without a named reviewer. Phase 4 enforces the same invariant
 * with a database trigger, so a bug here cannot bypass it.
 */
export async function recordReview(args: {
  orderId: string;
  decision: 'approve' | 'reject';
  reviewer: string;
  prescriberName?: string | undefined;
  prescriberRegNo?: string | undefined;
  note?: string | undefined;
}): Promise<DemoOrder | undefined> {
  const orders = await read();
  const order = orders.find((o) => o.id === args.orderId);
  if (!order || !args.reviewer.trim()) return undefined;

  order.rxStatus = args.decision === 'approve' ? 'approved' : 'rejected';
  order.status = args.decision === 'approve' ? 'approved' : 'rx_rejected';
  order.reviewedBy = args.reviewer;
  order.reviewedAt = new Date().toISOString();
  order.reviewNote = args.note ?? null;
  order.prescriberName = args.prescriberName ?? null;
  order.prescriberRegNo = args.prescriberRegNo ?? null;

  await write(orders);
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
    detail: 'Our pharmacist could not approve this prescription. Their note is below.',
  },
  delivered: { label: 'Delivered', detail: 'Your order has been delivered.' },
};
