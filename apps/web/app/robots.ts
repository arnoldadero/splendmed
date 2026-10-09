import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Nothing useful or indexable lives behind these, and a cart URL in
        // search results is noise at best.
        disallow: ['/cart', '/checkout', '/account', '/search'],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
