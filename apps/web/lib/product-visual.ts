import type { Product } from '@splendmed/domain';

/**
 * Which illustration represents a product, derived from its dosage form.
 *
 * Pure logic, deliberately kept out of the .tsx component so it can be unit
 * tested: tsconfig sets jsx: "preserve" for Next.js, which stops the test runner
 * parsing a file containing JSX.
 */
export type ProductVisual =
  | 'blister'
  | 'bottle'
  | 'tube'
  | 'sachet'
  | 'vial'
  | 'tin'
  | 'device'
  | 'box';

/**
 * Picks the illustration from the dosage form first and the unit of sale second.
 * Form is the more specific signal: a "tablet" sold in a "box" is still a blister.
 */
export function productVisual(product: Pick<Product, 'form' | 'unitLabel'>): ProductVisual {
  const form = product.form?.toLowerCase() ?? '';

  if (/tablet|capsule|caplet/.test(form)) {
    // Effervescent tablets ship in a tube, not a blister.
    return /effervescent/.test(form) ? 'tin' : 'blister';
  }
  if (/syrup|suspension|solution|drops|elixir/.test(form)) return 'bottle';
  if (/cream|ointment|gel|balm/.test(form)) return 'tube';
  if (/injection|ampoule|vial/.test(form)) return 'vial';
  if (/device|monitor|meter|kit/.test(form)) return 'device';
  if (/sachet|powder|granule/.test(form)) return 'sachet';

  switch (product.unitLabel) {
    case 'bottle':
      return 'bottle';
    case 'tube':
      return 'tube';
    case 'sachet':
      return 'sachet';
    case 'vial':
      return 'vial';
    case 'tin':
      return 'tin';
    case 'box':
      return 'device';
    case 'pack':
      return 'blister';
    default:
      return 'box';
  }
}

/**
 * Tint for a product tile, derived from its category.
 *
 * A grid of fifty identical teal glyphs reads as a placeholder. Varying the hue
 * by shelf makes the catalogue scannable — a shopper learns that blue is
 * cardiovascular and amber is digestion without being told. All values are
 * derived from the brand palette or sit alongside it; none are arbitrary.
 */
export interface VisualTint {
  readonly fg: string;
  readonly bg: string;
}

const CATEGORY_TINT: Record<string, VisualTint> = {
  'JC-PAINRELIEF': { fg: '#0B5C58', bg: '#E6F4F3' },
  'JC-ANTIMALARIAL': { fg: '#B45309', bg: '#FEF3E2' },
  'JC-ANTIBIOTIC': { fg: '#7C3AED', bg: '#F3EDFF' },
  'JC-ENDOCRINE': { fg: '#0369A1', bg: '#E4F2FB' },
  'JC-CARDIOVASCULAR': { fg: '#BE123C', bg: '#FDE9EE' },
  'JC-RESPIRATORY': { fg: '#0E7490', bg: '#E2F4F7' },
  'JC-COUGHCOLD': { fg: '#1D4ED8', bg: '#E8EEFD' },
  'JC-DIGESTIVE': { fg: '#A16207', bg: '#FBF3DF' },
  'JC-SKINCARE': { fg: '#9D174D', bg: '#FCE9F1' },
  'JC-PERSONALCARE': { fg: '#4D7C0F', bg: '#F1F7E3' },
  'JC-MUMANDBABY': { fg: '#C2410C', bg: '#FEEEE5' },
  'JC-SUPPLEMENTS': { fg: '#15803D', bg: '#E7F6EC' },
  'JC-DEVICES': { fg: '#334155', bg: '#EEF1F5' },
  'JC-CNS': { fg: '#6D28D9', bg: '#F1EBFE' },
};

const DEFAULT_TINT: VisualTint = { fg: '#01B1AF', bg: '#F1FAF6' };

export function tintFor(categoryIds: readonly string[]): VisualTint {
  for (const id of categoryIds) {
    const tint = CATEGORY_TINT[id];
    if (tint) return tint;
  }
  return DEFAULT_TINT;
}
