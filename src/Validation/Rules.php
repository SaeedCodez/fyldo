<?php
/**
 * Declarative validation vocabulary, shared with the browser (tests/fixtures/validation-cases.json).
 *
 * Pure PHP (no WordPress calls) so it can be unit-tested on its own. Every rule returns null (ok) or a
 * failure array `array( 'rule' => <name>, 'params' => array )`; message text is built by the caller.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Validation;

/**
 * Rule engine.
 */
final class Rules {

	/**
	 * Rules understood by both PHP and the client, in evaluation order. `email`, `number` and `color` are implied by the
	 * field type (the value must be an address / a number / `#rrggbb`); the others are declared by the developer.
	 */
	const KNOWN = array( 'required', 'min_length', 'max_length', 'pattern', 'schemes', 'email', 'number', 'color', 'allowed', 'min', 'max', 'step' );

	/**
	 * @param array<string,mixed> $rules Field `validate` array.
	 * @param mixed               $value Sanitized value.
	 * @return array{rule:string,params:array<string,mixed>}|null
	 */
	public static function check( array $rules, $value ): ?array {
		if ( ! empty( $rules['required'] ) && self::is_empty( $value ) ) {
			return array(
				'rule'   => 'required',
				'params' => array(),
			);
		}

		if ( self::is_empty( $value ) && ! is_array( $value ) ) {
			return null; // Optional and empty: nothing else to check. (An empty list still counts against `min`.)
		}

		if ( is_string( $value ) ) {
			$length = self::length( $value );

			if ( isset( $rules['min_length'] ) && $length < (int) $rules['min_length'] ) {
				return self::fail( 'min_length', array( 'min' => (int) $rules['min_length'] ) );
			}
			if ( isset( $rules['max_length'] ) && $length > (int) $rules['max_length'] ) {
				return self::fail( 'max_length', array( 'max' => (int) $rules['max_length'] ) );
			}
			if ( isset( $rules['pattern'] ) && ! self::matches( (string) $rules['pattern'], $value ) ) {
				return self::fail( 'pattern', array() );
			}
			if ( isset( $rules['schemes'] ) && ! self::has_scheme( $value, (array) $rules['schemes'] ) ) {
				return self::fail( 'schemes', array( 'schemes' => array_values( (array) $rules['schemes'] ) ) );
			}
			if ( ! empty( $rules['email'] ) && false === filter_var( $value, FILTER_VALIDATE_EMAIL ) ) {
				return self::fail( 'email', array() );
			}
			// A number field stores int|float; text that could not be read as a number stays a string and lands here.
			if ( ! empty( $rules['number'] ) ) {
				return self::fail( 'number', array() );
			}
			// A color field stores `#rrggbb`; text the server could not read as a colour stays text and lands here.
			if ( ! empty( $rules['color'] ) && 1 !== preg_match( '/^#[0-9a-f]{6}$/D', $value ) ) {
				return self::fail( 'color', array() );
			}
		}

		if ( isset( $rules['allowed'] ) ) {
			$allowed = array_map( 'strval', (array) $rules['allowed'] );
			$values  = is_array( $value ) ? $value : array( $value );
			foreach ( $values as $single ) {
				if ( ! is_scalar( $single ) || ! in_array( (string) $single, $allowed, true ) ) {
					return self::fail( 'allowed', array() );
				}
			}
		}

		if ( is_numeric( $value ) && ! is_string( $value ) ) {
			if ( isset( $rules['min'] ) && $value < $rules['min'] ) {
				return self::fail( 'min', array( 'min' => $rules['min'] ) );
			}
			if ( isset( $rules['max'] ) && $value > $rules['max'] ) {
				return self::fail( 'max', array( 'max' => $rules['max'] ) );
			}
			if ( isset( $rules['step'] ) && $rules['step'] > 0 && ! self::on_step( $value, $rules['step'], $rules['min'] ?? 0 ) ) {
				return self::fail( 'step', array( 'step' => $rules['step'] ) );
			}
		}

		// For a list (checkbox group, multi select) `min` / `max` count the selected items.
		if ( is_array( $value ) ) {
			if ( isset( $rules['min'] ) && count( $value ) < (int) $rules['min'] ) {
				return self::fail(
					'min',
					array(
						'min'   => (int) $rules['min'],
						'items' => true,
					)
				);
			}
			if ( isset( $rules['max'] ) && count( $value ) > (int) $rules['max'] ) {
				return self::fail(
					'max',
					array(
						'max'   => (int) $rules['max'],
						'items' => true,
					)
				);
			}
		}

		return null;
	}

	/**
	 * Registration-time check of the rule parameters, so a typo fails loudly instead of validating nothing.
	 * Returns a sentence for the developer, or null when the rule set is well-formed.
	 *
	 * @param array<string,mixed> $rules Field `validate` array (keys already checked against KNOWN).
	 */
	public static function config_error( array $rules ): ?string {
		foreach ( array( 'min_length', 'max_length' ) as $key ) {
			if ( isset( $rules[ $key ] ) && ( ! is_int( $rules[ $key ] ) || $rules[ $key ] < 0 ) ) {
				return sprintf( '`%s` must be a whole number, 0 or more.', $key );
			}
		}

		foreach ( array( 'min', 'max' ) as $key ) {
			if ( isset( $rules[ $key ] ) && ! is_int( $rules[ $key ] ) && ! is_float( $rules[ $key ] ) ) {
				return sprintf( '`%s` must be a number.', $key );
			}
		}

		if ( isset( $rules['min'], $rules['max'] ) && $rules['min'] > $rules['max'] ) {
			return '`min` is greater than `max`.';
		}

		if ( isset( $rules['step'] ) && ( ( ! is_int( $rules['step'] ) && ! is_float( $rules['step'] ) ) || $rules['step'] <= 0 ) ) {
			return '`step` must be a number greater than 0.';
		}

		if ( isset( $rules['pattern'] ) && ( ! is_string( $rules['pattern'] ) || '' === $rules['pattern'] || false === @preg_match( self::delimit( $rules['pattern'] ), '' ) ) ) { // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- a bad developer pattern is reported, not fatal.
			return '`pattern` must be a valid regular expression (JavaScript syntax, no delimiters).';
		}

		foreach ( array( 'schemes', 'allowed' ) as $key ) {
			if ( isset( $rules[ $key ] ) && ( ! is_array( $rules[ $key ] ) || ( 'schemes' === $key && array() === $rules[ $key ] ) ) ) {
				return sprintf( '`%s` must be a list (and `schemes` cannot be empty).', $key );
			}
		}

		return null;
	}

	/**
	 * Empty means: null, empty string, or empty array. `false` and `0` are values (a toggle can be off).
	 *
	 * @param mixed $value Value.
	 */
	public static function is_empty( $value ): bool {
		return null === $value || '' === $value || array() === $value;
	}

	/** Length in characters (code points), the same measure as JS `[...str].length`. */
	public static function length( string $value ): int {
		if ( function_exists( 'mb_strlen' ) ) {
			return mb_strlen( $value, 'UTF-8' );
		}

		return 1 === preg_match_all( '/./us', $value, $m ) ? count( $m[0] ) : strlen( $value );
	}

	/**
	 * `pattern` is a JavaScript-compatible regular expression source (no delimiters, unanchored — like
	 * `new RegExp( source ).test( value )`). Only the common subset is supported on both sides.
	 */
	private static function matches( string $source, string $value ): bool {
		$result = @preg_match( self::delimit( $source ), $value ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- invalid developer patterns must not break the request.

		return 1 === $result;
	}

	private static function delimit( string $source ): string {
		return '~' . str_replace( '~', '\~', $source ) . '~u';
	}

	/**
	 * Whether `$value` sits on the grid `base + n × step`. The tolerance absorbs binary floating point (0.3 on a 0.1
	 * grid); the client evaluates the very same expression on IEEE doubles.
	 *
	 * @param int|float $value Value.
	 * @param int|float $step  Grid size, greater than 0.
	 * @param int|float $base  Grid origin (the `min` rule, or 0).
	 */
	private static function on_step( $value, $step, $base ): bool {
		$steps = ( $value - $base ) / $step;

		return abs( $steps - round( $steps ) ) <= 1e-9 * max( 1.0, abs( $steps ) );
	}

	/**
	 * @param string[] $schemes Allowed URL schemes, lower-case.
	 */
	private static function has_scheme( string $value, array $schemes ): bool {
		if ( 1 !== preg_match( '/^([a-z][a-z0-9+.-]*):\/\/[^\s\/?#]+/i', $value, $m ) ) {
			return false;
		}

		return in_array( strtolower( $m[1] ), array_map( 'strtolower', $schemes ), true );
	}

	/**
	 * @param array<string,mixed> $params Parameters.
	 * @return array{rule:string,params:array<string,mixed>}
	 */
	private static function fail( string $rule, array $params ): array {
		return array(
			'rule'   => $rule,
			'params' => $params,
		);
	}
}
