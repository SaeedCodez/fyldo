import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sanitizeColor } from '../../app/lib/color';
import { normalizeTyped, sanitizeNumber, toAsciiDigits } from '../../app/lib/digits';
import { check, length, messageFor, validateValue } from '../../app/lib/validation';
import { sanitizeMediaId } from '../../app/lib/wp-media';
import type { RuleSet } from '../../app/types';

interface Case {
  name: string;
  rules: RuleSet;
  value: unknown;
  expect: string | null;
}

// The SAME file PHPUnit runs (tests/php/Unit/RulesTest.php): client and server cannot drift silently.
const { cases, digits, numbers, colors, media } = JSON.parse(readFileSync(resolve(__dirname, '../fixtures/validation-cases.json'), 'utf8')) as {
  cases: Case[];
  digits: { name: string; type: string; input: string; expect: string }[];
  numbers: { name: string; input: unknown; expect: number | string }[];
  colors: { name: string; input: unknown; expect: string }[];
  media: { name: string; input: unknown; expect: number }[];
};

describe('validation rules (shared fixture with PHP)', () => {
  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    expect(check(c.rules, c.value)?.rule ?? null).toBe(c.expect);
  });

  it('exercises every rule the PHP side knows', () => {
    const used = new Set(cases.flatMap((c) => Object.keys(c.rules)));
    const known = ['required', 'min_length', 'max_length', 'pattern', 'schemes', 'email', 'number', 'color', 'media', 'allowed', 'min', 'max', 'step'];
    expect(known.filter((r) => !used.has(r))).toEqual([]);
  });
});

describe('digit normalisation (shared fixture with PHP)', () => {
  it.each(digits.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    expect(normalizeTyped(c.type, c.input)).toBe(c.expect);
  });

  it.each(numbers.map((c) => [c.name, c] as const))('number: %s', (_name, c) => {
    expect(sanitizeNumber(c.input)).toBe(c.expect);
  });

  it.each(colors.map((c) => [c.name, c] as const))('color: %s', (_name, c) => {
    expect(sanitizeColor(c.input)).toBe(c.expect);
  });

  it.each(media.map((c) => [c.name, c] as const))('media: %s', (_name, c) => {
    expect(sanitizeMediaId(c.input)).toBe(c.expect);
  });

  it('never yields -0', () => {
    expect(Object.is(sanitizeNumber('-0'), 0)).toBe(true);
    expect(Object.is(sanitizeNumber(-0), 0)).toBe(true);
  });

  it('maps all ten digits of both scripts', () => {
    expect(toAsciiDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    expect(toAsciiDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(toAsciiDigits('سلام ۱ abc')).toBe('سلام 1 abc');
  });
});

describe('client helpers', () => {
  it('counts code points like PHP mb_strlen', () => {
    expect(length('🙂')).toBe(1);
    expect(length('سایت')).toBe(4);
    expect(length('café')).toBe(4);
  });

  it('an invalid developer pattern fails closed', () => {
    expect(check({ pattern: '(' }, 'abc')?.rule).toBe('pattern');
  });

  it('produces the same wording as PHP', () => {
    expect(validateValue({ required: true }, '')).toBe('This field is required.');
    expect(validateValue({ max_length: 1 }, 'ab')).toBe('Use no more than 1 character.');
    expect(validateValue({ max_length: 5 }, 'abcdef')).toBe('Use no more than 5 characters.');
    expect(validateValue({ min_length: 3 }, 'a')).toBe('Use at least 3 characters.');
    expect(messageFor({ rule: 'schemes', params: {} })).toBe('Enter a valid URL.');
    expect(messageFor({ rule: 'allowed', params: {} })).toBe('Choose one of the available options.');
    expect(messageFor({ rule: 'number', params: {} })).toBe('Enter a number.');
    expect(validateValue({ number: true, step: 5 }, 12)).toBe('Enter a value in steps of 5.');
    expect(validateValue({ number: true, max: 10 }, 12)).toBe('Enter a value of at most 10.');
  });
});
