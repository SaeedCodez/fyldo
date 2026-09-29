/**
 * UI translations. `@wordpress/i18n` is BUNDLED and fed from the instance config — nothing is written to the global
 * `wp.i18n` store, so two Fyldo copies (or Gutenberg) can never clobber each other's strings.
 *
 * Call sites pass the literal text domain (`__( 'Save changes', 'fyldo' )`) so `wp i18n make-pot` can extract them.
 */
import { createI18n, sprintf as wpSprintf } from '@wordpress/i18n';
import type { JedLocaleData } from './types';

type Domain = 'fyldo';

let i18n = createI18n<Domain>(undefined, 'fyldo');

export function setLocaleData(data: JedLocaleData | null): void {
  i18n = createI18n<Domain>(data ? (data.locale_data.messages as never) : undefined, 'fyldo');
}

export const __ = (text: string, domain: Domain = 'fyldo'): string => i18n.__(text, domain);
export const _x = (text: string, context: string, domain: Domain = 'fyldo'): string => i18n._x(text, context, domain);
export const _n = (single: string, plural: string, number: number, domain: Domain = 'fyldo'): string =>
  i18n._n(single, plural, number, domain);
export const sprintf: (format: string, ...args: unknown[]) => string = wpSprintf as never;

/** Numbers the UI formats itself (counters, "n selected") follow the locale: Persian gets ۰–۹ without a special font. */
export const formatNumber = (n: number, locale: string): string => new Intl.NumberFormat(locale).format(n);
