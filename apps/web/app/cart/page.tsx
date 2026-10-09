import Link from 'next/link';

import { formatMoney } from '@splendmed/domain';

import { ProductImage } from '@/components/product-image';
import { removeFromCart, setQuantity } from '@/lib/actions/cart';
import { getCart } from '@/lib/cart';

export const metadata = { title: 'Cart' };

/*
 * Quantity controls are plain forms posting to Server Actions, not a client
 * component. They work without JavaScript, which matters on the 3G mid-range
 * Android target (§12), and there is no interactive state worth hydrating for.
 */
export default async function CartPage() {
  const cart = await getCart();

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold">Your cart is empty</h1>
        <p className="mt-4 text-muted-foreground">Browse the shelves and add what you need.</p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">Your cart</h1>
      <p className="mt-2 text-muted-foreground" data-testid="cart-summary">
        {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
      </p>

      {cart.droppedProductIds.length > 0 && (
        <p role="alert" className="mt-4 rounded-lg border border-destructive p-4 text-sm">
          {cart.droppedProductIds.length} item(s) are no longer available and have been removed.
        </p>
      )}

      <ul className="mt-8 divide-y divide-border border-y border-border">
        {cart.lines.map(({ item, quantity, lineTotal }) => {
          const needsRx = item.product.dispensing !== 'otc';
          return (
            <li key={item.product.id} className="flex flex-wrap gap-4 py-5" data-testid="cart-line">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-secondary p-3 text-brand-teal">
                <ProductImage product={item.product} className="h-full w-full" />
              </div>

              <div className="min-w-48 flex-1">
                <h2 className="font-semibold">
                  <Link href={`/products/${item.product.slug}`} className="hover:underline">
                    {item.product.name}
                  </Link>
                </h2>
                <p className="text-xs text-muted-foreground">
                  {[item.product.strength, item.product.packSize].filter(Boolean).join(' · ')}
                </p>
                {needsRx && (
                  <p className="mt-1 text-xs font-semibold text-brand-teal">Prescription required</p>
                )}

                <div className="mt-3 flex items-center gap-3">
                  <form
                    action={async (formData: FormData) => {
                      'use server';
                      await setQuantity(item.product.id, Number(formData.get('quantity')));
                    }}
                    className="flex items-center gap-2"
                  >
                    <label
                      htmlFor={`qty-${item.product.id}`}
                      className="text-xs text-muted-foreground"
                    >
                      Qty
                    </label>
                    <input
                      id={`qty-${item.product.id}`}
                      name="quantity"
                      type="number"
                      min={1}
                      max={20}
                      defaultValue={quantity}
                      className="w-16 rounded border border-input bg-background px-2 py-1 text-sm"
                    />
                    <button
                      type="submit"
                      className="text-xs font-semibold text-brand-teal hover:underline"
                    >
                      Update
                    </button>
                  </form>

                  <form
                    action={async () => {
                      'use server';
                      await removeFromCart(item.product.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="text-xs font-semibold text-muted-foreground hover:underline"
                      data-testid="remove-line"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              </div>

              <p className="font-semibold">{formatMoney(lineTotal)}</p>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Subtotal</p>
          <p className="text-2xl font-bold" data-testid="cart-subtotal">
            {formatMoney(cart.subtotal)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Delivery is calculated at checkout.</p>
        </div>

        <Link
          href="/checkout"
          className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground"
        >
          Checkout
        </Link>
      </div>

      {cart.requiresPrescription && (
        <p className="mt-6 rounded-lg border border-brand-teal bg-brand-teal/5 p-4 text-sm">
          <strong className="font-semibold text-brand-deep">
            Your cart contains prescription medicine.
          </strong>{' '}
          You will be asked to upload a prescription at checkout, and a pharmacist registered with
          the Pharmacy and Poisons Board will review it before anything is dispensed.
        </p>
      )}
    </div>
  );
}
