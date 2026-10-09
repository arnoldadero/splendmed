'use client';

import { useTransition, useState } from 'react';

import { addToCart } from '@/lib/actions/cart';

/**
 * Add-to-cart control.
 *
 * A client component only because it needs pending and error state. The mutation
 * itself runs on the server, which re-checks availability — the disabled state
 * below is a courtesy to the shopper, not the thing enforcing anything.
 */
export function AddToCart({
  productId,
  outOfStock,
  needsPrescription,
  className,
}: {
  productId: string;
  outOfStock: boolean;
  needsPrescription: boolean;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  if (outOfStock) {
    return (
      <button type="button" className={className} data-testid="notify-me">
        Notify me
      </button>
    );
  }

  const label = pending ? 'Adding…' : added ? 'Added ✓' : needsPrescription ? 'Add — needs prescription' : 'Add to cart';

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={pending}
        data-testid="add-to-cart"
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await addToCart(productId);
            if (result.ok) {
              setAdded(true);
              // Revert the confirmation so the control stays usable for a second add.
              setTimeout(() => setAdded(false), 2000);
            } else {
              setError(result.error);
            }
          })
        }
      >
        {label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
