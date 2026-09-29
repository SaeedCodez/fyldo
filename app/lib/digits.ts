/**
 * Persian and Arabic-Indic digits → ASCII, and what a number field makes of what was typed. Mirror of
 * src/Validation/Digits.php and NumberField::read(); both run the `digits` and `numbers` cases of
 * tests/fixtures/validation-cases.json.
 */

/** Extended Arabic-Indic (Persian, U+06F0–U+06F9) and Arabic-Indic (U+0660–U+0669) digits. */
const NON_ASCII_DIGITS = /[۰-۹٠-٩]/g;

export const toAsciiDigits = (text: string): string =>
  text.replace(NON_ASCII_DIGITS, (digit) => {
    const code = digit.codePointAt(0) as number;
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });

/** Field types whose value is read with ASCII digits. Text and password are never touched. */
export const readsAsciiDigits = (type: string): boolean => type === 'url' || type === 'email' || type === 'number';

/** What a field of `type` keeps of typed or pasted text (the PHP side does the same again on save). */
export const normalizeTyped = (type: string, text: string): string => (readsAsciiDigits(type) ? toAsciiDigits(text) : text);

const NUMBER_TEXT = /^[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)$/;

/** JS has one number type, so PHP's "5.0 → 5" is free; only `-0` needs care. */
const tidy = (n: number): number => (n === 0 ? 0 : n);

/**
 * Raw input → number, `''` (nothing), or the trimmed ASCII-digit text when it is not a number (the implied `number`
 * rule then reports it). Never returns `-0`.
 */
export function sanitizeNumber(raw: unknown): number | string {
  if (typeof raw === 'number') return Number.isFinite(raw) ? tidy(raw) : '';
  if (typeof raw !== 'string') return '';

  const text = toAsciiDigits(raw).replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
  return NUMBER_TEXT.test(text) ? tidy(Number(text)) : text;
}
