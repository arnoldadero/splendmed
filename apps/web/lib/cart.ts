import { cookies } from 'next/headers';

import { addMoney, money, multiplyMoney, type Money } from '@splendmed/domain';

import { getCatalog, type CatalogItem } from '@/lib/catalog';

/**
 * Cart state, held in a cookie.
 *
 * No database involved, deliberately. A basket belongs to the browser until the
 * customer commits to it, and Phase 1 (accounts) is not built yet. When it is,
 * this cookie becomes the anonymous cart that merges into the signed-in one.
 *
 * Encoded compactly as "JP-0001:2,JP-0003:1" rather than JSON. Cookies cap around
 * 4KB and JSON wastes most of it on punctuation.
 */

const COOKIE = 'splendmed_cart';
const MAX_LINES = 50;
const MAX_QTY_PER_LINE = 20;

export interface CartLine {
  readonly item: CatalogItem;
  readonly quantity: number;
  readonly lineTotal: Money;
}

export interface Cart {
  readonly lines: readonly CartLine[];
  readonly itemCount: number;
  readonly subtotal: Money;
  /** True when any line needs a pharmacist to review a prescription (§3.2). */
  readonly requiresPrescription: boolean;
  /** Lines we could not price because the product vanished from the catalogue. */
  readonly droppedProductIds: readonly string[];
}

export const EMPTY_CART: Cart = {
  lines: [],
  itemCount: 0,
  subtotal: money(0),
  requiresPrescription: false,
  droppedProductIds: [],
};

/** Parses the cookie defensively — it is user-controlled input. */
export function parseCartCookie(raw: string | undefined): Map<string, number> {
  const parsed = new Map<string, number>();
  if (!raw) return parsed;

  for (const entry of raw.split(',').slice(0, MAX_LINES)) {
    const [id, qtyRaw] = entry.split(':');
    if (!id || !qtyRaw) continue;
    // Product ids are opaque strings from Juleb; constrain the shape rather than
    // trusting whatever arrives in a cookie.
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) continue;
    const qty = Number.parseInt(qtyRaw, 10);
    if (!Number.isInteger(qty) || qty < 1) continue;
    parsed.set(id, Math.min(qty, MAX_QTY_PER_LINE));
  }
  return parsed;
}

export function serialiseCart(entries: Map<string, number>): string {
  return [...entries.entries()]
    .filter(([, qty]) => qty > 0)
    .slice(0, MAX_LINES)
    .map(([id, qty]) => `${id}:${Math.min(qty, MAX_QTY_PER_LINE)}`)
    .join(',');
}

export async function readCartEntries(): Promise<Map<string, number>> {
  const store = await cookies();
  return parseCartCookie(store.get(COOKIE)?.value);
}

export async function writeCartEntries(entries: Map<string, number>): Promise<void> {
  const store = await cookies();
  const value = serialiseCart(entries);

  if (!value) {
    store.set(COOKIE, '', { maxAge: 0, path: '/' });
    return;
  }

  store.set(COOKIE, value, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Resolves the cookie against the live catalogue and prices it. */
export async function getCart(): Promise<Cart> {
  const entries = await readCartEntries();
  if (entries.size === 0) return EMPTY_CART;

  const catalog = await getCatalog();
  const byId = new Map(catalog.map((item) => [item.product.id, item]));

  const lines: CartLine[] = [];
  const dropped: string[] = [];

  for (const [productId, quantity] of entries) {
    const item = byId.get(productId);
    // A product can disappear between adding and viewing — it went inactive, or
    // the catalogue resynced. Report it rather than silently dropping the line.
    if (!item) {
      dropped.push(productId);
      continue;
    }
    lines.push({ item, quantity, lineTotal: multiplyMoney(item.product.price, quantity) });
  }

  return {
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: lines.reduce((sum, line) => addMoney(sum, line.lineTotal), money(0)),
    requiresPrescription: lines.some((line) => line.item.product.dispensing !== 'otc'),
    droppedProductIds: dropped,
  };
}

/** Just the badge number, without pricing the whole basket. */
export async function getCartCount(): Promise<number> {
  const entries = await readCartEntries();
  let total = 0;
  for (const qty of entries.values()) total += qty;
  return total;
}
