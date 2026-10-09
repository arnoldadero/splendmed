import type { Product } from '@splendmed/domain';

import { productVisual, type ProductVisual } from '@/lib/product-visual';

/**
 * Product imagery.
 *
 * Juleb returns no image URLs for our catalog today (image_url is null on every
 * fixture), and we will not substitute real product photography: the packaging of
 * Panadol, Coartem, Accu-Chek and the rest is copyrighted, and showing the wrong
 * box next to a medicine is a safety problem before it is a legal one.
 *
 * So each product gets an original illustration of its dosage FORM — a blister
 * pack reads as a blister pack, a syrup reads as a bottle. That tells the shopper
 * something true and useful, where a letter tile told them nothing.
 *
 * These are inline SVG: no network request, no layout shift, crisp at any size,
 * and they inherit colour so light and dark themes both work.
 *
 * When Juleb does supply images, ProductImage switches to them — see the open
 * question about the image host in docs/integrations/juleb.md.
 */

/* Shared drawing conventions: 64x64 viewBox, 2.5 stroke, low-opacity fill. */
const S = {
  fill: 'currentColor',
  fillOpacity: 0.12,
  stroke: 'currentColor',
  strokeWidth: 2.5,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
};

const SHAPES: Record<ProductVisual, React.ReactNode> = {
  blister: (
    <>
      <rect x="9" y="14" width="46" height="36" rx="4" {...S} />
      {[0, 1, 2].map((col) =>
        [0, 1].map((row) => (
          <ellipse
            key={`${col}-${row}`}
            cx={19 + col * 13}
            cy={25 + row * 14}
            rx="5"
            ry="5.5"
            {...S}
            fillOpacity={0.3}
          />
        )),
      )}
    </>
  ),
  bottle: (
    <>
      <rect x="26" y="8" width="12" height="7" rx="1.5" {...S} fillOpacity={0.3} />
      <path d="M28 15v5l-6 5v27a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V25l-6-5v-5" {...S} />
      <path d="M22 36h20" {...S} fillOpacity={0} />
    </>
  ),
  tube: (
    <>
      <rect x="27" y="7" width="10" height="6" rx="1.5" {...S} fillOpacity={0.3} />
      <path d="M24 13h16l3 36a4 4 0 0 1-4 4H25a4 4 0 0 1-4-4z" {...S} />
      <path d="M23 20h18" {...S} fillOpacity={0} />
    </>
  ),
  sachet: (
    <>
      <path d="M16 12h32v40a2 2 0 0 1-2 2H18a2 2 0 0 1-2-2z" {...S} />
      <path d="M16 12l4 3 4-3 4 3 4-3 4 3 4-3 4 3 4-3" {...S} fillOpacity={0} />
      <path d="M24 32h16" {...S} fillOpacity={0} />
    </>
  ),
  vial: (
    <>
      <rect x="25" y="7" width="14" height="6" rx="2" {...S} fillOpacity={0.3} />
      <path d="M27 13v6l-4 4v27a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V23l-4-4v-6" {...S} />
      <path d="M23 38h18" {...S} fillOpacity={0} />
    </>
  ),
  tin: (
    <>
      <ellipse cx="32" cy="15" rx="15" ry="6" {...S} fillOpacity={0.3} />
      <path d="M17 15v34c0 3.3 6.7 6 15 6s15-2.7 15-6V15" {...S} />
    </>
  ),
  device: (
    <>
      <rect x="18" y="8" width="28" height="48" rx="5" {...S} />
      <rect x="24" y="16" width="16" height="12" rx="2" {...S} fillOpacity={0.3} />
      <circle cx="32" cy="43" r="4.5" {...S} fillOpacity={0.3} />
    </>
  ),
  box: (
    <>
      <rect x="11" y="16" width="42" height="34" rx="3" {...S} />
      <path d="M32 16v34" {...S} fillOpacity={0} />
      <path d="M22 28h6M25 25v6" {...S} fillOpacity={0} />
    </>
  ),
};

export interface ProductImageProps {
  product: Pick<Product, 'form' | 'unitLabel' | 'imageUrl' | 'name'>;
  className?: string;
}

export function ProductImage({ product, className }: ProductImageProps) {
  // Real photography wins the moment Juleb provides it.
  if (product.imageUrl) {
    return (
      /*
       * Plain <img>, not next/image: optimisation requires the image host in
       * next.config remotePatterns, and Juleb has not told us what that host is
       * (question 7e). A plain tag works with whatever domain turns up; swap to
       * next/image once the host is known.
       */
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={product.imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={className}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      // Decorative: the product name sits right beside it in every usage, so
      // announcing the illustration would just repeat it.
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[productVisual(product)]}
    </svg>
  );
}
