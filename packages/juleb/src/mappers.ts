import {
  money,
  type Branch,
  type DispensingClass,
  type Money,
  type Product,
  type StockLevel,
  type UnitLabel,
} from '@splendmed/domain';

import { JulebSchemaError } from './errors';
import type { JulebBranch, JulebMoney, JulebProduct, JulebStockLevel } from './wire';

/**
 * Anti-corruption layer: Juleb wire shapes in, SplendMed domain out (§8.3).
 *
 * Nothing outside this package imports a Juleb type. When the real API spec lands
 * and the wire schemas are rewritten, this file absorbs the difference.
 */

/**
 * Decimal amount string to integer minor units, without going through a float.
 *
 * Multiplying a parsed float by 100 is not reliably exact — binary floating point
 * cannot represent these values — and money must be exact. Parsing the digits
 * directly avoids the question entirely.
 */
export function decimalStringToMinor(amount: string, operation: string): number {
  const match = /^(-?)(\d+)(?:\.(\d{1,4}))?$/.exec(amount.trim());
  if (!match) {
    throw new JulebSchemaError(operation, `amount "${amount}" is not a decimal string`);
  }
  const [, sign, whole, fraction = ''] = match;
  // Normalise to exactly 2 decimal places, rounding half-up on the third digit.
  const padded = fraction.padEnd(3, '0');
  const centsFromFraction = Number(padded.slice(0, 2));
  const roundUp = Number(padded[2]) >= 5 ? 1 : 0;
  const minor = Number(whole) * 100 + centsFromFraction + roundUp;
  if (!Number.isSafeInteger(minor)) {
    throw new JulebSchemaError(operation, `amount "${amount}" exceeds safe integer range`);
  }
  return sign === '-' ? -minor : minor;
}

export function toMoney(wire: JulebMoney, operation: string): Money {
  if (wire.currency !== 'KES') {
    // Fail rather than silently mislabel. A non-KES price reaching a Kenyan
    // storefront is a configuration error worth stopping for.
    throw new JulebSchemaError(operation, `unsupported currency "${wire.currency}", expected KES`);
  }
  return money(decimalStringToMinor(wire.amount, operation), 'KES');
}

/**
 * Regulatory classification.
 *
 * Safety-critical. An unrecognised value throws; it must never fall back to
 * 'otc', because that would silently let a prescription-only medicine be sold
 * without review and defeat §3.2 at the one place it cannot be caught later.
 * Failing the sync for one product is strictly better than mis-selling it.
 */
const DISPENSING_BY_WIRE_VALUE: Record<string, DispensingClass> = {
  otc: 'otc',
  over_the_counter: 'otc',
  gsl: 'otc',
  p: 'otc',
  pom: 'pom',
  prescription: 'pom',
  prescription_only: 'pom',
  rx: 'pom',
  controlled: 'controlled',
  cd: 'controlled',
  narcotic: 'controlled',
  psychotropic: 'controlled',
};

export function toDispensingClass(wireValue: string, operation: string): DispensingClass {
  const key = wireValue.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const mapped = DISPENSING_BY_WIRE_VALUE[key];
  if (!mapped) {
    throw new JulebSchemaError(
      operation,
      `unknown dispensing_class "${wireValue}". Refusing to default to over-the-counter: ` +
        `a misclassified prescription medicine would bypass pharmacist review (§3.2). ` +
        `Add the mapping once Juleb confirms their vocabulary.`,
    );
  }
  return mapped;
}

const UNIT_BY_WIRE_VALUE: Record<string, UnitLabel> = {
  piece: 'piece',
  pieces: 'piece',
  each: 'piece',
  tablet: 'piece',
  capsule: 'piece',
  pack: 'pack',
  packet: 'pack',
  packets: 'pack',
  strip: 'pack',
  bottle: 'bottle',
  bottles: 'bottle',
  tube: 'tube',
  sachet: 'sachet',
  vial: 'vial',
  ampoule: 'vial',
  tin: 'tin',
  box: 'box',
};

/**
 * Unit of sale. Unlike dispensing class, a wrong guess here is cosmetic, so an
 * unknown or absent value falls back to 'piece' rather than failing the sync.
 */
export function toUnitLabel(wireValue: string | null | undefined): UnitLabel {
  if (!wireValue) return 'piece';
  return UNIT_BY_WIRE_VALUE[wireValue.trim().toLowerCase()] ?? 'piece';
}

/** Fractional rate (0.16) to basis points (1600). Exact, unlike a float percent. */
export function toVatBasisPoints(rate: number | null | undefined): number {
  if (rate === null || rate === undefined) return 0;
  return Math.round(rate * 10_000);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, 80);
}

export function toProduct(wire: JulebProduct, operation = 'listProducts'): Product {
  return {
    id: wire.id,
    julebProductId: wire.id,
    slug: slugify(`${wire.name} ${wire.strength ?? ''}`) || wire.id,
    name: wire.name,
    genericName: wire.generic_name ?? null,
    brand: wire.brand
      ? { id: wire.brand.id, slug: slugify(wire.brand.name), name: wire.brand.name }
      : null,
    form: wire.form ?? null,
    strength: wire.strength ?? null,
    packSize: wire.pack_size ?? null,
    unitLabel: toUnitLabel(wire.unit_of_sale),
    dispensing: toDispensingClass(wire.dispensing_class, operation),
    price: toMoney(wire.price, operation),
    compareAtPrice: wire.compare_at_price ? toMoney(wire.compare_at_price, operation) : null,
    vatRateBasisPoints: toVatBasisPoints(wire.vat_rate),
    imageUrl: wire.image_url ?? null,
    categoryIds: wire.category_ids ?? [],
    conditionIds: wire.condition_ids ?? [],
    isActive: wire.is_active ?? true,
  };
}

export function toBranch(wire: JulebBranch): Branch {
  return {
    id: wire.id,
    julebBranchId: wire.id,
    name: wire.name,
    county: wire.county ?? null,
    ppbLicenceNo: wire.ppb_licence_no ?? null,
    pharmacistInCharge: wire.pharmacist_in_charge ?? null,
    isActive: wire.is_active ?? true,
  };
}

export function toStockLevel(wire: JulebStockLevel, operation = 'getStock'): StockLevel {
  const syncedAt = new Date(wire.as_of);
  if (Number.isNaN(syncedAt.getTime())) {
    throw new JulebSchemaError(operation, `as_of "${wire.as_of}" is not a parsable timestamp`);
  }
  return {
    branchId: wire.branch_id,
    productId: wire.product_id,
    quantityAvailable: wire.quantity_available,
    syncedAt,
  };
}
