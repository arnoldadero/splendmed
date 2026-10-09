import type { Money } from './money';

/**
 * SplendMed's own catalog shapes. Juleb's wire format never appears here — the
 * mapper in packages/juleb converts into these (§8.3), so an upstream schema
 * change is a one-file edit rather than a refactor.
 */

/**
 * Regulatory classification. Drives the §3.2 safety gate, so it is a closed union
 * rather than a boolean: "controlled" needs a stricter path than ordinary POM, and
 * collapsing them loses that.
 */
export type DispensingClass = 'otc' | 'pom' | 'controlled';

export function requiresPrescription(dispensing: DispensingClass): boolean {
  return dispensing !== 'otc';
}

/**
 * Unit of sale, shown as a price suffix. Pharmacy items are sold in very
 * different units and omitting it causes genuine confusion about what the price
 * buys. See docs/product/ux-reference-mydawa.md.
 */
export type UnitLabel =
  | 'piece'
  | 'pack'
  | 'bottle'
  | 'tube'
  | 'sachet'
  | 'vial'
  | 'tin'
  | 'box';

export interface Brand {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
}

export interface Category {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly parentId: string | null;
}

/**
 * A health condition, the second navigation axis ("shop by condition"). Separate
 * from categories because it is a different relation: one product treats many
 * conditions and one condition spans many categories.
 */
export interface HealthCondition {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
}

export interface Product {
  readonly id: string;
  /** Stable external key in Juleb. Null for a locally-created product. */
  readonly julebProductId: string | null;
  readonly slug: string;
  readonly name: string;
  /** Patients search by either brand or generic name, so both are first-class. */
  readonly genericName: string | null;
  readonly brand: Brand | null;
  readonly form: string | null;
  readonly strength: string | null;
  readonly packSize: string | null;
  readonly unitLabel: UnitLabel;
  readonly dispensing: DispensingClass;
  readonly price: Money;
  /** Pre-offer price for a struck-through display. Null when not discounted. */
  readonly compareAtPrice: Money | null;
  readonly vatRateBasisPoints: number;
  readonly imageUrl: string | null;
  readonly categoryIds: readonly string[];
  readonly conditionIds: readonly string[];
  readonly isActive: boolean;
}

export interface Branch {
  readonly id: string;
  readonly julebBranchId: string | null;
  readonly name: string;
  readonly county: string | null;
  /** Pharmacy and Poisons Board licence. Surfaced in the UI (§11). */
  readonly ppbLicenceNo: string | null;
  readonly pharmacistInCharge: string | null;
  readonly isActive: boolean;
}

/**
 * Availability, deliberately not a raw number in the UI.
 *
 * Stock is a stale projection of Juleb (§3.7). Presenting "7 left" implies a
 * precision we do not have, so the domain exposes a band and re-validates the
 * exact figure at checkout.
 */
export type Availability = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface StockLevel {
  readonly branchId: string;
  readonly productId: string;
  readonly quantityAvailable: number;
  readonly syncedAt: Date;
}

export const LOW_STOCK_THRESHOLD = 5;

export function availabilityOf(level: Pick<StockLevel, 'quantityAvailable'>): Availability {
  if (level.quantityAvailable <= 0) return 'out_of_stock';
  if (level.quantityAvailable <= LOW_STOCK_THRESHOLD) return 'low_stock';
  return 'in_stock';
}
