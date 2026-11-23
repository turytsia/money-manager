const LOCALE = 'en-US';

/** Formats a count with its noun: "1 transaction", "1,204 transactions". */
export function formatCount(count: number, noun: string): string {
  return `${count.toLocaleString(LOCALE)} ${noun}${count === 1 ? '' : 's'}`;
}
