import Link from 'next/link';

import { IMAGE_CREDITS } from '@/lib/image-credits';

export const metadata = {
  title: 'Image credits',
  description: 'Attribution for product photography used on SplendMed Pharmacy.',
};

/**
 * Attribution page.
 *
 * CC BY and CC BY-SA require credit to the author, a licence statement and a
 * link. This page discharges that obligation in one place rather than cluttering
 * every product card, which is the normal practice for a catalogue.
 */
export default function CreditsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Image credits</h1>
      <p className="mt-4 text-muted-foreground">
        Product photography on this site comes from Wikimedia Commons under open licences. Each
        image is credited to its author below. Where a product has no photograph we draw an
        illustration of its dosage form rather than show packaging that is not ours to use.
      </p>

      <ul className="mt-8 divide-y divide-border border-y border-border">
        {IMAGE_CREDITS.map((credit) => (
          <li key={credit.productId} className="py-4">
            <p className="font-semibold">{credit.product}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              by {credit.author} ·{' '}
              {credit.licenseUrl ? (
                <a
                  href={credit.licenseUrl}
                  className="underline"
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                >
                  {credit.license}
                </a>
              ) : (
                credit.license
              )}{' '}
              ·{' '}
              <a
                href={credit.sourceUrl}
                className="underline"
                rel="noopener noreferrer nofollow"
                target="_blank"
              >
                source
              </a>
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm text-muted-foreground">
        These photographs show the medicine generically. They are not photographs of the exact
        pack SplendMed dispenses — always read the label on what you receive.
      </p>

      <Link href="/" className="mt-8 inline-block font-semibold text-primary hover:underline">
        Back to the shop
      </Link>
    </div>
  );
}
