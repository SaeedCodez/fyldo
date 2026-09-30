<?php
/**
 * Persian and Arabic-Indic digits → ASCII, the Arabic decimal separator (٫) → "." and the Arabic thousands separator
 * (٬) removed. Pure PHP; mirrored by `toAsciiDigits()` in app/lib/digits.ts and tested
 * against the same cases (tests/fixtures/validation-cases.json, `digits`).
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Validation;

/**
 * Digit normalisation.
 */
final class Digits {

	/**
	 * Extended Arabic-Indic (Persian, U+06F0–U+06F9) and Arabic-Indic (U+0660–U+0669) digits, the Arabic decimal
	 * separator (U+066B, what a Persian keyboard types for a decimal point) and the Arabic thousands separator (U+066C).
	 */
	const MAP = array(
		"\u{06F0}" => '0',
		"\u{06F1}" => '1',
		"\u{06F2}" => '2',
		"\u{06F3}" => '3',
		"\u{06F4}" => '4',
		"\u{06F5}" => '5',
		"\u{06F6}" => '6',
		"\u{06F7}" => '7',
		"\u{06F8}" => '8',
		"\u{06F9}" => '9',
		"\u{0660}" => '0',
		"\u{0661}" => '1',
		"\u{0662}" => '2',
		"\u{0663}" => '3',
		"\u{0664}" => '4',
		"\u{0665}" => '5',
		"\u{0666}" => '6',
		"\u{0667}" => '7',
		"\u{0668}" => '8',
		"\u{0669}" => '9',
		"\u{066B}" => '.',
		"\u{066C}" => '',
	);

	/**
	 * Replace every Persian / Arabic-Indic digit with its ASCII digit, ٫ with "." and drop ٬; everything else is untouched.
	 *
	 * @param string $text Text.
	 */
	public static function to_ascii( string $text ): string {
		return strtr( $text, self::MAP );
	}
}
