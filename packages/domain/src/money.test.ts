import { describe, expect, it } from 'vitest';

import {
  MoneyError,
  addMoney,
  discountPercent,
  formatMoney,
  money,
  multiplyMoney,
  sumMoney,
  vatFor,
} from './money';

describe('money construction', () => {
  it('requires integer minor units', () => {
    expect(money(45000).minor).toBe(45000);
    expect(() => money(450.5)).toThrow(MoneyError);
  });

  it('refuses values beyond safe integer precision', () => {
    expect(() => money(Number.MAX_SAFE_INTEGER + 2)).toThrow(MoneyError);
  });
});

describe('arithmetic', () => {
  it('adds and multiplies without float drift', () => {
    // Ten lots of 19.99 is exactly 199.90, which a float sum does not guarantee.
    const line = money(1999);
    expect(multiplyMoney(line, 10).minor).toBe(19990);
    expect(sumMoney(Array.from({ length: 10 }, () => line)).minor).toBe(19990);
  });

  it('refuses to combine different currencies', () => {
    const kes = money(100, 'KES');
    const other = { minor: 100, currency: 'USD' } as unknown as typeof kes;
    expect(() => addMoney(kes, other)).toThrow(MoneyError);
  });

  it('refuses a fractional or negative quantity', () => {
    expect(() => multiplyMoney(money(100), 1.5)).toThrow(MoneyError);
    expect(() => multiplyMoney(money(100), -1)).toThrow(MoneyError);
  });
});

describe('vatFor', () => {
  it('computes VAT from basis points', () => {
    expect(vatFor(money(100000), 1600).minor).toBe(16000);
  });

  // Most Kenyan pharmaceuticals are exempt or zero-rated.
  it('returns exactly zero for a zero rate', () => {
    expect(vatFor(money(89050), 0).minor).toBe(0);
  });

  it('rounds half-up to the nearest minor unit', () => {
    expect(vatFor(money(101), 1600).minor).toBe(16); // 16.16 -> 16
    expect(vatFor(money(103), 1600).minor).toBe(16); // 16.48 -> 16
    expect(vatFor(money(104), 1600).minor).toBe(17); // 16.64 -> 17
  });

  it('rejects a negative or fractional rate', () => {
    expect(() => vatFor(money(100), -1)).toThrow(MoneyError);
    expect(() => vatFor(money(100), 16.5)).toThrow(MoneyError);
  });
});

/** Display format follows the Kenyan convention and the MyDawa reference. */
describe('formatMoney', () => {
  it('groups thousands and omits cents for whole shillings', () => {
    expect(formatMoney(money(179500))).toBe('KES 1,795');
    expect(formatMoney(money(45000))).toBe('KES 450');
    expect(formatMoney(money(345000))).toBe('KES 3,450');
  });

  it('shows cents when they are non-zero rather than hiding money', () => {
    expect(formatMoney(money(89050))).toBe('KES 890.50');
    expect(formatMoney(money(1))).toBe('KES 0.01');
  });

  it('formats zero', () => {
    expect(formatMoney(money(0))).toBe('KES 0');
  });
});

describe('discountPercent', () => {
  it('floors the percentage off', () => {
    expect(discountPercent(money(45000), money(60000))).toBe(25);
    expect(discountPercent(money(55000), money(65000))).toBe(15); // 15.38 -> 15
  });

  it('returns null when there is no genuine discount', () => {
    expect(discountPercent(money(45000), null)).toBeNull();
    expect(discountPercent(money(45000), money(45000))).toBeNull();
    expect(discountPercent(money(60000), money(45000))).toBeNull(); // price went up
    expect(discountPercent(money(0), money(0))).toBeNull();
  });
});
