'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getCatalog } from '@/lib/catalog';
import { readCartEntries, writeCartEntries } from '@/lib/cart';

/**
 * Cart mutations.
 *
 * Every argument is validated here even though the UI only sends known values —
 * a Server Action is a public endpoint, and the client is not a trust boundary
 * (§4). Availability is re-checked server-side for the same reason: a disabled
 * button is a hint, not a control.
 */

const productIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'invalid product id');
const quantitySchema = z.coerce.number().int().min(0).max(20);

export type CartActionResult = { ok: true; itemCount: number } | { ok: false; error: string };

async function assertPurchasable(productId: string): Promise<string | null> {
  const catalog = await getCatalog();
  const item = catalog.find((i) => i.product.id === productId);

  if (!item) return 'That product is no longer available.';
  if (!item.product.isActive) return 'That product is no longer available.';
  // Stock is a stale projection (§3.7), so this is a courtesy check, not a
  // guarantee — the real reservation happens when the order reaches Juleb.
  if (item.availability === 'out_of_stock') {
    return 'That product is out of stock at the moment.';
  }
  return null;
}

export async function addToCart(productId: string): Promise<CartActionResult> {
  const parsed = productIdSchema.safeParse(productId);
  if (!parsed.success) return { ok: false, error: 'invalid product' };

  const problem = await assertPurchasable(parsed.data);
  if (problem) return { ok: false, error: problem };

  const entries = await readCartEntries();
  const next = Math.min((entries.get(parsed.data) ?? 0) + 1, 20);
  entries.set(parsed.data, next);
  await writeCartEntries(entries);

  revalidatePath('/cart');
  revalidatePath('/');

  let count = 0;
  for (const qty of entries.values()) count += qty;
  return { ok: true, itemCount: count };
}

export async function setQuantity(productId: string, quantity: number): Promise<CartActionResult> {
  const id = productIdSchema.safeParse(productId);
  const qty = quantitySchema.safeParse(quantity);
  if (!id.success || !qty.success) return { ok: false, error: 'invalid request' };

  const entries = await readCartEntries();
  if (qty.data === 0) {
    entries.delete(id.data);
  } else {
    const problem = await assertPurchasable(id.data);
    if (problem) return { ok: false, error: problem };
    entries.set(id.data, qty.data);
  }
  await writeCartEntries(entries);

  revalidatePath('/cart');

  let count = 0;
  for (const q of entries.values()) count += q;
  return { ok: true, itemCount: count };
}

export async function removeFromCart(productId: string): Promise<CartActionResult> {
  return setQuantity(productId, 0);
}

export async function clearCart(): Promise<CartActionResult> {
  await writeCartEntries(new Map());
  revalidatePath('/cart');
  return { ok: true, itemCount: 0 };
}
