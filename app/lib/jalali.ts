/**
 * Jalali (Solar Hijri, the Iranian calendar) ↔ Gregorian, without a library. Display only: Fyldo stores Gregorian
 * (`Y-m-d`) and never sends a Jalali date to the server.
 *
 * Leap years follow the 33-year cycle with the break years of Borkowski's arithmetic (the same table the common
 * `jalaali-js` uses), which matches the official calendar for 1178–3177 SH (1799–3798 AD). Days are counted as
 * Julian Day Numbers, so both directions go through one integer.
 */

export interface YMD {
  year: number;
  /** 1–12. */
  month: number;
  /** 1–31. */
  day: number;
}

const div = (a: number, b: number): number => Math.trunc(a / b);
const mod = (a: number, b: number): number => a - Math.trunc(a / b) * b;

/** Years in which the leap pattern of the 33-year cycle shifts. */
const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

/** The Jalali years this module can convert. */
export const JALALI_MIN_YEAR = BREAKS[0] as number;
export const JALALI_MAX_YEAR = (BREAKS[BREAKS.length - 1] as number) - 1;

/** The year's place in the leap cycle (0 = leap), the Gregorian year it starts in and the March day of its Nowruz. */
function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0] as number;
  let jump = 0;
  for (let i = 1; i < BREAKS.length; i += 1) {
    const jm = BREAKS[i] as number;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

/** Gregorian date → Julian Day Number. */
export function gregorianToJdn({ year, month, day }: YMD): number {
  let d = div((year + div(month - 8, 6) + 100100) * 1461, 4) + div(153 * mod(month + 9, 12) + 2, 5) + day - 34840408;
  d = d - div(div(year + 100100 + div(month - 8, 6), 100) * 3, 4) + 752;
  return d;
}

/** Julian Day Number → Gregorian date. */
export function jdnToGregorian(jdn: number): YMD {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const day = div(mod(i, 153), 5) + 1;
  const month = mod(div(i, 153), 12) + 1;
  const year = div(j, 1461) - 100100 + div(8 - month, 6);
  return { year, month, day };
}

/** Jalali date → Julian Day Number. */
export function jalaliToJdn({ year, month, day }: YMD): number {
  const { gy, march } = jalCal(year);
  return gregorianToJdn({ year: gy, month: 3, day: march }) + (month - 1) * 31 - div(month, 7) * (month - 7) + day - 1;
}

/** Julian Day Number → Jalali date. */
export function jdnToJalali(jdn: number): YMD {
  const gy = jdnToGregorian(jdn).year;
  let year = gy - 621;
  const { leap, march } = jalCal(year);
  let k = jdn - gregorianToJdn({ year: gy, month: 3, day: march });
  if (k >= 0) {
    if (k <= 185) return { year, month: 1 + div(k, 31), day: mod(k, 31) + 1 };
    k -= 186;
  } else {
    year -= 1;
    k += 179;
    if (leap === 1) k += 1;
  }
  return { year, month: 7 + div(k, 30), day: mod(k, 30) + 1 };
}

export const toJalali = (date: YMD): YMD => jdnToJalali(gregorianToJdn(date));
export const toGregorian = (date: YMD): YMD => jdnToGregorian(jalaliToJdn(date));

/** A Jalali leap year has 30 days in Esfand (1399, 1403 and 1408 are; 1404 is not). */
export const isJalaliLeapYear = (year: number): boolean => jalCal(year).leap === 0;

export const isGregorianLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** Farvardin–Shahrivar have 31 days, Mehr–Bahman 30, Esfand 29 (30 in a leap year). */
export const jalaliMonthLength = (year: number, month: number): number => (month <= 6 ? 31 : month <= 11 ? 30 : isJalaliLeapYear(year) ? 30 : 29);

export const gregorianMonthLength = (year: number, month: number): number =>
  month === 2 ? (isGregorianLeapYear(year) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
