/**
 * Imports real product photographs into the storefront.
 *
 * Usage: node scripts/gen/import-photos.mjs <folder-of-photos>
 *
 * Name each photo after the product as it appears on the site, e.g.
 * "Panadol Extra.jpg" or "Coartem.png". The script matches it to the catalogue
 * by name, copies it to apps/web/public/products/<product-id>.<ext>, and reports
 * anything it could not match. Real photos then replace the rendered pack shots
 * automatically — no code change.
 *
 * Use photographs SplendMed owns or has a licence for: your own shelf photos,
 * or manufacturer trade assets supplied by your distributor.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const source = process.argv[2];
if (!source || !existsSync(source)) {
  console.error('Usage: node scripts/gen/import-photos.mjs <folder-of-photos>');
  process.exit(1);
}

const catalogue = JSON.parse(
  readFileSync('packages/juleb/src/__fixtures__/products.json', 'utf8'),
);
const normalise = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');
const byName = new Map(catalogue.map((p) => [normalise(p.name), p]));

const dest = 'apps/web/public/products';
mkdirSync(dest, { recursive: true });

const IMAGE = /\.(jpe?g|png|webp|avif)$/i;
let imported = 0;
const unmatched = [];

for (const file of readdirSync(source).filter((f) => IMAGE.test(f))) {
  const ext = path.extname(file).toLowerCase();
  const product = byName.get(normalise(path.basename(file, path.extname(file))));
  if (!product) {
    unmatched.push(file);
    continue;
  }
  copyFileSync(path.join(source, file), path.join(dest, `${product.id}${ext}`));
  console.log(`  ${file}  ->  ${product.id}${ext}  (${product.name})`);
  imported += 1;
}

console.log(`\nImported ${imported} photo(s).`);
if (unmatched.length) {
  console.log(`No product matched ${unmatched.length} file(s) — rename them to the product name:`);
  for (const f of unmatched) console.log(`  ${f}`);
}
console.log('Restart the dev server, or redeploy, to pick them up.');
