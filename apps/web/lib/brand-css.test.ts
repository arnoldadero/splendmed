import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { BRAND_PALETTE } from './brand';

/*
 * The palette lives in two places by necessity: TypeScript (for logic) and CSS
 * (for Tailwind theme tokens). That duplication is the drift risk — someone
 * adjusts one and not the other, and the app renders a colour the brand does not
 * own. These tests tie the two together.
 */
const globalsCss = readFileSync(
  fileURLToPath(new URL('../app/globals.css', import.meta.url)),
  'utf8',
);

describe('globals.css brand tokens', () => {
  it.each(Object.entries(BRAND_PALETTE))(
    'declares a --color-brand token for %s (%s)',
    (name, hex) => {
      expect(globalsCss.toLowerCase()).toContain(`--color-brand-${name}: ${hex.toLowerCase()}`);
    },
  );

  /*
   * Regression guard. Tailwind v4 drops @theme values no utility references, which
   * silently removed the lime accent from the production bundle. `static` forces all
   * five brand colours to emit. If this marker is lost, the bug returns invisibly.
   */
  it('marks the brand palette block as static so no token is tree-shaken', () => {
    expect(globalsCss).toMatch(/@theme\s+static\s*\{/);
  });

  it('keeps the focus-visible outline that WCAG 2.2 AA requires', () => {
    expect(globalsCss).toContain(':focus-visible');
  });
});
