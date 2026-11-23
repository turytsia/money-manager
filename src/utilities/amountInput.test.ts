import { describe, expect, it } from 'vitest';
import {
  applyKey,
  formatAmountText,
  parseAmountText,
  toAmountText,
  type KeypadKey,
} from './amountInput';

describe('amountInput', () => {
  it.each<[Array<KeypadKey>, string]>([
    [['1', '2', '.', '5'], '12.5'],
    [['.'], '0.'],
    [['.', '0', '5'], '0.05'],
    [['0', '5'], '5'],
    [['0', '0'], '0'],
    [['1', '.', '.', '2'], '1.2'],
    [['1', '.', '2', '3', '4'], '1.23'],
    [['1', '2', 'backspace'], '1'],
    [['backspace'], ''],
    [['1', '2', '3', '4', '5', '6', '7', '8'], '1234567'],
  ])('should turn the keys %j into "%s"', (keys, expected) => {
    expect(typeKeys(keys)).toBe(expected);
  });

  it.each([
    ['', 0],
    ['12', 1200],
    ['12.', 1200],
    ['12.5', 1250],
    ['0.05', 5],
    ['9999999.99', 999999999],
  ])('should read "%s" as %i minor units', (text, expected) => {
    expect(parseAmountText(text)).toBe(expected);
  });

  it.each([
    [0, ''],
    [1200, '12'],
    [1250, '12.50'],
    [5, '0.05'],
  ])('should turn %i minor units into the text "%s"', (amount, expected) => {
    expect(toAmountText(amount)).toBe(expected);
  });

  it.each([
    ['', '0'],
    ['12.', '12.'],
    ['1234.5', '1,234.5'],
    ['1234567', '1,234,567'],
  ])('should display "%s" as "%s"', (text, expected) => {
    expect(formatAmountText(text)).toBe(expected);
  });
});

function typeKeys(keys: Array<KeypadKey>): string {
  return keys.reduce(applyKey, '');
}
