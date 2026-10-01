/**
 * Client mirror of src/Validation/Rules.php. The server is authoritative; this exists for instant feedback.
 * Both sides run tests/fixtures/validation-cases.json, so they cannot drift silently.
 *
 * Rule order: required, min_length, max_length, pattern, schemes, email, number, color, allowed, min, max, step.
 */
import { __, _n, sprintf } from '../i18n';
import type { RuleSet } from '../types';
import { isHexColor } from './color';

export interface Failure {
  rule: keyof RuleSet;
  params: Record<string, unknown>;
}

export const isEmpty = (value: unknown): boolean =>
  value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

/** Length in code points — the same measure as PHP `mb_strlen( $s, 'UTF-8' )`. */
export const length = (value: string): number => [...value].length;

const fail = (rule: keyof RuleSet, params: Record<string, unknown> = {}): Failure => ({ rule, params });

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

export function check(rules: RuleSet, value: unknown): Failure | null {
  if (rules.required && isEmpty(value)) return fail('required');
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
    case 'allowed':
      return __('Choose one of the available options.', 'fyldo');
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
