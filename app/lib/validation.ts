/**
 * Client mirror of src/Validation/Rules.php. The server is authoritative; this exists for instant feedback.
 * Both sides run tests/fixtures/validation-cases.json, so they cannot drift silently.
 *
 * Rule order: required, min_length, max_length, pattern, schemes, email, number, color, date, time, datetime, media, relation, allowed,
 * min, max, step. `date`, `time` and `datetime` check the format, then their own `min`, `max` and minute `step`; with `range`
 * on (the range fields) the value is a start → end pair and each end is checked, then the order.
 */
import { __, _n, sprintf } from '../i18n';
import type { MomentRule, RuleSet } from '../types';
import { isHexColor } from './color';
import { dateSettings, formatBound, isValid, minuteOfDay, resolveBound, type MomentKind } from './datetime';

export interface Failure {
  /**
   * A declarative rule, a `group` field's item count (`items_min`, `items_max`: src/Fields/GroupField.php), or a date /
   * time bound (`too_early`, `too_late`: params `bound` in the stored format and `kind`) or minute step (`minute_step`), or
   * a range's pair (`range_missing`, `range_order`, `range_equal`). A range's failures name the end at fault (`end`).
   */
  rule: keyof RuleSet | 'items_min' | 'items_max' | 'too_early' | 'too_late' | 'minute_step' | 'range_missing' | 'range_order' | 'range_equal';
  params: Record<string, unknown>;
}

export const isEmpty = (value: unknown): boolean =>
  value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

/** Length in code points — the same measure as PHP `mb_strlen( $s, 'UTF-8' )`. */
export const length = (value: string): number => [...value].length;

const fail = (rule: Failure['rule'], params: Record<string, unknown> = {}): Failure => ({ rule, params });

function matches(source: string, value: string): boolean {
  try {
    return new RegExp(source, 'u').test(value);
  } catch {
    return false; // an invalid developer pattern fails closed, exactly like PHP
  }
}

function hasScheme(value: string, schemes: string[]): boolean {
  const m = /^([a-z][a-z0-9+.-]*):\/\/[^\s/?#]+/i.exec(value);
  return m !== null && schemes.map((s) => s.toLowerCase()).includes((m[1] as string).toLowerCase());
}

/** ASCII-only, no leading/trailing/double dots in the local part, at least one dot in the domain (matches PHP). */
function isEmail(value: string): boolean {
  const at = value.lastIndexOf('@');
  if (at < 1) return false;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  return (
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) &&
    /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(domain)
  );
}

/** On the grid `base + n × step`? The tolerance absorbs binary floating point (0.3 on a 0.1 grid); PHP evaluates the same expression. */
function onStep(value: number, step: number, base: number): boolean {
  const steps = (value - base) / step;
  return Math.abs(steps - Math.round(steps)) <= 1e-9 * Math.max(1, Math.abs(steps));
}

const isId = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

/** An ID of 0 or more, or a list of IDs above 0. */
const isRelation = (value: unknown): boolean =>
  Array.isArray(value) ? value.every((id) => isId(id) && id > 0) : isId(value) && value >= 0;

const MOMENTS: MomentKind[] = ['date', 'time', 'datetime'];

/**
 * A `date`, `time` or `datetime` value: the strict stored format (a real day, 00:00–23:59), then `min` / `max` (`today` and
 * `now` resolved in the site's time zone), then the minute step (a datetime's counted on the site's clock).
 */
function momentFailure(kind: MomentKind, rule: MomentRule, value: unknown): Failure | null {
  if (typeof value !== 'string' || !isValid(kind, value)) return fail(kind);
  if (rule.min !== undefined) {
    const min = resolveBound(kind, rule.min);
    if (value < min) return fail('too_early', { bound: min, kind });
  }
  if (rule.max !== undefined) {
    const max = resolveBound(kind, rule.max);
    if (value > max) return fail('too_late', { bound: max, kind });
  }
  if (kind !== 'date') {
    const step = rule.step ?? 1;
    const minute = minuteOfDay(kind, value);
    if (minute < 0 || minute % step !== 0) return fail('minute_step', { step });
  }
  return null;
}

/** A range field's rules: a date or time rule with `range` on. */
export const isRange = (rules: RuleSet): boolean => MOMENTS.some((kind) => typeof rules[kind] === 'object' && (rules[kind] as MomentRule).range === true);

/** A range's end, as PHP reads `$value['start'] ?? ''`. */
const endOf = (value: object, end: 'start' | 'end'): unknown => (value as Record<string, unknown>)[end] ?? '';

/**
 * A start → end pair (`range` on): both ends set (one alone: `range_missing`, `end` names the missing one), each end passes
 * the single rule (its failure, with `end`), then the order: a date range's end on or after the start, a datetime range's
 * strictly after (`range_order`), a time range's different from the start (`range_equal`; an earlier end is the next day).
 */
function rangeFailure(kind: MomentKind, rule: MomentRule, value: unknown): Failure | null {
  if (typeof value !== 'object' || value === null) return fail(kind);
  const ends = ['start', 'end'] as const;
  for (const end of ends) if (isEmpty(endOf(value, end))) return fail('range_missing', { kind, end });
  for (const end of ends) {
    const failure = momentFailure(kind, rule, endOf(value, end));
    if (failure) return fail(failure.rule, { ...failure.params, end });
  }
  const [start, end] = [String(endOf(value, 'start')), String(endOf(value, 'end'))];
  if (kind === 'time') return end === start ? fail('range_equal', { end: 'end' }) : null;
  return end < start || (end === start && kind === 'datetime') ? fail('range_order', { end: 'end' }) : null;
}

export function check(rules: RuleSet, raw: unknown): Failure | null {
  // A range with neither end set is nothing: `required` rejects it, an optional one has nothing else to check.
  const value = isRange(rules) && typeof raw === 'object' && raw !== null && isEmpty(endOf(raw, 'start')) && isEmpty(endOf(raw, 'end')) ? '' : raw;
  // A media field stores the attachment ID, a post, term or user field the item's ID: 0 means nothing is chosen, which
  // `required` does not accept.
  if (rules.required && (isEmpty(value) || ((rules.media || rules.relation) && value === 0))) return fail('required');
  // An attachment ID is a whole number, 0 or more (what the field's sanitizer produces).
  if (rules.media && !isEmpty(value)) return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? null : fail('media');
  // A post, term or user ID (0 = nothing chosen), or with `multiple` a list of IDs; `min` / `max` then count the list.
  if (rules.relation && !isEmpty(value) && !isRelation(value)) return fail('relation');
  if (isEmpty(value) && !Array.isArray(value)) return null; // (an empty list still counts against `min`)

  if (typeof value === 'string') {
    const len = length(value);
    if (rules.min_length !== undefined && len < rules.min_length) return fail('min_length', { min: rules.min_length });
    if (rules.max_length !== undefined && len > rules.max_length) return fail('max_length', { max: rules.max_length });
    if (rules.pattern !== undefined && !matches(rules.pattern, value)) return fail('pattern');
    if (rules.schemes !== undefined && !hasScheme(value, rules.schemes)) return fail('schemes', { schemes: rules.schemes });
    if (rules.email && !isEmail(value)) return fail('email');
    // A number field's value is a number; text that could not be read as one stays a string and lands here.
    if (rules.number) return fail('number');
    // A color field stores `#rrggbb`; anything else the server could not read stays text and lands here.
    if (rules.color && !isHexColor(value)) return fail('color');
  }

  for (const kind of MOMENTS) {
    const rule = rules[kind];
    if (!rule) continue;
    const own = rule === true ? {} : rule;
    const failure = own.range ? rangeFailure(kind, own, value) : momentFailure(kind, own, value);
    if (failure) return failure;
  }

  if (rules.allowed !== undefined) {
    const allowed = rules.allowed.map(String);
    const values = Array.isArray(value) ? value : [value];
    if (values.some((v) => (typeof v !== 'string' && typeof v !== 'number') || !allowed.includes(String(v)))) return fail('allowed');
  }

  if (typeof value === 'number') {
    if (rules.min !== undefined && value < rules.min) return fail('min', { min: rules.min });
    if (rules.max !== undefined && value > rules.max) return fail('max', { max: rules.max });
    if (rules.step !== undefined && rules.step > 0 && !onStep(value, rules.step, rules.min ?? 0)) return fail('step', { step: rules.step });
  }

  // For a list (checkbox group, multi select) `min` / `max` count the selected items.
  if (Array.isArray(value)) {
    if (rules.min !== undefined && value.length < rules.min) return fail('min', { min: rules.min, items: true });
    if (rules.max !== undefined && value.length > rules.max) return fail('max', { max: rules.max, items: true });
  }

  return null;
}

/** Same wording as src/Validation/Messages.php (both extracted into fyldo.pot). */
export function messageFor(failure: Failure): string {
  switch (failure.rule) {
    case 'required':
      return __('This field is required.', 'fyldo');
    case 'min_length': {
      const min = Number(failure.params.min ?? 0);
      return sprintf(_n('Use at least %d character.', 'Use at least %d characters.', min, 'fyldo'), min);
    }
    case 'max_length': {
      const max = Number(failure.params.max ?? 0);
      return sprintf(_n('Use no more than %d character.', 'Use no more than %d characters.', max, 'fyldo'), max);
    }
    case 'pattern':
      return __('This value is not in the expected format.', 'fyldo');
    case 'schemes':
      return __('Enter a valid URL.', 'fyldo');
    case 'email':
      return __('Enter a valid email address.', 'fyldo');
    case 'number':
      return __('Enter a number.', 'fyldo');
    case 'color':
      return __('Enter a valid color, like #rrggbb.', 'fyldo');
    case 'date':
      return __('Enter a valid date.', 'fyldo');
    case 'time':
      return __('Enter a valid time between 00:00 and 23:59.', 'fyldo');
    case 'datetime':
      return __('Enter a valid date and time.', 'fyldo');
    case 'too_early':
      /* translators: %s: the earliest date or time allowed. */
      return sprintf(__('Choose %s or later.', 'fyldo'), formatBound(failure.params.kind as MomentKind, String(failure.params.bound ?? ''), dateSettings().locale));
    case 'too_late':
      /* translators: %s: the latest date or time allowed. */
      return sprintf(__('Choose %s or earlier.', 'fyldo'), formatBound(failure.params.kind as MomentKind, String(failure.params.bound ?? ''), dateSettings().locale));
    case 'minute_step': {
      const step = Number(failure.params.step ?? 1);
      return sprintf(_n('Choose a time in steps of %d minute.', 'Choose a time in steps of %d minutes.', step, 'fyldo'), step);
    }
    case 'range_missing':
      if (failure.params.end === 'start') return failure.params.kind === 'time' ? __('Choose a start time.', 'fyldo') : __('Choose a start date.', 'fyldo');
      return failure.params.kind === 'time' ? __('Choose an end time.', 'fyldo') : __('Choose an end date.', 'fyldo');
    case 'range_order':
      return __('Choose an end after the start.', 'fyldo');
    case 'range_equal':
      return __('Choose an end different from the start.', 'fyldo');
    case 'allowed':
      return __('Choose one of the available options.', 'fyldo');
    case 'media':
      return __('Choose a file from the media library.', 'fyldo');
    case 'relation':
      return __('Choose an item from the list.', 'fyldo');
    case 'items_min': {
      const min = Number(failure.params.min ?? 0);
      return sprintf(_n('Add at least %d item.', 'Add at least %d items.', min, 'fyldo'), min);
    }
    case 'items_max': {
      const max = Number(failure.params.max ?? 0);
      return sprintf(_n('Use no more than %d item.', 'Use no more than %d items.', max, 'fyldo'), max);
    }
    case 'step':
      return sprintf(__('Enter a value in steps of %s.', 'fyldo'), String(failure.params.step ?? ''));
    case 'min':
      if (failure.params.items) {
        const min = Number(failure.params.min ?? 0);
        return sprintf(_n('Select at least %d option.', 'Select at least %d options.', min, 'fyldo'), min);
      }
      return sprintf(__('Enter a value of at least %s.', 'fyldo'), String(failure.params.min ?? ''));
    case 'max':
      if (failure.params.items) {
        const max = Number(failure.params.max ?? 0);
        return sprintf(_n('Select no more than %d option.', 'Select no more than %d options.', max, 'fyldo'), max);
      }
      return sprintf(__('Enter a value of at most %s.', 'fyldo'), String(failure.params.max ?? ''));
    default:
      return __('This value is not valid.', 'fyldo');
  }
}

/** Validate a value against a field's rules; returns the message or null. */
export function validateValue(rules: RuleSet, value: unknown): string | null {
  const failure = check(rules, value);
  return failure ? messageFor(failure) : null;
}
