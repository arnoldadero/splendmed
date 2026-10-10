import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  BRAND_PALETTE,
  BRAND_VALUES,
  LOGO_ASSETS,
  LOGO_CLEAR_SPACE_RATIO,
  clearSpaceFor,
  scaledWidthFor,
  type LogoVariant,
} from './brand';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));

/*
 * These are not style tests. The brand guideline is contractual: it forbids
 * recolouring the logo and specifies the palette exactly. A well-meaning tweak to
 * a hex value is a brand violation, so the values are pinned here and any change
 * has to be deliberate enough to edit a test.
 */
describe('brand palette', () => {
  it('matches the brand guideline exactly', () => {
    expect(BRAND_PALETTE).toStrictEqual({
      teal: '#01B1AF',
      deep: '#0B5C58',
      lime: '#C1D72D',
      mint: '#8BD0BB',
      white: '#FFFFFF',
    });
  });

  it('uses uppercase six-digit hex throughout', () => {
    for (const value of Object.values(BRAND_PALETTE)) {
      expect(value).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});

describe('brand values', () => {
  it('carries the five values from the guideline', () => {
    expect(BRAND_VALUES).toStrictEqual([
      'Trust',
      'Professionalism',
      'Compassion',
      'Wellness',
      'Innovation',
    ]);
  });
});

describe('logo assets', () => {
  const variants = Object.keys(LOGO_ASSETS) as LogoVariant[];

  it('covers every declared variant', () => {
    expect(variants).toHaveLength(8);
  });

  // A broken asset path renders as a silent empty box in production. Catch it here.
  it.each(variants)('variant "%s" points at a file that exists', (variant) => {
    const asset = LOGO_ASSETS[variant];
    expect(existsSync(`${publicDir}${asset.src}`)).toBe(true);
  });

  // Wrong intrinsic dimensions cause layout shift, which costs us the §12 LCP budget.
  it.each(variants)('variant "%s" declares its true PNG dimensions', (variant) => {
    const asset = LOGO_ASSETS[variant];
    const bytes = readFileSync(`${publicDir}${asset.src}`);
    // PNG IHDR: width at byte offset 16, height at 20, both big-endian uint32.
    expect({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }).toStrictEqual({
      width: asset.width,
      height: asset.height,
    });
  });

  it('serves every asset from the URL-safe /brand prefix', () => {
    for (const variant of variants) {
      expect(LOGO_ASSETS[variant].src).toMatch(/^\/brand\/[a-z0-9-]+\.png$/);
    }
  });
});

describe('clear space', () => {
  it('is the guideline minimum of 50% of logo height', () => {
    expect(LOGO_CLEAR_SPACE_RATIO).toBe(0.5);
  });

  it('computes padding from rendered height', () => {
    expect(clearSpaceFor(40)).toBe(20);
    expect(clearSpaceFor(36)).toBe(18);
    expect(clearSpaceFor(37)).toBe(19);
  });
});

describe('scaled width', () => {
  it('preserves the intrinsic aspect ratio', () => {
    const asset = LOGO_ASSETS.colour;
    const height = 100;
    const expected = Math.round((asset.width / asset.height) * height);
    expect(scaledWidthFor('colour', height)).toBe(expected);
  });

  it('never returns a degenerate width', () => {
    for (const variant of Object.keys(LOGO_ASSETS) as LogoVariant[]) {
      expect(scaledWidthFor(variant, 40)).toBeGreaterThan(0);
    }
  });
});

/*
 * Regression guard for the bug that made the logo invisible: every file had been
 * exported on a ~1618x948 artboard, so the mark used 13-33% of its canvas and
 * rendered at a fraction of the requested height. If an uncropped asset is ever
 * dropped back in, this fails.
 */
describe('logo assets are cropped to their content', () => {
  it.each(Object.keys(LOGO_ASSETS) as LogoVariant[])(
    'variant "%s" has no large transparent border',
    (variant) => {
      const asset = LOGO_ASSETS[variant];
      // Wordmarks are ~2.9:1 and icons ~0.84:1. The old artboard was 1.71:1 for
      // every file, which is the tell that nothing had been cropped.
      const ratio = asset.width / asset.height;
      expect(ratio).not.toBeCloseTo(1618 / 948, 1);
    },
  );

  it('the default light-background mark is the full-colour one', () => {
    // "logo-colour.png" — teal Splend, lime Med. Shipping the light-grey on-dark
    // variant on a white header is what made the logo barely visible.
    expect(LOGO_ASSETS.colour.src).toBe('/brand/logo-colour.png');
    expect(LOGO_ASSETS['on-dark'].src).toBe('/brand/logo-on-dark.png');
  });
});

/*
 * String paths to /brand assets are invisible to the type checker. Renaming the
 * logo files left the favicon and the social share image pointing at files that
 * no longer existed, and nothing failed. This scans the source for every
 * /brand/ path and checks the file is really there.
 */
describe('every /brand path referenced in source exists', () => {
  const appDir = fileURLToPath(new URL('../app', import.meta.url));
  const componentsDir = fileURLToPath(new URL('../components', import.meta.url));

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
    });
  }

  const referenced = new Set<string>();
  for (const file of [...sourceFiles(appDir), ...sourceFiles(componentsDir)]) {
    for (const match of readFileSync(file, 'utf8').matchAll(/\/brand\/[a-z0-9-]+\.png/g)) {
      referenced.add(match[0]);
    }
  }

  it('finds at least the favicon and share image', () => {
    expect(referenced.size).toBeGreaterThanOrEqual(2);
  });

  it.each([...referenced])('%s exists in public/', (ref) => {
    expect(existsSync(`${publicDir}${ref}`)).toBe(true);
  });
});
