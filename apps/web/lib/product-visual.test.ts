import { describe, expect, it } from 'vitest';

import { productVisual, type ProductVisual } from '@/lib/product-visual';

/**
 * The illustration has to match the dosage form. Showing a syrup bottle next to a
 * blister of tablets is the kind of small wrongness that erodes trust in a
 * pharmacy, so the mapping is pinned here.
 */
describe('productVisual', () => {
  it('reads the dosage form in preference to the unit of sale', () => {
    // A tablet sold in a box is still a blister, not a carton.
    expect(productVisual({ form: 'tablet', unitLabel: 'box' })).toBe('blister');
    expect(productVisual({ form: 'oral suspension', unitLabel: 'pack' })).toBe('bottle');
  });

  it('maps the solid oral forms to a blister', () => {
    for (const form of ['tablet', 'Tablet', 'capsule', 'caplet']) {
      expect(productVisual({ form, unitLabel: 'pack' })).toBe('blister');
    }
  });

  // Effervescent tablets ship in a tube, which is why this is not just "tablet".
  it('sends effervescent tablets to a tin rather than a blister', () => {
    expect(productVisual({ form: 'effervescent tablet', unitLabel: 'tube' })).toBe('tin');
  });

  it('maps liquids to a bottle', () => {
    for (const form of ['syrup', 'oral suspension', 'solution', 'drops', 'elixir']) {
      expect(productVisual({ form, unitLabel: 'bottle' })).toBe('bottle');
    }
  });

  it('maps topicals to a tube and injectables to a vial', () => {
    expect(productVisual({ form: 'cream', unitLabel: 'tube' })).toBe('tube');
    expect(productVisual({ form: 'ointment', unitLabel: 'tube' })).toBe('tube');
    expect(productVisual({ form: 'injection', unitLabel: 'vial' })).toBe('vial');
  });

  it('maps hardware to the device illustration', () => {
    expect(productVisual({ form: 'device', unitLabel: 'box' })).toBe('device');
    expect(productVisual({ form: 'glucose meter', unitLabel: 'box' })).toBe('device');
  });

  it('falls back to the unit of sale when the form is missing', () => {
    expect(productVisual({ form: null, unitLabel: 'bottle' })).toBe('bottle');
    expect(productVisual({ form: null, unitLabel: 'tube' })).toBe('tube');
    expect(productVisual({ form: null, unitLabel: 'sachet' })).toBe('sachet');
    expect(productVisual({ form: null, unitLabel: 'pack' })).toBe('blister');
  });

  it('always returns a drawable shape, never undefined', () => {
    const drawable: ProductVisual[] = [
      'blister',
      'bottle',
      'tube',
      'sachet',
      'vial',
      'tin',
      'device',
      'box',
    ];
    const units = ['piece', 'pack', 'bottle', 'tube', 'sachet', 'vial', 'tin', 'box'] as const;
    for (const unitLabel of units) {
      for (const form of [null, '', 'something we have never seen']) {
        expect(drawable).toContain(productVisual({ form, unitLabel }));
      }
    }
  });
});
