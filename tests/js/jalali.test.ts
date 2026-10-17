import { afterEach, describe, expect, it } from 'vitest';
import {
  equivalentText,
  formatValue,
  minuteOfDay,
  parseDate,
  readTypedTime,
  resolveBound,
  setClock,
  setDateSettings,
  siteToUtc,
  utcToSite,
  type Moment,
} from '../../app/lib/datetime';
import { isJalaliLeapYear, jalaliMonthLength, toGregorian, toJalali, type YMD } from '../../app/lib/jalali';

const ymd = (text: string): YMD => {
  const [year, month, day] = text.split('-').map(Number) as [number, number, number];
  return { year, month, day };
};
const text = ({ year, month, day }: YMD): string => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const moment = (text: string): Moment => {
  const [date = '', time = ''] = text.split(' ');
  const [hour, minute, second = 0] = time.split(':').map(Number) as [number, number, number?];
  return { ...ymd(date), hour, minute, second };
};
const stamp = (m: Moment): string => `${text(m)} ${String(m.hour).padStart(2, '0')}:${String(m.minute).padStart(2, '0')}`;

afterEach(() => {
  setClock(null);
  setDateSettings({ timezone: 'UTC', startOfWeek: 1, calendar: 'gregorian', locale: 'en' });
});

describe('Jalali ↔ Gregorian', () => {
  // [Jalali, Gregorian]
  const pairs: Array<[string, string]> = [
    ['1405-07-28', '2026-10-20'], // the design's example
    ['1405-01-01', '2026-03-21'], // Nowruz 1405
    ['1404-01-01', '2025-03-21'], // Nowruz 1404
    ['1403-01-01', '2024-03-20'], // Nowruz 1403
    ['1400-01-01', '2021-03-21'],
    ['1399-01-01', '2020-03-20'],
    ['1399-12-30', '2021-03-20'], // the 30th of Esfand: 1399 is a leap year
    ['1403-12-30', '2025-03-20'], // 1403 is a leap year
    ['1404-12-29', '2026-03-20'], // 1404 is not: Esfand ends on the 29th
    ['1408-01-01', '2029-03-20'],
    ['1408-12-30', '2030-03-20'], // 1408 is a leap year (five years after 1403)
    ['1357-11-22', '1979-02-11'],
    ['1300-01-01', '1921-03-21'],
  ];

  it.each(pairs)('%s ↔ %s', (jalali, gregorian) => {
    expect(text(toGregorian(ymd(jalali)))).toBe(gregorian);
    expect(text(toJalali(ymd(gregorian)))).toBe(jalali);
  });

  it('knows the leap years of the 33-year cycle', () => {
    expect([1399, 1403, 1408, 1412].map(isJalaliLeapYear)).toEqual([true, true, true, true]);
    expect([1400, 1401, 1402, 1404, 1405, 1406, 1407].some(isJalaliLeapYear)).toBe(false);
    expect([1, 6, 7, 11, 12].map((m) => jalaliMonthLength(1404, m))).toEqual([31, 31, 30, 30, 29]);
    expect(jalaliMonthLength(1403, 12)).toBe(30);
  });

  it('round-trips every day of four centuries', () => {
    const start = Date.UTC(1900, 0, 1);
    for (let day = 0; day < 146097; day += 1) {
      const d = new Date(start + day * 86400000);
      const g = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
      expect(toGregorian(toJalali(g))).toEqual(g);
    }
  });
});

describe('stored formats', () => {
  it('reads only real Gregorian days', () => {
    expect(parseDate('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
    expect(parseDate('2025-02-29')).toBeNull();
    expect(parseDate('2026-02-30')).toBeNull();
    expect(parseDate('2026-1-05')).toBeNull();
  });

  it('reads a typed time: Persian digits, missing zeros, no colon', () => {
    expect(['۱۴:۳۰', '9:05', '930', '1430', '14.30', ' 07:00 '].map(readTypedTime)).toEqual(['14:30', '09:05', '09:30', '14:30', '14:30', '07:00']);
    expect(readTypedTime('24:00')).toBe('24:00'); // kept: the `time` rule reports it
    expect(readTypedTime('noon')).toBe('noon');
  });
});

describe('the site time zone', () => {
  it('converts site time to UTC and back, also across a DST change (Europe/Berlin)', () => {
    const zone = 'Europe/Berlin';
    expect(stamp(siteToUtc(moment('2026-07-01 12:00'), zone))).toBe('2026-07-01 10:00');
    expect(stamp(siteToUtc(moment('2026-01-15 12:00'), zone))).toBe('2026-01-15 11:00');
    // 29 March: 02:00 CET jumps to 03:00 CEST; 02:30 does not exist and moves forward, as PHP does.
    expect(stamp(siteToUtc(moment('2026-03-29 01:30'), zone))).toBe('2026-03-29 00:30');
    expect(stamp(siteToUtc(moment('2026-03-29 03:30'), zone))).toBe('2026-03-29 01:30');
    expect(stamp(siteToUtc(moment('2026-03-29 02:30'), zone))).toBe('2026-03-29 01:30');
    // 25 October: 02:30 happens twice; the first one is meant.
    expect(stamp(siteToUtc(moment('2026-10-25 02:30'), zone))).toBe('2026-10-25 00:30');
    expect(stamp(utcToSite(moment('2026-10-25 01:30:00'), zone))).toBe('2026-10-25 02:30');
  });

  it('uses a fixed offset when the site is set to "UTC+3:30"', () => {
    expect(stamp(siteToUtc(moment('2026-10-20 14:30'), '+03:30'))).toBe('2026-10-20 11:00');
    expect(stamp(utcToSite(moment('2026-10-20 11:00:00'), '+03:30'))).toBe('2026-10-20 14:30');
    expect(stamp(utcToSite(moment('2026-10-20 11:00:00'), 'Asia/Tehran'))).toBe('2026-10-20 14:30');
  });

  it('resolves today and now on the site clock and counts a datetime step in site time', () => {
    setDateSettings({ timezone: 'Asia/Tehran' });
    setClock(() => new Date('2026-10-19T21:00:30Z'));
    expect(resolveBound('date', 'today')).toBe('2026-10-20');
    expect(resolveBound('datetime', 'now')).toBe('2026-10-19 21:00:00');
    expect(resolveBound('date', '2026-01-01')).toBe('2026-01-01');
    expect(minuteOfDay('datetime', '2026-10-20 11:00:00')).toBe(14 * 60 + 30);
    expect(minuteOfDay('datetime', '2026-10-20 11:00:30')).toBe(-1);
  });
});

describe('what the field shows', () => {
  it('writes the value in its calendar and the other one under it (Figma "Equivalent")', () => {
    expect(formatValue('date', '2026-10-20', 'gregorian', 'en')).toBe('Oct 20, 2026');
    expect(formatValue('date', '2026-10-20', 'jalali', 'en')).toBe('28 Mehr 1405');
    expect(equivalentText('date', '2026-10-20', 'gregorian', 'en')).toBe('28 Mehr 1405 · Jalali');
    expect(equivalentText('date', '2026-10-20', 'jalali', 'en')).toBe('Oct 20, 2026 · Gregorian');
    expect(formatValue('date', '2026-02-30', 'gregorian', 'en')).toBe('');
  });

  it('shows a datetime in the site time zone', () => {
    setDateSettings({ timezone: 'Asia/Tehran' });
    expect(formatValue('datetime', '2026-10-20 11:00:00', 'gregorian', 'en')).toBe('Oct 20, 2026, 14:30');
    expect(equivalentText('datetime', '2026-10-20 11:00:00', 'gregorian', 'en')).toBe('28 Mehr 1405, 14:30 · Jalali');
  });

  it('writes Persian numerals in Persian', () => {
    expect(formatValue('time', '14:30', 'gregorian', 'fa-IR')).toBe('۱۴:۳۰');
    expect(formatValue('date', '2026-10-20', 'jalali', 'fa-IR')).toBe('۲۸ Mehr ۱۴۰۵'); // month names come from the .po
  });
});
