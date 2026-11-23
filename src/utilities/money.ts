const LOCALE = 'en-US';

export const MINOR_UNITS = 100;

/** The largest amount the keypad can enter: 9,999,999.99. */
export const MAX_AMOUNT = 999_999_999;

export const DEFAULT_CURRENCY = 'USD';

// Every currency here uses two decimals, which is how amounts are stored.
export const CURRENCIES = [
  { code: 'USD', label: 'US dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British pound' },
  { code: 'CZK', label: 'Czech koruna' },
  { code: 'PLN', label: 'Polish złoty' },
  { code: 'UAH', label: 'Ukrainian hryvnia' },
  { code: 'CHF', label: 'Swiss franc' },
  { code: 'SEK', label: 'Swedish krona' },
  { code: 'NOK', label: 'Norwegian krone' },
  { code: 'DKK', label: 'Danish krone' },
  { code: 'CAD', label: 'Canadian dollar' },
  { code: 'AUD', label: 'Australian dollar' },
] as const;

const CURRENCY_CODES: ReadonlySet<string> = new Set(
  CURRENCIES.map(({ code }) => code),
);

const EURO_REGIONS: ReadonlySet<string> = new Set([
  'AT',
  'BE',
  'BG',
  'CY',
  'DE',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PT',
  'SI',
  'SK',
]);

const CURRENCY_BY_REGION: Readonly<Record<string, string>> = {
  US: 'USD',
  GB: 'GBP',
  CZ: 'CZK',
  PL: 'PLN',
  UA: 'UAH',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  CA: 'CAD',
  AU: 'AUD',
};

const FORMATTERS = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number, currency: string): string {
  return getFormatter(currency, false).format(amount / MINOR_UNITS);
}

/** A short form for tight spaces such as chart axes: $1.2K. */
export function formatMoneyCompact(amount: number, currency: string): string {
  return getFormatter(currency, true).format(amount / MINOR_UNITS);
}

export function getCurrencySymbol(currency: string): string {
  const parts = getFormatter(currency, false).formatToParts(0);
  return parts.find(({ type }) => type === 'currency')?.value ?? currency;
}

export function isSupportedCurrency(value: unknown): value is string {
  return typeof value === 'string' && CURRENCY_CODES.has(value);
}

export function guessCurrency(locale: string): string {
  const region = getRegion(locale);
  if (region === undefined) {
    return DEFAULT_CURRENCY;
  }
  if (EURO_REGIONS.has(region)) {
    return 'EUR';
  }
  return CURRENCY_BY_REGION[region] ?? DEFAULT_CURRENCY;
}

function getFormatter(currency: string, isCompact: boolean): Intl.NumberFormat {
  const key = `${currency}:${isCompact}`;
  const cached = FORMATTERS.get(key);
  if (cached) {
    return cached;
  }
  const formatter = new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    ...(isCompact
      ? { notation: 'compact', maximumFractionDigits: 1 }
      : { trailingZeroDisplay: 'stripIfInteger' }),
  });
  FORMATTERS.set(key, formatter);
  return formatter;
}

function getRegion(locale: string): string | undefined {
  try {
    return new Intl.Locale(locale).maximize().region;
  } catch {
    return undefined;
  }
}
