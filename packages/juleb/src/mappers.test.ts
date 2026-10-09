import { describe, expect, it } from 'vitest';

import { JulebSchemaError } from './errors';
import {
  decimalStringToMinor,
  slugify,
  toDispensingClass,
  toMoney,
  toUnitLabel,
  toVatBasisPoints,
} from './mappers';

describe('decimalStringToMinor', () => {
  it('converts whole and fractional amounts exactly', () => {
    expect(decimalStringToMinor('450', 'test')).toBe(45000);
    expect(decimalStringToMinor('450.00', 'test')).toBe(45000);
    expect(decimalStringToMinor('890.50', 'test')).toBe(89050);
    expect(decimalStringToMinor('0.01', 'test')).toBe(1);
  });

  it('avoids the float error that a parse-and-multiply would introduce', () => {
    // 19.99 * 100 is 1998.9999999999998 in binary floating point.
    expect(decimalStringToMinor('19.99', 'test')).toBe(1999);
    expect(decimalStringToMinor('1.005', 'test')).toBe(101); // half-up on the 3rd digit
    expect(decimalStringToMinor('1.004', 'test')).toBe(100);
  });

  it('handles negatives, for credits and refunds', () => {
    expect(decimalStringToMinor('-450.00', 'test')).toBe(-45000);
  });

  it('rejects anything that is not a decimal amount', () => {
    for (const bad of ['', 'abc', '1,795.00', '1.2.3', 'NaN', '1e5']) {
      expect(() => decimalStringToMinor(bad, 'test')).toThrow(JulebSchemaError);
    }
  });
});

describe('toMoney', () => {
  it('maps a KES amount', () => {
    expect(toMoney({ amount: '1795.00', currency: 'KES' }, 'test')).toStrictEqual({
      minor: 179500,
      currency: 'KES',
    });
  });

  it('refuses a non-KES currency rather than mislabelling it', () => {
    expect(() => toMoney({ amount: '10.00', currency: 'SAR' }, 'test')).toThrow(JulebSchemaError);
    expect(() => toMoney({ amount: '10.00', currency: 'USD' }, 'test')).toThrow(/expected KES/);
  });
});

/**
 * The most important tests in this package.
 *
 * Misclassifying a prescription-only medicine as over-the-counter would let it be
 * sold with no pharmacist review, defeating §3.2 at the one point where nothing
 * downstream can catch it.
 */
describe('toDispensingClass', () => {
  it('accepts the OTC vocabulary variants', () => {
    for (const value of ['OTC', 'otc', 'over_the_counter', 'GSL', 'P']) {
      expect(toDispensingClass(value, 'test')).toBe('otc');
    }
  });

  it('accepts the prescription-only variants', () => {
    for (const value of ['POM', 'pom', 'Rx', 'prescription', 'prescription_only']) {
      expect(toDispensingClass(value, 'test')).toBe('pom');
    }
  });

  it('accepts the controlled-substance variants', () => {
    for (const value of ['controlled', 'CD', 'narcotic', 'psychotropic']) {
      expect(toDispensingClass(value, 'test')).toBe('controlled');
    }
  });

  it('normalises spacing, case and hyphens', () => {
    expect(toDispensingClass('Prescription Only', 'test')).toBe('pom');
    expect(toDispensingClass('over-the-counter', 'test')).toBe('otc');
    expect(toDispensingClass('  POM  ', 'test')).toBe('pom');
  });

  // This is the behaviour that matters most: fail the sync, never guess.
  it('throws on an unknown value instead of defaulting to over-the-counter', () => {
    expect(() => toDispensingClass('schedule-4', 'test')).toThrow(JulebSchemaError);
    expect(() => toDispensingClass('', 'test')).toThrow(JulebSchemaError);
    expect(() => toDispensingClass('unknown', 'test')).toThrow(JulebSchemaError);
  });

  it('explains why it refused, so the fix is obvious', () => {
    expect(() => toDispensingClass('schedule-4', 'test')).toThrow(/bypass pharmacist review/);
  });
});

describe('toUnitLabel', () => {
  it('maps known units', () => {
    expect(toUnitLabel('bottles')).toBe('bottle');
    expect(toUnitLabel('Packet')).toBe('pack');
    expect(toUnitLabel('tablet')).toBe('piece');
  });

  // Unlike dispensing class, a wrong unit is cosmetic, so a default is acceptable.
  it('falls back to piece for unknown or absent values', () => {
    expect(toUnitLabel(null)).toBe('piece');
    expect(toUnitLabel(undefined)).toBe('piece');
    expect(toUnitLabel('blister-wheel')).toBe('piece');
  });
});

describe('toVatBasisPoints', () => {
  it('converts a fractional rate to exact basis points', () => {
    expect(toVatBasisPoints(0.16)).toBe(1600);
    expect(toVatBasisPoints(0.08)).toBe(800);
  });

  // Most Kenyan pharmaceuticals are exempt or zero-rated, so zero must stay zero.
  it('treats absent as zero-rated', () => {
    expect(toVatBasisPoints(null)).toBe(0);
    expect(toVatBasisPoints(undefined)).toBe(0);
    expect(toVatBasisPoints(0)).toBe(0);
  });
});

describe('slugify', () => {
  it('produces URL-safe slugs', () => {
    expect(slugify('Panadol Extra 500mg/65mg')).toBe('panadol-extra-500mg-65mg');
    expect(slugify('Accu-Chek Active')).toBe('accu-chek-active');
  });

  it('strips accents and trims separators', () => {
    expect(slugify('  Créme  ')).toBe('creme');
    expect(slugify('---x---')).toBe('x');
  });
});
