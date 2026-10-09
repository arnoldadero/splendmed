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
  | 'primary'
  | 'white'
  | 'black'
  | 'icon'
  | 'icon-white'
  | 'icon-black'
  | 'green';

export interface LogoAsset {
  /** Public path. Kept URL-safe: the original filenames had spaces and @. */
  readonly src: string;
  readonly width: number;
  readonly height: number;
  /** Icon submarks are decorative when a wordmark already names the brand nearby. */
  readonly isSubmark: boolean;
}

/**
 * Intrinsic dimensions are read from the PNG headers, not estimated, so
 * next/image reserves the correct space and no layout shift occurs.
 */
export const LOGO_ASSETS: Record<LogoVariant, LogoAsset> = {
  primary: { src: '/brand/logo-primary.png', width: 1618, height: 947, isSubmark: false },
  white: { src: '/brand/logo-white.png', width: 1618, height: 947, isSubmark: false },
  black: { src: '/brand/logo-black.png', width: 1618, height: 947, isSubmark: false },
  icon: { src: '/brand/icon.png', width: 1618, height: 948, isSubmark: true },
  'icon-white': { src: '/brand/icon-white.png', width: 1617, height: 948, isSubmark: true },
  'icon-black': { src: '/brand/icon-black.png', width: 1618, height: 948, isSubmark: true },
  green: { src: '/brand/icon-green.png', width: 1618, height: 948, isSubmark: true },
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
