import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Real product photography, resolved from the filesystem.
 *
 * Precedence for what a shopper sees:
 *   1. image_url from Juleb            — the distributor's own asset
 *   2. a file in public/products/      — photography SplendMed supplies
 *   3. the dosage-form illustration    — fallback, always present
 *
 * Dropping a file into public/products/ is all that is needed; no code change.
 * Name it after the Juleb product id (JP-0001.jpg) or the product slug
 * (panadol-extra-500mg-65mg.jpg). See docs/product/product-images.md.
 *
 * The directory is read once per server process. New files need a restart in
 * dev, which is the normal trade for not hitting the filesystem per render.
 */

/*
 * process.cwd(), not new URL(..., import.meta.url): webpack treats a relative
 * specifier inside new URL() as a module to resolve at build time, which fails
 * with "Module not found". Next runs the app with cwd set to the app directory.
 */
const PRODUCTS_DIR = path.join(process.cwd(), 'public', 'products');
const EXTENSIONS = ['.webp', '.jpg', '.jpeg', '.png', '.avif'];

function buildIndex(): Map<string, string> {
  const index = new Map<string, string>();
  if (!existsSync(PRODUCTS_DIR)) return index;

  for (const file of readdirSync(PRODUCTS_DIR)) {
    const dot = file.lastIndexOf('.');
    if (dot <= 0) continue;
    const ext = file.slice(dot).toLowerCase();
    if (!EXTENSIONS.includes(ext)) continue;
    // Key on the lowercased stem so JP-0001.jpg and jp-0001.jpg both resolve.
    index.set(file.slice(0, dot).toLowerCase(), `/products/${file}`);
  }
  return index;
}

let cached: Map<string, string> | undefined;

function index(): Map<string, string> {
  cached ??= buildIndex();
  return cached;
}

/**
 * Finds supplied photography for a product, by Juleb id or by slug.
 * Returns null when there is none, so the caller falls back to the illustration.
 */
export function localImageFor(keys: readonly (string | null | undefined)[]): string | null {
  const map = index();
  for (const key of keys) {
    if (!key) continue;
    const hit = map.get(key.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

/** How many images are currently supplied. Surfaced in the admin view later. */
export function suppliedImageCount(): number {
  return index().size;
}
