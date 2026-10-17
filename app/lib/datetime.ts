/**
 * The `date`, `time` and `datetime` fields' values: parsing, the site's time zone (UTC ↔ site time), the bounds `today` /
 * `now`, and the text the field shows in the Jalali or the Gregorian calendar. Mirror of src/Support/Dates.php.
 *
 * What is stored is always Gregorian: a date `Y-m-d`, a time `H:i` (24-hour), a datetime `Y-m-d H:i:s` in UTC (like
 * `post_date_gmt`), nothing = ''. Jalali is only drawn; it never leaves the browser. A range field stores two of them,
 * `{ start, end }`; its duration line and its end picker's `min` are at the end of this file.
 */
import { __, _n, _x, localizeDigits, sprintf } from '../i18n';
import { toAsciiDigits } from './digits';
import { gregorianMonthLength, gregorianToJdn, jalaliToJdn, jdnToGregorian, jdnToJalali, type YMD } from './jalali';

export type CalendarKind = 'jalali' | 'gregorian';
export type MomentKind = 'date' | 'time' | 'datetime';

export interface DateSettings {
  /** The site's time zone as `wp_timezone_string()` gives it: an IANA name (`Asia/Tehran`) or a fixed offset (`+03:30`). */
  timezone: string;
  /** WordPress "Week starts on": 0 = Sunday … 6 = Saturday. Jalali weeks always start on Saturday. */
  startOfWeek: number;
  /** What `calendar: 'auto'` shows first: Jalali on a site whose locale starts with "fa", Gregorian elsewhere. */
  calendar: CalendarKind;
  /** The page's locale: messages write a bound in its numerals. */
  locale: string;
}

let settings: DateSettings = { timezone: 'UTC', startOfWeek: 1, calendar: 'gregorian', locale: 'en' };
let clock: () => Date = () => new Date();

/** From the boot config (src/Assets/ClientConfig.php `dates`). */
export function setDateSettings(next: Partial<DateSettings>): void {
  settings = { ...settings, ...next };
}

export const dateSettings = (): DateSettings => settings;

/** Tests pin "now"; `null` restores the real clock. */
export function setClock(next: (() => Date) | null): void {
  clock = next ?? (() => new Date());
}

export interface Time {
  hour: number;
  minute: number;
}

export interface Moment extends YMD, Time {
  second: number;
}

const pad = (n: number, size = 2): string => String(n).padStart(size, '0');

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATETIME = /^(\d{4})-(\d{2})-(\d{2}) ([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

/** A real Gregorian day (PHP `checkdate`): no 30 February, 29 February only in a leap year. */
const isDay = (year: number, month: number, day: number): boolean => year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= gregorianMonthLength(year, month);

/** `Y-m-d` → the day, or null when it is not one. */
export function parseDate(text: string): YMD | null {
  const m = DATE.exec(text);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return isDay(year, month, day) ? { year, month, day } : null;
}

/** `H:i` (00:00–23:59) → the time, or null. */
export function parseTime(text: string): Time | null {
  const m = TIME.exec(text);
  return m ? { hour: Number(m[1]), minute: Number(m[2]) } : null;
}

/** `Y-m-d H:i:s` → the moment, or null. */
export function parseDateTime(text: string): Moment | null {
  const m = DATETIME.exec(text);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return isDay(year, month, day) ? { year, month, day, hour: Number(m[4]), minute: Number(m[5]), second: Number(m[6]) } : null;
}

export const formatDate = ({ year, month, day }: YMD): string => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
export const formatTime = ({ hour, minute }: Time): string => `${pad(hour)}:${pad(minute)}`;
export const formatDateTime = (m: Moment): string => `${formatDate(m)} ${formatTime(m)}:${pad(m.second)}`;

/** Whether `value` is a stored value of `kind`. */
export const isValid = (kind: MomentKind, value: string): boolean =>
  (kind === 'date' ? parseDate(value) : kind === 'time' ? parseTime(value) : parseDateTime(value)) !== null;

/**
 * What a typed time becomes: Persian / Arabic digits read as ASCII, `9:5` → `09:05`, `930` → `09:30`, `1430` → `14:30`.
 * Text that cannot be read is kept (trimmed), so the `time` rule can report it.
 */
export function readTypedTime(text: string): string {
  const typed = toAsciiDigits(text).trim();
  const m = /^(\d{1,2})[:.]?(\d{2})$/.exec(typed) ?? /^(\d{1,2}):(\d)$/.exec(typed);
  if (!m) return typed;
  const time = { hour: Number(m[1]), minute: Number(m[2]) };
  return time.hour < 24 && time.minute < 60 ? formatTime(time) : typed;
}

// ── Time zone ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const OFFSET = /^([+-])(\d{2}):?(\d{2})$/;
const formatters = new Map<string, Intl.DateTimeFormat | null>();

function formatterFor(zone: string): Intl.DateTimeFormat | null {
  if (!formatters.has(zone)) {
    try {
      formatters.set(
        zone,
        new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }),
      );
    } catch {
      formatters.set(zone, null); // an unknown zone reads as UTC, like PHP's fallback
    }
  }
  return formatters.get(zone) ?? null;
}

/** Minutes the site's clock is ahead of UTC at the instant `ms`. A fixed offset (`+03:30`) never changes. */
export function offsetAt(zone: string, ms: number): number {
  const fixed = OFFSET.exec(zone);
  if (fixed) return (fixed[1] === '-' ? -1 : 1) * (Number(fixed[2]) * 60 + Number(fixed[3]));
  if (zone === 'UTC' || zone === '') return 0;
  const format = formatterFor(zone);
  if (!format) return 0;
  const at = Math.floor(ms / 1000) * 1000;
  const parts = Object.fromEntries(format.formatToParts(new Date(at)).map((p) => [p.type, p.value]));
  const local = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return Math.round((local - at) / 60000);
}

const msOf = (m: Moment): number => {
  const date = new Date(0);
  date.setUTCFullYear(m.year, m.month - 1, m.day);
  date.setUTCHours(m.hour, m.minute, m.second, 0);
  return date.getTime();
};

const momentOf = (ms: number): Moment => {
  const d = new Date(ms);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds() };
};

/** A UTC moment on the site's clock. */
export const utcToSite = (utc: Moment, zone = settings.timezone): Moment => {
  const ms = msOf(utc);
  return momentOf(ms + offsetAt(zone, ms) * 60000);
};

/**
 * A moment on the site's clock in UTC. Across a daylight-saving change: a time that happens twice is its first
 * occurrence, a time that is skipped moves forward by the gap (as PHP's DateTime does).
 */
export function siteToUtc(local: Moment, zone = settings.timezone): Moment {
  const guess = msOf(local);
  const day = 86400000;
  // The offsets on either side of a change near this moment (the same offset twice on an ordinary day).
  const before = offsetAt(zone, guess - day);
  const after = offsetAt(zone, guess + day);
  const valid = [before, after].map((offset) => guess - offset * 60000).filter((ms, i) => offsetAt(zone, ms) === [before, after][i]);
  return momentOf(valid.length > 0 ? Math.min(...valid) : guess - before * 60000);
}

/** The current instant in UTC. */
export const utcNow = (): Moment => momentOf(clock().getTime());

/** The current moment on the site's clock. */
export const siteNow = (): Moment => utcToSite(utcNow());

/** The time the site's clock shows now, on the step (rounded up, so it is never in the past). */
export function nowOnStep(step: number): Time {
  const now = siteNow();
  const minutes = Math.ceil((now.hour * 60 + now.minute) / step) * step;
  return minutes >= 1440 ? { hour: 23, minute: 60 - step } : { hour: Math.floor(minutes / 60), minute: minutes % 60 };
}

/** `today` (date) and `now` (datetime, to the minute) resolved in the site's time zone; any other bound as it is. */
export function resolveBound(kind: MomentKind, bound: string): string {
  if (kind === 'date' && bound === 'today') return formatDate(siteNow());
  if (kind === 'datetime' && bound === 'now') return formatDateTime({ ...utcNow(), second: 0 });
  return bound;
}

/**
 * The minute of the day the step is counted on: the time itself, or a datetime's site time. -1 when the value has
 * seconds (a step is whole minutes).
 */
export function minuteOfDay(kind: 'time' | 'datetime', value: string): number {
  if (kind === 'time') {
    const time = parseTime(value);
    return time ? time.hour * 60 + time.minute : -1;
  }
  const utc = parseDateTime(value);
  if (!utc || utc.second !== 0) return -1;
  const local = utcToSite(utc);
  return local.hour * 60 + local.minute;
}

// ── Calendars ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The weekday of a Julian Day Number: 0 = Sunday … 6 = Saturday. */
export const weekday = (jdn: number): number => (jdn + 1) % 7;

export const toJdn = (calendar: CalendarKind, date: YMD): number => (calendar === 'jalali' ? jalaliToJdn(date) : gregorianToJdn(date));
export const fromJdn = (calendar: CalendarKind, jdn: number): YMD => (calendar === 'jalali' ? jdnToJalali(jdn) : jdnToGregorian(jdn));

/** The first day of the week the grid starts with: Saturday in Jalali, the site's "Week starts on" in Gregorian. */
export const weekStart = (calendar: CalendarKind): number => (calendar === 'jalali' ? 6 : settings.startOfWeek);

export const otherCalendar = (calendar: CalendarKind): CalendarKind => (calendar === 'jalali' ? 'gregorian' : 'jalali');

/** What a field shows first: the calendar it is locked to, or the site's (`auto`). */
export const initialCalendar = (setting: CalendarKind | 'auto'): CalendarKind => (setting === 'auto' ? settings.calendar : setting);

export function calendarName(calendar: CalendarKind): string {
  return calendar === 'jalali' ? __('Jalali', 'fyldo') : __('Gregorian', 'fyldo');
}

/** Month names, in the words of the page's language (Persian: مهر, اکتبر). */
export function monthName(calendar: CalendarKind, month: number): string {
  if (calendar === 'jalali') {
    return (
      [
        _x('Farvardin', 'Jalali month', 'fyldo'),
        _x('Ordibehesht', 'Jalali month', 'fyldo'),
        _x('Khordad', 'Jalali month', 'fyldo'),
        _x('Tir', 'Jalali month', 'fyldo'),
        _x('Mordad', 'Jalali month', 'fyldo'),
        _x('Shahrivar', 'Jalali month', 'fyldo'),
        _x('Mehr', 'Jalali month', 'fyldo'),
        _x('Aban', 'Jalali month', 'fyldo'),
        _x('Azar', 'Jalali month', 'fyldo'),
        _x('Dey', 'Jalali month', 'fyldo'),
        _x('Bahman', 'Jalali month', 'fyldo'),
        _x('Esfand', 'Jalali month', 'fyldo'),
      ][month - 1] ?? ''
    );
  }
  return (
    [
      _x('January', 'Gregorian month', 'fyldo'),
      _x('February', 'Gregorian month', 'fyldo'),
      _x('March', 'Gregorian month', 'fyldo'),
      _x('April', 'Gregorian month', 'fyldo'),
      _x('May', 'Gregorian month', 'fyldo'),
      _x('June', 'Gregorian month', 'fyldo'),
      _x('July', 'Gregorian month', 'fyldo'),
      _x('August', 'Gregorian month', 'fyldo'),
      _x('September', 'Gregorian month', 'fyldo'),
      _x('October', 'Gregorian month', 'fyldo'),
      _x('November', 'Gregorian month', 'fyldo'),
      _x('December', 'Gregorian month', 'fyldo'),
    ][month - 1] ?? ''
  );
}

/** The short Gregorian month of the field's value ("Oct"); Persian uses the full name. */
function shortMonthName(month: number): string {
  return (
    [
      _x('Jan', 'short Gregorian month', 'fyldo'),
      _x('Feb', 'short Gregorian month', 'fyldo'),
      _x('Mar', 'short Gregorian month', 'fyldo'),
      _x('Apr', 'short Gregorian month', 'fyldo'),
      _x('May', 'short Gregorian month', 'fyldo'),
      _x('Jun', 'short Gregorian month', 'fyldo'),
      _x('Jul', 'short Gregorian month', 'fyldo'),
      _x('Aug', 'short Gregorian month', 'fyldo'),
      _x('Sep', 'short Gregorian month', 'fyldo'),
      _x('Oct', 'short Gregorian month', 'fyldo'),
      _x('Nov', 'short Gregorian month', 'fyldo'),
      _x('Dec', 'short Gregorian month', 'fyldo'),
    ][month - 1] ?? ''
  );
}

/** The column heads of the grid, by weekday (0 = Sunday): "Su".."Sa", in Persian one letter (ی, د … ش). */
export function weekdayShort(day: number): string {
  return (
    [
      _x('Su', 'weekday, two letters', 'fyldo'),
      _x('Mo', 'weekday, two letters', 'fyldo'),
      _x('Tu', 'weekday, two letters', 'fyldo'),
      _x('We', 'weekday, two letters', 'fyldo'),
      _x('Th', 'weekday, two letters', 'fyldo'),
      _x('Fr', 'weekday, two letters', 'fyldo'),
      _x('Sa', 'weekday, two letters', 'fyldo'),
    ][day] ?? ''
  );
}

/** Spoken names of the weekdays (the grid's column headers and day names for screen readers). */
export function weekdayLong(day: number): string {
  return (
    [
      _x('Sunday', 'weekday', 'fyldo'),
      _x('Monday', 'weekday', 'fyldo'),
      _x('Tuesday', 'weekday', 'fyldo'),
      _x('Wednesday', 'weekday', 'fyldo'),
      _x('Thursday', 'weekday', 'fyldo'),
      _x('Friday', 'weekday', 'fyldo'),
      _x('Saturday', 'weekday', 'fyldo'),
    ][day] ?? ''
  );
}

/** A number in the page's numerals, without grouping (۱۴۰۵, not ۱٬۴۰۵). */
export const numerals = (n: number | string, locale: string): string => localizeDigits(String(n), locale);

/** "Oct 20, 2026" / "۲۰ اکتبر ۲۰۲۶" in Gregorian, "28 Mehr 1405" / "۲۸ مهر ۱۴۰۵" in Jalali. */
export function formatDay(calendar: CalendarKind, gregorian: YMD, locale: string): string {
  if (calendar === 'jalali') {
    const j = jdnToJalali(gregorianToJdn(gregorian));
    return numerals(sprintf('%1$s %2$s %3$s', j.day, monthName('jalali', j.month), j.year), locale);
  }
  /* translators: a Gregorian date: 1: short month name, 2: day, 3: year. Persian: "%2$s %1$s %3$s" (۲۰ اکتبر ۲۰۲۶). */
  return numerals(sprintf(_x('%1$s %2$s, %3$s', 'Gregorian date', 'fyldo'), shortMonthName(gregorian.month), gregorian.day, gregorian.year), locale);
}

/** "14:30" in the page's numerals. Hours then minutes, left to right in every language (the value is `dir="ltr"`). */
export const formatClock = (time: Time, locale: string): string => numerals(formatTime(time), locale);

/** "Oct 20, 2026, 14:30" (Persian "۲۸ مهر ۱۴۰۵، ۱۴:۳۰"). */
const withTime = (day: string, time: string): string =>
  /* translators: 1: a date, 2: a time. Persian uses its own comma: "%1$s، %2$s". */
  sprintf(_x('%1$s, %2$s', 'a date and a time', 'fyldo'), day, time);

/** The site-time day and time of a stored datetime. */
export const siteMomentOf = (value: string): Moment | null => {
  const utc = parseDateTime(value);
  return utc ? utcToSite(utc) : null;
};

/** What the field shows for a stored value in `calendar`; '' for nothing (or a value that cannot be read). */
export function formatValue(kind: MomentKind, value: string, calendar: CalendarKind, locale: string): string {
  if (kind === 'time') {
    const time = parseTime(value);
    return time ? formatClock(time, locale) : '';
  }
  if (kind === 'date') {
    const day = parseDate(value);
    return day ? formatDay(calendar, day, locale) : '';
  }
  const local = siteMomentOf(value);
  return local ? withTime(formatDay(calendar, local, locale), formatClock(local, locale)) : '';
}

/** Figma "Equivalent": the same value in the other calendar, under a filled field ("28 Mehr 1405 · Jalali"). */
export function equivalentText(kind: 'date' | 'datetime', value: string, calendar: CalendarKind, locale: string): string {
  const other = otherCalendar(calendar);
  const text = formatValue(kind, value, other, locale);
  /* translators: 1: a date written in the other calendar, 2: the name of that calendar (Jalali, Gregorian). */
  return text === '' ? '' : sprintf(_x('%1$s · %2$s', 'a date in the other calendar', 'fyldo'), text, calendarName(other));
}

/** How a bound reads in a message ("Choose Oct 20, 2026 or later."): the site's calendar, a datetime in site time. */
export function formatBound(kind: MomentKind, bound: string, locale: string): string {
  return formatValue(kind, bound, settings.calendar, locale) || bound;
}

// ── Ranges ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** What a range spans. `nextDay`: a time range whose end is earlier than its start (22:00 → 06:00). */
export interface RangeDuration {
  days: number;
  hours: number;
  minutes: number;
  nextDay: boolean;
}

/**
 * end − start of a range; null while an end is missing or invalid, or when the end does not come after the start. A date
 * range counts both days (Oct 20 → Oct 26 = 7 days). A time range's earlier end is the next day. A datetime range counts the
 * real time between the two UTC values, so a daylight-saving change in between is counted correctly.
 */
export function rangeDuration(kind: MomentKind, start: string, end: string): RangeDuration | null {
  if (kind === 'date') {
    const [from, to] = [parseDate(start), parseDate(end)];
    const days = from && to ? gregorianToJdn(to) - gregorianToJdn(from) + 1 : 0;
    return days >= 1 ? { days, hours: 0, minutes: 0, nextDay: false } : null;
  }
  let total: number;
  let nextDay = false;
  if (kind === 'time') {
    const [from, to] = [parseTime(start), parseTime(end)];
    if (!from || !to) return null;
    const diff = to.hour * 60 + to.minute - (from.hour * 60 + from.minute);
    nextDay = diff < 0;
    total = (diff + 1440) % 1440;
  } else {
    const [from, to] = [parseDateTime(start), parseDateTime(end)];
    if (!from || !to) return null;
    total = Math.floor((msOf(to) - msOf(from)) / 60000);
  }
  return total > 0 ? { days: Math.floor(total / 1440), hours: Math.floor((total % 1440) / 60), minutes: total % 60, nextDay } : null;
}

/**
 * Figma "Duration" under a range's inputs, once both ends are set: "Duration: 7 days", "Duration: 6 days, 9 hours and 30
 * minutes", "Duration: 8 hours, ends the next day" (Persian "مدت: ۶ روز و ۹ ساعت و ۳۰ دقیقه"). Zero parts are left out.
 * '' while there is nothing to count.
 */
export function durationText(kind: MomentKind, start: string, end: string, locale: string): string {
  const span = rangeDuration(kind, start, end);
  if (!span) return '';
  const parts = [
    span.days > 0 ? sprintf(_n('%d day', '%d days', span.days, 'fyldo'), span.days) : '',
    span.hours > 0 ? sprintf(_n('%d hour', '%d hours', span.hours, 'fyldo'), span.hours) : '',
    span.minutes > 0 ? sprintf(_n('%d minute', '%d minutes', span.minutes, 'fyldo'), span.minutes) : '',
  ].filter((part) => part !== '');
  const last = parts.pop() ?? '';
  const head =
    parts.length === 0
      ? undefined
      : parts.reduce((list, part) =>
          /* translators: a list of duration parts ("6 days, 9 hours"). Persian joins them with "و": "%1$s و %2$s". */
          sprintf(_x('%1$s, %2$s', 'duration parts', 'fyldo'), list, part),
        );
  const list =
    head === undefined
      ? last
      : /* translators: the last two duration parts ("9 hours and 30 minutes"). Persian: "%1$s و %2$s". */
        sprintf(_x('%1$s and %2$s', 'duration parts', 'fyldo'), head, last);
  return numerals(
    span.nextDay
      ? /* translators: %s: how long an overnight time range lasts ("8 hours"); it ends the day after it starts. */
        sprintf(__('Duration: %s, ends the next day', 'fyldo'), list)
      : /* translators: %s: how long a range lasts ("7 days", "8 hours and 30 minutes"). */
        sprintf(__('Duration: %s', 'fyldo'), list),
    locale,
  );
}

/**
 * The end picker's `min` in a date or datetime range: the later of the field's own `min` (resolved) and the start, so the
 * end's popup opens on the start's month with every day before it disabled. A time range's end is never limited.
 */
export function rangeEndMin(kind: 'date' | 'datetime', min: string | undefined, start: string): string | undefined {
  const own = min === undefined ? undefined : resolveBound(kind, min);
  if (!isValid(kind, start)) return own;
  return own === undefined || start > own ? start : own;
}
