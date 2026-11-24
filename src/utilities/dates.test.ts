import { describe, expect, it } from 'vitest';
import {
  countBucketsBetween,
  formatBucket,
  formatDay,
  fromDayKey,
  getBucketEnd,
  getBucketStart,
  isValidDayKey,
  parseIsoDate,
  shiftBucket,
  toDayKey,
  toIsoDate,
} from './dates';
import { Granularity } from './types';

// 23 November 2026 is a Monday.
describe('dates', () => {
  it('should pack a date as YYYYMMDD and unpack it again', () => {
    expect(toDayKey(new Date(2026, 10, 23))).toBe(20261123);
    expect(fromDayKey(20261123)).toEqual(new Date(2026, 10, 23));
  });

  it.each([
    [20240229, true],
    [20260229, false],
    [20261301, false],
    [2026.5, false],
    ['20261123', false],
  ])('should say whether %s is a real calendar day', (value, expected) => {
    expect(isValidDayKey(value)).toBe(expected);
  });

  it('should convert to and from ISO dates', () => {
    expect(toIsoDate(20260105)).toBe('2026-01-05');
    expect(parseIsoDate('2026-01-05')).toBe(20260105);
  });

  it.each(['2026-02-30', '2026-1-5', 'yesterday', ''])(
    'should not parse "%s" as a date',
    (text) => {
      expect(parseIsoDate(text)).toBeUndefined();
    },
  );

  it.each([
    [Granularity.Day, 20261125, 20261125],
    [Granularity.Week, 20261125, 20261123],
    [Granularity.Week, 20261129, 20261123],
    [Granularity.Week, 20261130, 20261130],
    [Granularity.Week, 20270101, 20261228],
    [Granularity.Month, 20261125, 20261101],
    [Granularity.Year, 20261125, 20260101],
  ])('should start the %s of %i on %i', (granularity, day, expected) => {
    expect(getBucketStart(day, granularity)).toBe(expected);
  });

  it.each([
    [Granularity.Day, 20261123, 20261123],
    [Granularity.Week, 20261123, 20261129],
    [Granularity.Month, 20240201, 20240229],
    [Granularity.Year, 20260101, 20261231],
  ])(
    'should end the %s that starts on %i on %i',
    (granularity, start, expected) => {
      expect(getBucketEnd(start, granularity)).toBe(expected);
    },
  );

  it.each([
    [Granularity.Day, 20261231, 1, 20270101],
    [Granularity.Week, 20261228, 1, 20270104],
    [Granularity.Month, 20261201, 1, 20270101],
    [Granularity.Month, 20260301, -1, 20260201],
    [Granularity.Year, 20260101, -2, 20240101],
  ])(
    'should move a %s starting %i by %i to %i',
    (granularity, start, amount, expected) => {
      expect(shiftBucket(start, granularity, amount)).toBe(expected);
    },
  );

  it.each([
    [Granularity.Day, 20261120, 20261123, 3],
    [Granularity.Week, 20261123, 20261207, 2],
    [Granularity.Month, 20261101, 20270201, 3],
    [Granularity.Year, 20260101, 20240101, -2],
  ])(
    'should count %s buckets from %i to %i as %i',
    (granularity, from, to, expected) => {
      expect(countBucketsBetween(from, to, granularity)).toBe(expected);
    },
  );

  it('should name recent days in words and other days by date', () => {
    expect(formatDay(20261123, 20261123)).toBe('Today');
    expect(formatDay(20261122, 20261123)).toBe('Yesterday');
    expect(formatDay(20261121, 20261123)).toBe('Sat, Nov 21');
    expect(formatDay(20251231, 20261123)).toBe('Dec 31, 2025');
  });

  it('should name a period by how it is grouped', () => {
    expect(formatBucket(20261123, Granularity.Day, 20261123)).toBe('Today');
    expect(formatBucket(20261123, Granularity.Week, 20261123)).toMatch(
      /^Nov 23\s–\s29, 2026$/,
    );
    expect(formatBucket(20261101, Granularity.Month, 20261123)).toBe(
      'November 2026',
    );
    expect(formatBucket(20260101, Granularity.Year, 20261123)).toBe('2026');
  });
});
