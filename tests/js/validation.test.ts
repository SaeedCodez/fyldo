import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { check, length, messageFor, validateValue } from '../../app/lib/validation';
import type { RuleSet } from '../../app/types';

interface Case {
  name: string;
  rules: RuleSet;
  value: unknown;
  expect: string | null;
}

// The SAME file PHPUnit runs (tests/php/Unit/RulesTest.php): client and server cannot drift silently.
const { cases } = JSON.parse(readFileSync(resolve(__dirname, '../fixtures/validation-cases.json'), 'utf8')) as { cases: Case[] };

describe('validation rules (shared fixture with PHP)', () => {
  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    expect(check(c.rules, c.value)?.rule ?? null).toBe(c.expect);
  });

  it('exercises every rule the PHP side knows', () => {
    const used = new Set(cases.flatMap((c) => Object.keys(c.rules)));
    const known = ['required', 'min_length', 'max_length', 'pattern', 'schemes', 'email', 'allowed', 'min', 'max'];
    expect(known.filter((r) => !used.has(r))).toEqual([]);
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
  });
});
