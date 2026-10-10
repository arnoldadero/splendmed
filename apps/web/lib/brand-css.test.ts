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

/*
 * WCAG contrast, guarded. The brand teal measured 2.66:1 against white — under
 * the 4.5:1 AA floor — and was the primary button and link colour across the
 * whole site from the first commit until a UI audit caught it. These tests
 * recompute the ratios from the stylesheet so it cannot quietly regress.
 */
function luminance(hex: string): number {
  const channels = hex
    .replace('#', '')
    .match(/../g)!
    .map((h) => Number.parseInt(h, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/**
 * Reads a hex value for a custom property out of globals.css.
 *
 * Deliberately not a RegExp built from a template string: `\s` inside a template
 * literal silently becomes a plain `s`, which is how the first version of this
 * helper matched nothing.
 */
function token(name: string): string {
  const start = globalsCss.indexOf(`${name}:`);
  if (start === -1) throw new Error(`token ${name} not found in globals.css`);
  const hex = globalsCss.slice(start + name.length + 1).trimStart().slice(0, 7);
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`token ${name} is not a six-digit hex value: "${hex}"`);
  }
  return hex;
}

describe('colour contrast meets WCAG AA', () => {
  it('the light-mode primary is the accessible shade, not the raw brand teal', () => {
    const lightRoot = globalsCss.slice(globalsCss.indexOf(':root {'));
    const primaryLine = lightRoot.match(/--primary:\s*([^;]+);/)?.[1]?.trim();
    expect(primaryLine).toBe('var(--color-brand-teal-700)');
  });

  it('white text on the primary button passes 4.5:1', () => {
    expect(contrast('#ffffff', token('--color-brand-teal-700'))).toBeGreaterThanOrEqual(4.5);
  });

  it('primary-coloured text on white passes 4.5:1', () => {
    expect(contrast(token('--color-brand-teal-700'), '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  // Documents why the raw brand teal is not used for text: if this ever passes,
  // the palette changed and the workaround can be revisited.
  it('records that the raw brand teal cannot carry text on white', () => {
    expect(contrast(token('--color-brand-teal'), '#ffffff')).toBeLessThan(3);
  });

  it('dark-mode primary still passes against the dark background', () => {
    expect(contrast(token('--color-brand-teal'), token('--color-brand-deep-900'))).toBeGreaterThanOrEqual(4.5);
  });

  it('the trust strip, white on deep teal, passes', () => {
    expect(contrast('#ffffff', token('--color-brand-deep'))).toBeGreaterThanOrEqual(4.5);
  });

  it('discount badges, deep teal on lime, pass', () => {
    expect(contrast(token('--color-brand-deep'), token('--color-brand-lime'))).toBeGreaterThanOrEqual(4.5);
  });
});
