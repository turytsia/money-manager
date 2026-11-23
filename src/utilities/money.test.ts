import { describe, expect, it } from 'vitest';
import {
  formatMoney,
  formatMoneyCompact,
  getCurrencySymbol,
  guessCurrency,
  isSupportedCurrency,
} from './money';

describe('money', () => {
  it.each([
    [1250, 'USD', '$12.50'],
    [1200, 'USD', '$12'],
    [123456, 'USD', '$1,234.56'],
    [5, 'EUR', '€0.05'],
    [0, 'GBP', '£0'],
  ])(
    'should format %i minor units of %s as %s',
    (amount, currency, expected) => {
      expect(formatMoney(amount, currency)).toBe(expected);
    },
  );

  it.each([
    [20000, '$200'],
    [150000, '$1.5K'],
    [250000000, '$2.5M'],
  ])('should shorten %i minor units to %s', (amount, expected) => {
    expect(formatMoneyCompact(amount, 'USD')).toBe(expected);
  });

  it('should find the symbol of a currency', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('CZK')).toBe('Kč');
  });

  it.each([
    ['en-US', 'USD'],
    ['en', 'USD'],
    ['cs-CZ', 'CZK'],
    ['uk-UA', 'UAH'],
    ['de-DE', 'EUR'],
    ['ja-JP', 'USD'],
    ['not a locale', 'USD'],
  ])('should guess the currency of "%s" as %s', (locale, expected) => {
    expect(guessCurrency(locale)).toBe(expected);
  });

  it('should only accept currencies the app offers', () => {
    expect(isSupportedCurrency('EUR')).toBe(true);
    expect(isSupportedCurrency('JPY')).toBe(false);
    expect(isSupportedCurrency(undefined)).toBe(false);
  });
});
