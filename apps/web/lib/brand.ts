/**
 * SplendMed brand constants.
 *
 * Source: "SplendMed pharmacy.pdf" — brand guideline presentation, Teilyn Media,
 * December 2024. These values are contractual, not stylistic preferences. The
 * guideline's misuse page forbids altering logo colours, so anything needing a
 * brand colour reads it from here or from the CSS custom properties in globals.css.
 *
 * See BUILD_SPLENDMED.md §6 and docs/decisions/0002-logo-clear-space.md.
 */

/** The only five colours the brand owns. Verified against the guideline. */
export const BRAND_PALETTE = {
  teal: '#01B1AF',
  deep: '#0B5C58',
  lime: '#C1D72D',
  mint: '#8BD0BB',
  white: '#FFFFFF',
} as const;

export type BrandColor = keyof typeof BRAND_PALETTE;

/**
 * The guideline requires clear space on every side of at least 50% of the height
 * of the entire logo. Expressed as a ratio of the rendered logo height.
 */
export const LOGO_CLEAR_SPACE_RATIO = 0.5;

export const BRAND_VALUES = [
  'Trust',
  'Professionalism',
  'Compassion',
  'Wellness',
  'Innovation',
] as const;

export type BrandValue = (typeof BRAND_VALUES)[number];

export type LogoVariant =
  | 'colour'
  | 'on-dark'
  | 'white'
  | 'black'
  | 'icon'
  | 'icon-deep'
  | 'icon-white'
  | 'icon-black';

export interface LogoAsset {
  /** Public path. Kept URL-safe: the original filenames had spaces and @. */
  readonly src: string;
  readonly width: number;
  readonly height: number;
  /** Icon submarks are decorative when a wordmark already names the brand nearby. */
  readonly isSubmark: boolean;
}

/**
 * Logo files, cropped to their real content.
 *
 * Every supplied file was exported on the same ~1618x948 artboard, so the
 * wordmarks used 33% of their canvas and the icons 13%. Rendered at a header
 * height of 32px the actual mark was about 14px tall. The files are now cropped
 * to the content plus a 6px margin for anti-aliased edges; only transparent
 * canvas was removed, so no pixel of the logo itself changed. Originals are in
 * docs/brand/original-artboards/. See docs/decisions/0002-logo-clear-space.md.
 *
 * `colour` is the full-colour primary mark — teal Splend, lime Med — and is the
 * one for light backgrounds. It was previously shipped as an unused
 * "artboard-1.png" while the header used the light-grey on-dark variant on a
 * white background, which is why the logo was barely visible.
 */
export const LOGO_ASSETS: Record<LogoVariant, LogoAsset> = {
  colour: { src: '/brand/logo-colour.png', width: 1243, height: 424, isSubmark: false },
  'on-dark': { src: '/brand/logo-on-dark.png', width: 1243, height: 424, isSubmark: false },
  white: { src: '/brand/logo-white.png', width: 1243, height: 424, isSubmark: false },
  black: { src: '/brand/logo-black.png', width: 1243, height: 424, isSubmark: false },
  icon: { src: '/brand/icon-colour.png', width: 419, height: 497, isSubmark: true },
  'icon-deep': { src: '/brand/icon-deep.png', width: 418, height: 497, isSubmark: true },
  'icon-white': { src: '/brand/icon-white.png', width: 418, height: 497, isSubmark: true },
  'icon-black': { src: '/brand/icon-black.png', width: 419, height: 497, isSubmark: true },
};

/** Clear space in pixels for a logo rendered at the given height. */
export function clearSpaceFor(height: number): number {
  return Math.round(height * LOGO_CLEAR_SPACE_RATIO);
}

/** Width that preserves the asset's intrinsic aspect ratio at a given height. */
export function scaledWidthFor(variant: LogoVariant, height: number): number {
  const asset = LOGO_ASSETS[variant];
  return Math.round((asset.width / asset.height) * height);
}
