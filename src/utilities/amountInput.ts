import { MINOR_UNITS } from './money';

export const BACKSPACE_KEY = 'backspace';
export const DECIMAL_KEY = '.';

export const KEYPAD_KEYS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  DECIMAL_KEY,
  '0',
  BACKSPACE_KEY,
] as const;

const MAX_INTEGER_DIGITS = 7;
const MAX_FRACTION_DIGITS = 2;

export type KeypadKey = (typeof KEYPAD_KEYS)[number];

/**
 * The amount being typed is kept as plain text such as "12.5", so the
 * display can show exactly what was entered, including a trailing dot.
 */
export function applyKey(text: string, key: KeypadKey): string {
  if (key === BACKSPACE_KEY) {
    return text.slice(0, -1);
  }
  const [integer = '', fraction] = text.split(DECIMAL_KEY);
  if (key === DECIMAL_KEY) {
    return fraction === undefined ? `${integer || '0'}${DECIMAL_KEY}` : text;
  }
  if (fraction !== undefined) {
    return fraction.length < MAX_FRACTION_DIGITS ? text + key : text;
  }
  if (integer === '' || integer === '0') {
    return key;
  }
  return integer.length < MAX_INTEGER_DIGITS ? text + key : text;
}

export function isKeypadKey(value: string): value is KeypadKey {
  return (KEYPAD_KEYS as ReadonlyArray<string>).includes(value);
}

/** Converts typed text to minor units: "12.5" becomes 1250. */
export function parseAmountText(text: string): number {
  const [integer = '', fraction = ''] = text.split(DECIMAL_KEY);
  return (
    Number(integer) * MINOR_UNITS +
    Number(fraction.padEnd(MAX_FRACTION_DIGITS, '0'))
  );
}

/** Converts minor units back to editable text: 1250 becomes "12.50". */
export function toAmountText(amount: number): string {
  const integer = Math.floor(amount / MINOR_UNITS);
  const fraction = amount % MINOR_UNITS;
  if (fraction === 0) {
    return integer === 0 ? '' : String(integer);
  }
  return `${integer}${DECIMAL_KEY}${String(fraction).padStart(MAX_FRACTION_DIGITS, '0')}`;
}

/** Adds thousands separators for display: "1234.5" becomes "1,234.5". */
export function formatAmountText(text: string): string {
  if (text === '') {
    return '0';
  }
  const [integer = '0', fraction] = text.split(DECIMAL_KEY);
  const grouped = Number(integer).toLocaleString('en-US');
  return fraction === undefined
    ? grouped
    : `${grouped}${DECIMAL_KEY}${fraction}`;
}
