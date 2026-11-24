import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  differenceInCalendarYears,
  endOfMonth,
  endOfYear,
  startOfWeek,
} from 'date-fns';
import { Granularity, type DayKey } from './types';

const LOCALE = 'en-US';
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MIN_DAY_KEY = 19700101;
const MAX_DAY_KEY = 99991231;

const DAY_FORMAT = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const DAY_WITH_YEAR_FORMAT = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const SHORT_DAY_FORMAT = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  day: 'numeric',
});
const DATE_TIME_FORMAT = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const MONTH_FORMAT = new Intl.DateTimeFormat(LOCALE, { month: 'long' });
const MONTH_WITH_YEAR_FORMAT = new Intl.DateTimeFormat(LOCALE, {
  month: 'long',
  year: 'numeric',
});
const SHORT_MONTH_FORMAT = new Intl.DateTimeFormat(LOCALE, { month: 'short' });
const SHORT_MONTH_WITH_YEAR_FORMAT = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  year: 'numeric',
});

export function toDayKey(date: Date): DayKey {
  return (
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
  );
}

export function fromDayKey(day: DayKey): Date {
  return new Date(getYear(day), (getMonthKey(day) % 100) - 1, day % 100);
}

export function getToday(): DayKey {
  return toDayKey(new Date());
}

export function isValidDayKey(value: unknown): value is DayKey {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_DAY_KEY &&
    value <= MAX_DAY_KEY &&
    toDayKey(fromDayKey(value)) === value
  );
}

export function toIsoDate(day: DayKey): string {
  const text = String(day);
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

export function parseIsoDate(text: string): DayKey | undefined {
  const match = ISO_DATE_PATTERN.exec(text);
  if (!match) {
    return undefined;
  }
  const day =
    Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3]);
  return isValidDayKey(day) ? day : undefined;
}

/** The month of a day as YYYYMM. */
export function getMonthKey(day: DayKey): number {
  return Math.floor(day / 100);
}

export function shiftDay(day: DayKey, amount: number): DayKey {
  return toDayKey(addDays(fromDayKey(day), amount));
}

/** The first day of the day, week, month or year that contains `day`. */
export function getBucketStart(day: DayKey, granularity: Granularity): DayKey {
  switch (granularity) {
    case Granularity.Day:
      return day;
    case Granularity.Week:
      return toDayKey(startOfWeek(fromDayKey(day), WEEK_OPTIONS));
    case Granularity.Month:
      return getMonthKey(day) * 100 + 1;
    case Granularity.Year:
      return getYear(day) * 10000 + 101;
  }
}

export function getBucketEnd(start: DayKey, granularity: Granularity): DayKey {
  switch (granularity) {
    case Granularity.Day:
      return start;
    case Granularity.Week:
      return shiftDay(start, 6);
    case Granularity.Month:
      return toDayKey(endOfMonth(fromDayKey(start)));
    case Granularity.Year:
      return toDayKey(endOfYear(fromDayKey(start)));
  }
}

export function shiftBucket(
  start: DayKey,
  granularity: Granularity,
  amount: number,
): DayKey {
  const date = fromDayKey(start);
  switch (granularity) {
    case Granularity.Day:
      return toDayKey(addDays(date, amount));
    case Granularity.Week:
      return toDayKey(addWeeks(date, amount));
    case Granularity.Month:
      return toDayKey(addMonths(date, amount));
    case Granularity.Year:
      return toDayKey(addYears(date, amount));
  }
}

/** How many buckets `to` is after `from` (negative when it is before). */
export function countBucketsBetween(
  from: DayKey,
  to: DayKey,
  granularity: Granularity,
): number {
  const fromDate = fromDayKey(from);
  const toDate = fromDayKey(to);
  switch (granularity) {
    case Granularity.Day:
      return differenceInCalendarDays(toDate, fromDate);
    case Granularity.Week:
      return differenceInCalendarWeeks(toDate, fromDate, WEEK_OPTIONS);
    case Granularity.Month:
      return differenceInCalendarMonths(toDate, fromDate);
    case Granularity.Year:
      return differenceInCalendarYears(toDate, fromDate);
  }
}

export function formatDay(day: DayKey, today: DayKey): string {
  if (day === today) {
    return 'Today';
  }
  if (day === shiftDay(today, -1)) {
    return 'Yesterday';
  }
  const format =
    getYear(day) === getYear(today) ? DAY_FORMAT : DAY_WITH_YEAR_FORMAT;
  return format.format(fromDayKey(day));
}

export function formatShortDay(day: DayKey): string {
  return SHORT_DAY_FORMAT.format(fromDayKey(day));
}

/** A moment in time, for example "Nov 24, 2:32 PM". */
export function formatDateTime(timestamp: number): string {
  return DATE_TIME_FORMAT.format(timestamp);
}

export function formatMonth(day: DayKey): string {
  return MONTH_FORMAT.format(fromDayKey(day));
}

export function formatBucket(
  start: DayKey,
  granularity: Granularity,
  today: DayKey,
): string {
  switch (granularity) {
    case Granularity.Day:
      return formatDay(start, today);
    case Granularity.Week:
      return DAY_WITH_YEAR_FORMAT.formatRange(
        fromDayKey(start),
        fromDayKey(shiftDay(start, 6)),
      );
    case Granularity.Month:
      return MONTH_WITH_YEAR_FORMAT.format(fromDayKey(start));
    case Granularity.Year:
      return String(getYear(start));
  }
}

/** A short label for one bucket on a chart axis. */
export function formatBucketTick(
  start: DayKey,
  granularity: Granularity,
): string {
  switch (granularity) {
    case Granularity.Day:
    case Granularity.Week:
      return String(start % 100);
    case Granularity.Month:
      return SHORT_MONTH_FORMAT.format(fromDayKey(start));
    case Granularity.Year:
      return String(getYear(start));
  }
}

/** The period covered by a run of buckets, from the first to the last. */
export function formatBucketRange(
  firstStart: DayKey,
  lastStart: DayKey,
  granularity: Granularity,
): string {
  const from = fromDayKey(firstStart);
  switch (granularity) {
    case Granularity.Day:
    case Granularity.Week:
      return DAY_WITH_YEAR_FORMAT.formatRange(
        from,
        fromDayKey(getBucketEnd(lastStart, granularity)),
      );
    case Granularity.Month:
      return SHORT_MONTH_WITH_YEAR_FORMAT.formatRange(
        from,
        fromDayKey(lastStart),
      );
    case Granularity.Year:
      return `${getYear(firstStart)} – ${getYear(lastStart)}`;
  }
}

function getYear(day: DayKey): number {
  return Math.floor(day / 10000);
}
