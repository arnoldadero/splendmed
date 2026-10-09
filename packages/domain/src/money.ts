/**
 * Money is always integer minor units plus a currency code (§4). Never a float:
 * 0.1 + 0.2 is not 0.3, and a pharmacy basket is a sum of many small numbers.
 */

export const SUPPORTED_CURRENCIES = ['KES'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export interface Money {
  /** Integer minor units. For KES, cents. */
  readonly minor: number;
  readonly currency: Currency;
}

export class MoneyError extends Error {}

export function money(minor: number, currency: Currency = 'KES'): Money {
  if (!Number.isInteger(minor)) {
    throw new MoneyError(`Money must be integer minor units, received ${minor}`);
  }
  if (!Number.isSafeInteger(minor)) {
    throw new MoneyError(`Money exceeds safe integer range: ${minor}`);
  }
  return { minor, currency };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`Cannot combine ${a.currency} with ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor + b.minor, a.currency);
}

export function multiplyMoney(a: Money, quantity: number): Money {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new MoneyError(`Quantity must be a non-negative integer, received ${quantity}`);
  }
  return money(a.minor * quantity, a.currency);
}

export function sumMoney(amounts: readonly Money[], currency: Currency = 'KES'): Money {
  return amounts.reduce(addMoney, money(0, currency));
}

/**
 * VAT from a basis-points rate, rounded half-up to the nearest minor unit.
 *
 * Basis points, not a float percentage: 16% is 1600, which is exact. Storing
 * 0.16 and multiplying reintroduces the rounding error that minor units exist to
 * avoid. Most pharmaceuticals in Kenya are VAT-exempt or zero-rated, so a 0 rate
 * is the common case and must stay exactly 0.
 */
export function vatFor(amount: Money, rateBasisPoints: number): Money {
  if (!Number.isInteger(rateBasisPoints) || rateBasisPoints < 0) {
    throw new MoneyError(`VAT rate must be non-negative basis points, received ${rateBasisPoints}`);
  }
  return money(Math.round((amount.minor * rateBasisPoints) / 10_000), amount.currency);
}

/**
 * Formats for display: "KES 1,795".
 *
 * Kenyan convention omits cents — the smallest circulating coin is KES 1 — so a
 * whole-shilling amount renders without decimals. A fractional amount still shows
 * them rather than silently hiding money.
 */
export function formatMoney(amount: Money): string {
  const whole = Math.trunc(amount.minor / 100);
  const cents = Math.abs(amount.minor % 100);
  const grouped = whole.toLocaleString('en-KE');
  return cents === 0
    ? `${amount.currency} ${grouped}`
    : `${amount.currency} ${grouped}.${String(cents).padStart(2, '0')}`;
}

/** Discount percentage for a struck-through price, floored. Null when not on offer. */
export function discountPercent(current: Money, compareAt: Money | null): number | null {
  if (!compareAt) return null;
  assertSameCurrency(current, compareAt);
  if (compareAt.minor <= current.minor || compareAt.minor <= 0) return null;
  return Math.floor(((compareAt.minor - current.minor) / compareAt.minor) * 100);
}
