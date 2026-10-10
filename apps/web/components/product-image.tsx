import type { Product } from '@splendmed/domain';

import { PackShot } from '@/components/pack-shot';

/**
 * Product imagery, in order of preference:
 *
 *  1. a real photograph — Juleb's image_url, or a file dropped into
 *     public/products/ (see docs/product/product-images.md);
 *  2. a rendered pack shot carrying the product's own name and strength.
 *
 * The pack shot is the fallback, not a stand-in for photography forever: the
 * moment a photo exists for a product it takes over, with no code change.
 */

export interface ProductImageProps {
  product: Pick<
    Product,
    'form' | 'unitLabel' | 'imageUrl' | 'name' | 'categoryIds' | 'strength' | 'brand'
  >;
  className?: string | undefined;
}

export function ProductImage({ product, className }: ProductImageProps) {
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
        // object-contain: the frame is square and photographs are not.
        className={`${className ?? ''} object-contain`.trim()}
      />
    );
  }

  return <PackShot product={product} className={className} />;
}
