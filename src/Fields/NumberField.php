<?php
/**
 * Number: whole or decimal, with `min` / `max` / `step` rules.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Validation\Digits;

/**
 * Renders an Input (`inputmode="decimal"`, LTR). Persian / Arabic-Indic digits are read as ASCII, in the browser as
 * the user types and again here. Stored as int|float; nothing typed is `''`; text that is not a number is kept as
 * text so the implied `number` rule reports it.
 */
final class NumberField extends AbstractField {

	/** Whole floats below this become ints, so `5.0` and `5` store (and compare) alike. */
	const INT_LIMIT = 1e15;

	public static function types(): array {
		return array( 'number' );
	}

	protected function default_layout(): string {
		return 'field';
	}

	protected function extra_keys(): array {
		return array( 'placeholder' );
	}

	protected function normalize_type( array $config ): array {
		$rules           = $config['validate'];
		$rules['number'] = true;

		$config['validate']    = $rules;
		$config['placeholder'] = isset( $config['placeholder'] ) ? (string) $config['placeholder'] : '';

		if ( array_key_exists( 'default', $config ) ) {
			$default = self::read( $config['default'] );
			if ( is_string( $default ) && '' !== $default ) {
				throw new ConfigException( sprintf( 'Number field "%s": `default` must be a number.', $config['id'] ) );
			}
			$config['default'] = $default;
		}

		return $config;
	}

	protected function sanitize_value( $raw ) {
		return self::read( $raw );
	}

	protected function client_extra(): array {
		return array(
			'placeholder' => (string) $this->config['placeholder'],
		);
	}

	/**
	 * Untrusted input → int|float, `''` (nothing), or the trimmed ASCII-digit text when it is not a number.
	 * Mirrored by `sanitizeNumber()` in app/lib/digits.ts (shared fixture cases `sanitize`).
	 *
	 * @param mixed $raw Raw value.
	 * @return int|float|string
	 */
	public static function read( $raw ) {
		if ( is_int( $raw ) || is_float( $raw ) ) {
			return is_finite( (float) $raw ) ? self::tidy( $raw ) : '';
		}
		if ( ! is_string( $raw ) ) {
			return '';
		}

		$text = (string) preg_replace( '/^[ \t\r\n]+|[ \t\r\n]+$/', '', Digits::to_ascii( $raw ) );
		if ( 1 === preg_match( '/^[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)$/D', $text ) && is_numeric( $text ) ) {
			return self::tidy( $text + 0 );
		}

		return $text;
	}

	/**
	 * @param int|float $number Number.
	 * @return int|float
	 */
	private static function tidy( $number ) {
		if ( is_float( $number ) && floor( $number ) === $number && abs( $number ) < self::INT_LIMIT ) {
			return (int) $number;
		}

		return $number;
	}
}
