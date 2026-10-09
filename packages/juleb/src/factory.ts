import { HttpJulebClient } from './drivers/http';
import { MockJulebClient } from './drivers/mock';
import type { JulebClient } from './port';

export type JulebDriverName = 'mock' | 'http';

export function parseDriverName(raw: string | undefined): JulebDriverName {
  if (raw === 'http') return 'http';
  if (raw === 'mock' || raw === undefined || raw === '') return 'mock';
  throw new Error(
    `JULEB_DRIVER must be "mock" or "http", received "${raw}". See docs/integrations/juleb.md.`,
  );
}

let cached: JulebClient | undefined;

/**
 * Resolves the Juleb driver once (§8.2).
 *
 * Centralising this is the point: feature code must never branch on which driver
 * is active. If `if (isMock)` appears outside this file, the abstraction has
 * failed and the real integration will not drop in cleanly.
 *
 * Defaults to the mock. That is deliberate — an unset variable should not silently
 * select a driver that throws on every call.
 */
export function getJulebClient(): JulebClient {
  if (cached) return cached;
  cached = parseDriverName(process.env.JULEB_DRIVER) === 'http'
    ? new HttpJulebClient()
    : new MockJulebClient();
  return cached;
}

/** Test seam: replace or clear the resolved client. */
export function setJulebClientForTesting(client: JulebClient | undefined): void {
  cached = client;
}
