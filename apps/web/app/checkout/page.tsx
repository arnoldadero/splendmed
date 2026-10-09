import Link from 'next/link';

import { formatMoney } from '@splendmed/domain';

import { getCart } from '@/lib/cart';

export const metadata = { title: 'Checkout' };

/**
 * Checkout is honest about where it stops.
 *
 * Payment is Phase 5 (M-Pesa STK push) and prescription upload is Phase 4.
 * Taking an order we cannot fulfil, or implying one was placed, would be far
 * worse than saying plainly that this is not live yet.
 */
export default async function CheckoutPage() {
  const cart = await getCart();

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold">Nothing to check out</h1>
        <Link href="/" className="mt-6 inline-block font-semibold text-brand-teal hover:underline">
          Back to the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">Checkout</h1>

      <div className="mt-6 rounded-lg border border-border p-5">
        <p className="flex justify-between">
          <span className="text-muted-foreground">
            {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
          </span>
          <span className="font-bold">{formatMoney(cart.subtotal)}</span>
        </p>
      </div>

      <div
        className="mt-8 rounded-lg border border-brand-teal bg-brand-teal/5 p-5"
        data-testid="checkout-notice"
      >
        <h2 className="font-semibold text-brand-deep">Checkout is not live yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We are not taking payment or dispensing orders through this site yet. M-Pesa payment
          arrives in Phase 5
          {cart.requiresPrescription
            ? ', and prescription upload with pharmacist review in Phases 4 and 6.'
            : '.'}{' '}
          Your cart is saved. Nothing has been charged and no order has been placed.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          To order today, call or visit the Kisumu CBD branch.
        </p>
      </div>

      <Link href="/cart" className="mt-8 inline-block font-semibold text-brand-teal hover:underline">
        Back to cart
      </Link>
    </div>
  );
}
