import Link from 'next/link';

export const metadata = { title: 'Cart' };

/** Empty-state cart. The real basket, with persistence, arrives in Phase 4. */
export default function Page() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold">Your cart is empty</h1>
      <p className="mt-4 text-muted-foreground">
        Browse the shelves and add what you need. Basket persistence and checkout arrive in Phase 4.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground"
      >
        Start shopping
      </Link>
    </div>
  );
}
