import { getJulebClient } from '@splendmed/juleb';
import pg from 'pg';

import { syncCatalog } from '../sync-catalog';

/**
 * Runs the catalogue sync once against a real database.
 *
 *   set -a; . ./.env.local; set +a
 *   pnpm --filter @splendmed/db sync:catalog
 *
 * SUPABASE_DB_URL is the session-pooler URL, kept in the gitignored root
 * .env.local. The Juleb driver follows JULEB_DRIVER, so this seeds from the mock
 * today and from Juleb itself once the real driver exists.
 */
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_URL is not set. Load the root .env.local first.');
  process.exit(1);
}

// Supabase's pooler presents a certificate from its own CA rather than a public
// one. The link is still encrypted; for an unattended job, pin Supabase's CA
// certificate instead of disabling verification.
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  const result = await syncCatalog(client, getJulebClient());
  console.log(
    `synced ${result.products} products, ${result.branches} branches, ${result.stockRows} stock rows`,
  );
} finally {
  await client.end();
}
