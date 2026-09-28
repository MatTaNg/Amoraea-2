import { describe, expect, it } from '@jest/globals';
import {
  cmToFtIn,
  ftInToCm,
  kgToLb,
  lbToKg,
  normalizeFtInParts,
  parseStoredHeightCm,
  parseStoredWeightKg,
  validateHeightCm,
  validateWeightKg,
} from '../unitConversions';

describe('unitConversions', () => {
  it('converts cm to ft/in and back', () => {
    expect(cmToFtIn(178)).toEqual({ feet: 5, inches: 10 });
    expect(ftInToCm(5, 10)).toBe(178);
  });

  it('converts lb and kg', () => {
    expect(lbToKg(165)).toBeCloseTo(74.8, 1);
    expect(kgToLb(75)).toBeCloseTo(165.3, 1);
  });

  it('rolls inches into feet at 12', () => {
    expect(normalizeFtInParts('5', '13')).toEqual({
      feet: 6,
      inches: 1,
      feetText: '6',
      inchesText: '1',
    });
  });

  it('validates canonical metric bounds', () => {
    expect(validateHeightCm(90)).toMatch(/height/i);
    expect(validateHeightCm(178)).toBeUndefined();
    expect(validateWeightKg(26)).toMatch(/weight/i);
    expect(validateWeightKg(75)).toBeUndefined();
  });

  it('parses stored profile height and weight shapes', () => {
    expect(parseStoredHeightCm({ height_cm: 172 })).toBe(172);
    expect(parseStoredHeightCm({ heightLabel: '178 cm' })).toBe(178);
    expect(parseStoredWeightKg({ weight_kg: 74.5 })).toBe(74.5);
    expect(parseStoredWeightKg({ weightLabel: '165 lb' })).toBeCloseTo(74.8, 1);
  });
});
