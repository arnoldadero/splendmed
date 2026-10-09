import Link from 'next/link';

/**
 * Honest placeholder for a route the navigation links to but a later phase
 * delivers. Linking to a 404 would be worse, and silently removing the link
 * would hide the roadmap from anyone reviewing the storefront.
 */
export function ComingInPhase({
  title,
  phase,
  what,
}: {
  title: string;
  phase: string;
  what: string;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-teal">{phase}</p>
      <h1 className="mt-2 text-3xl font-bold">{title}</h1>
      <p className="mt-4 text-muted-foreground">{what}</p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground"
      >
        Back to the shop
      </Link>
    </div>
  );
}
