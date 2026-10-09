/**
 * Canonical site origin, for metadata, sitemap and robots.
 *
 * Vercel sets VERCEL_PROJECT_PRODUCTION_URL on production deployments and
 * VERCEL_URL on previews. Falling back to localhost keeps local builds honest
 * rather than baking a production hostname into every environment.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;

  const preview = process.env.VERCEL_URL;
  if (preview) return `https://${preview}`;

  return 'http://localhost:3000';
}
