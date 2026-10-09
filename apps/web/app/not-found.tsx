import Link from 'next/link';

export const metadata = { title: 'Page not found' };

/** Branded 404. The default Next page is unstyled and says nothing useful. */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-teal">404</p>
      <h1 className="mt-3 text-3xl font-bold">We could not find that page</h1>
      <p className="mt-4 text-muted-foreground">
        It may have moved, or the product may no longer be stocked.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/shop"
          className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground"
        >
          Browse all products
        </Link>
        <Link href="/" className="rounded-lg border border-border px-5 py-3 font-semibold">
          Go home
        </Link>
      </div>
    </div>
  );
}
