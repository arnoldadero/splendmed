import Link from 'next/link';

import { addMoney, formatMoney, money } from '@splendmed/domain';

import { CheckoutForm } from '@/components/checkout-form';
import { getCart } from '@/lib/cart';

export const metadata = { title: 'Checkout' };

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

  const delivery = money(20000);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">Checkout</h1>

      <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
        {cart.lines.map(({ item, quantity, lineTotal }) => (
          <li key={item.product.id} className="flex justify-between gap-4 p-4 text-sm">
            <span>
              {item.product.name}
              {item.product.strength ? ` ${item.product.strength}` : ''}
              <span className="text-muted-foreground"> × {quantity}</span>
              {item.product.dispensing !== 'otc' && (
                <span className="ml-2 text-xs font-semibold text-brand-teal">Rx</span>
              )}
            </span>
            <span className="font-semibold">{formatMoney(lineTotal)}</span>
          </li>
        ))}
        <li className="flex justify-between p-4 text-sm">
          <span className="text-muted-foreground">Delivery (Kisumu)</span>
          <span>{formatMoney(delivery)}</span>
        </li>
        <li className="flex justify-between bg-secondary p-4 font-bold">
          <span>Total</span>
          <span data-testid="checkout-total">
            {formatMoney(addMoney(cart.subtotal, delivery))}
          </span>
        </li>
      </ul>

      <CheckoutForm requiresPrescription={cart.requiresPrescription} />
    </div>
  );
}
