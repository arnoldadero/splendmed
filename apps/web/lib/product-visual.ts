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
