const LOCALE = 'en-US';

/** Formats a count with its noun: "1 transaction", "1,204 transactions". */
export function formatCount(
  count: number,
  noun: string,
  pluralNoun: string = `${noun}s`,
): string {
  return `${count.toLocaleString(LOCALE)} ${count === 1 ? noun : pluralNoun}`;
}
