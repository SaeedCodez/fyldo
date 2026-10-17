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

use Fyldo\V1\Support\Dates;

/**
 * Rule engine.
 */
final class Rules {

	/**
	 * Rules understood by both PHP and the client, in evaluation order. `email`, `number`, `color`, `date`, `time`, `datetime`,
	 * `media` and `relation` are implied by the field type (the value must be an address / a number / `#rrggbb` / a day, a time
	 * or a UTC datetime within the field's `min`, `max` and minute `step` / an attachment ID / a post, term or user ID or a list
	 * of them); the others are declared by the developer. A range field (`date_range`, `time_range`, `datetime_range`) implies
	 * its single type's rule with `range` on: the value is `array( 'start' => …, 'end' => … )`, see range().
	 */
	const KNOWN = array( 'required', 'min_length', 'max_length', 'pattern', 'schemes', 'email', 'number', 'color', 'code', 'date', 'time', 'datetime', 'media', 'relation', 'allowed', 'min', 'max', 'step' );

	/** The languages the implied `code` rule checks: JSON must parse, CSS must hold no markup. */
	const CODE_CHECKS = array( 'json', 'css' );

	/**
	 * The date and time rules: `true`, or an array of `min`, `max` (stored format, or `today` / `now`), `step` (minutes) and
	 * `range` (true: a start → end pair, each end checked against the others).
	 */
	const MOMENTS = array( 'date', 'time', 'datetime' );

	/** How a bound of each looks, for the developer's error messages. */
	const MOMENT_EXAMPLES = array(
		'date'     => 'a date like 2026-10-20, or "today"',
		'time'     => 'a time like 09:30 (24-hour)',
		'datetime' => 'a UTC datetime like 2026-10-20 11:00:00, or "now"',
	);

	/**
	 * @param array<string,mixed> $rules Field `validate` array.
	 * @param mixed               $value Sanitized value.
	 * @return array{rule:string,params:array<string,mixed>}|null
	 */
	public static function check( array $rules, $value ): ?array {
		// A range with neither end set is nothing: `required` rejects it, an optional one has nothing else to check.
		if ( self::is_range( $rules ) && is_array( $value ) && self::is_empty( $value['start'] ?? '' ) && self::is_empty( $value['end'] ?? '' ) ) {
			$value = '';
		}

		// A media field stores the attachment ID, a post, term or user field the item's ID: 0 means nothing is chosen, which
		// `required` does not accept.
		$by_id = ! empty( $rules['media'] ) || ! empty( $rules['relation'] );
		if ( ! empty( $rules['required'] ) && ( self::is_empty( $value ) || ( $by_id && 0 === $value ) ) ) {
			return array(
				'rule'   => 'required',
				'params' => array(),
			);
		}

		// An attachment ID is a whole number, 0 or more (the field's sanitizer guarantees it; a stored value may not be).
		if ( ! empty( $rules['media'] ) && ! self::is_empty( $value ) ) {
			return is_int( $value ) && $value >= 0 ? null : self::fail( 'media', array() );
		}

		// A post, term or user ID (0 = nothing chosen), or with `multiple` a list of IDs. `min` / `max` then count the list.
		if ( ! empty( $rules['relation'] ) && ! self::is_empty( $value ) && ! self::is_relation( $value ) ) {
			return self::fail( 'relation', array() );
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
			// A code field: JSON that parses; CSS without markup (as WordPress checks its own Additional CSS), with the line.
			if ( isset( $rules['code']['language'] ) ) {
				$failure = self::code( (string) $rules['code']['language'], $value );
				if ( null !== $failure ) {
					return $failure;
				}
			}
		}

		foreach ( self::MOMENTS as $kind ) {
			if ( isset( $rules[ $kind ] ) && false !== $rules[ $kind ] ) {
				$rule    = is_array( $rules[ $kind ] ) ? $rules[ $kind ] : array();
				$failure = empty( $rule['range'] ) ? self::moment( $kind, $rule, $value ) : self::range( $kind, $rule, $value );
				if ( null !== $failure ) {
					return $failure;
				}
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

		foreach ( self::MOMENTS as $kind ) {
			if ( ! isset( $rules[ $kind ] ) || is_bool( $rules[ $kind ] ) ) {
				continue;
			}
			if ( ! is_array( $rules[ $kind ] ) || array() !== array_diff( array_keys( $rules[ $kind ] ), array( 'min', 'max', 'step', 'range' ) ) ) {
				return sprintf( '`%s` must be true, or an array of `min`, `max` and `step`.', $kind );
			}
			if ( isset( $rules[ $kind ]['range'] ) && ! is_bool( $rules[ $kind ]['range'] ) ) {
				return sprintf( '`%s` `range` must be true or false.', $kind );
			}
			$problem = self::moment_config_error( $kind, $rules[ $kind ] );
			if ( null !== $problem ) {
				return $problem;
			}
		}

		return null;
	}

	/**
	 * What is wrong with the `min`, `max` and `step` of a date, time or datetime field, or null.
	 *
	 * @param string              $kind `date`, `time` or `datetime`.
	 * @param array<string,mixed> $rule The field's `min`, `max` and `step`.
	 */
	public static function moment_config_error( string $kind, array $rule ): ?string {
		// The keyword a bound may be instead of a value (resolved in the site's time zone when a value is checked).
		$keywords = array(
			'date'     => 'today',
			'datetime' => 'now',
		);

		$keyword = $keywords[ $kind ] ?? '';

		foreach ( array( 'min', 'max' ) as $key ) {
			if ( ! isset( $rule[ $key ] ) ) {
				continue;
			}
			$bound = $rule[ $key ];
			if ( ! is_string( $bound ) || '' === $bound || ( $keyword !== $bound && ! Dates::is_valid( $kind, $bound ) ) ) {
				return sprintf( '`%1$s` must be %2$s.', $key, self::MOMENT_EXAMPLES[ $kind ] ?? 'a stored value' );
			}
		}

		// Two fixed bounds can be compared now (a keyword moves with the clock).
		if ( isset( $rule['min'], $rule['max'] ) && $rule['min'] !== $keyword && $rule['max'] !== $keyword && strcmp( (string) $rule['min'], (string) $rule['max'] ) > 0 ) {
			return '`min` is later than `max`.';
		}

		if ( isset( $rule['step'] ) ) {
			if ( 'date' === $kind ) {
				return '`step` is for time and datetime fields (minutes).';
			}
			if ( ! is_int( $rule['step'] ) || $rule['step'] < 1 || $rule['step'] > 60 || 0 !== 60 % $rule['step'] ) {
				return '`step` must be a whole number of minutes that divides an hour: 1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30 or 60.';
			}
		}

		return null;
	}

	/**
	 * A date, time or datetime value: the strict stored format (a real day, 00:00–23:59), then `min` / `max` (`today` and
	 * `now` in the site's time zone), then the minute step (a datetime's counted on the site's clock). Mirrors
	 * `momentFailure` in app/lib/validation.ts.
	 *
	 * @param string              $kind  `date`, `time` or `datetime`.
	 * @param array<string,mixed> $rule  `min`, `max`, `step`.
	 * @param mixed               $value Sanitized value.
	 * @return array{rule:string,params:array<string,mixed>}|null
	 */
	private static function moment( string $kind, array $rule, $value ): ?array {
		if ( ! is_string( $value ) || ! Dates::is_valid( $kind, $value ) ) {
			return self::fail( $kind, array() );
		}

		if ( isset( $rule['min'] ) ) {
			$min = Dates::resolve( $kind, (string) $rule['min'] );
			if ( strcmp( $value, $min ) < 0 ) {
				return self::fail(
					'too_early',
					array(
						'bound' => $min,
						'kind'  => $kind,
					)
				);
			}
		}
		if ( isset( $rule['max'] ) ) {
			$max = Dates::resolve( $kind, (string) $rule['max'] );
			if ( strcmp( $value, $max ) > 0 ) {
				return self::fail(
					'too_late',
					array(
						'bound' => $max,
						'kind'  => $kind,
					)
				);
			}
		}

		if ( 'date' !== $kind ) {
			$step   = isset( $rule['step'] ) ? max( 1, (int) $rule['step'] ) : 1;
			$minute = Dates::minute_of_day( $kind, $value );
			if ( $minute < 0 || 0 !== $minute % $step ) {
				return self::fail( 'minute_step', array( 'step' => $step ) );
			}
		}

		return null;
	}

	/**
	 * A start → end pair of a range field (`range` on). Both ends set (one alone: `range_missing`, `end` names the missing
	 * one), each end passes the single rule (its failure, with `end` naming the end), then the order: a date range's end on
	 * or after the start, a datetime range's strictly after (`range_order`), a time range's different from the start
	 * (`range_equal`; an earlier end is the next day). Stored values compare as text. Mirrors `rangeFailure` in
	 * app/lib/validation.ts.
	 *
	 * @param string              $kind  `date`, `time` or `datetime`.
	 * @param array<string,mixed> $rule  `min`, `max`, `step`, `range`.
	 * @param mixed               $value Sanitized value.
	 * @return array{rule:string,params:array<string,mixed>}|null
	 */
	private static function range( string $kind, array $rule, $value ): ?array {
		if ( ! is_array( $value ) ) {
			return self::fail( $kind, array() );
		}
		$ends = array(
			'start' => $value['start'] ?? '',
			'end'   => $value['end'] ?? '',
		);

		foreach ( $ends as $which => $end ) {
			if ( self::is_empty( $end ) ) {
				return self::fail(
					'range_missing',
					array(
						'kind' => $kind,
						'end'  => $which,
					)
				);
			}
		}

		foreach ( $ends as $which => $end ) {
			$failure = self::moment( $kind, $rule, $end );
			if ( null !== $failure ) {
				$failure['params']['end'] = $which;
				return $failure;
			}
		}

		$order = strcmp( (string) $ends['end'], (string) $ends['start'] );
		if ( 'time' === $kind ) {
			return 0 === $order ? self::fail( 'range_equal', array( 'end' => 'end' ) ) : null;
		}

		return $order < 0 || ( 0 === $order && 'datetime' === $kind ) ? self::fail( 'range_order', array( 'end' => 'end' ) ) : null;
	}

	/**
	 * Whether a rule set is a range field's (a date or time rule with `range` on).
	 *
	 * @param array<string,mixed> $rules Field `validate` array.
	 */
	public static function is_range( array $rules ): bool {
		foreach ( self::MOMENTS as $kind ) {
			if ( isset( $rules[ $kind ] ) && is_array( $rules[ $kind ] ) && ! empty( $rules[ $kind ]['range'] ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Empty means: null, empty string, or empty array. `false` and `0` are values (a toggle can be off).
	 *
	 * @param mixed $value Value.
	 */
	public static function is_empty( $value ): bool {
		return null === $value || '' === $value || array() === $value;
	}

	/**
	 * An ID of 0 or more, or a list of IDs above 0.
	 *
	 * @param mixed $value Value.
	 */
	private static function is_relation( $value ): bool {
		if ( is_int( $value ) ) {
			return $value >= 0;
		}
		if ( ! is_array( $value ) || array_values( $value ) !== $value ) {
			return false;
		}
		foreach ( $value as $id ) {
			if ( ! is_int( $id ) || $id <= 0 ) {
				return false;
			}
		}

		return true;
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
	 * The implied rule of a `code` field.
	 *
	 * @param string $language `json` or `css` (others are not checked).
	 * @param string $value    The code.
	 * @return array{rule:string,params:array<string,mixed>}|null
	 */
	private static function code( string $language, string $value ): ?array {
		if ( 'json' === $language ) {
			json_decode( $value );
			return JSON_ERROR_NONE === json_last_error() ? null : self::fail( 'code', array( 'language' => 'json' ) );
		}
		if ( 'css' === $language && 1 === preg_match( '#</?\w#', $value, $match, PREG_OFFSET_CAPTURE ) ) {
			return self::fail(
				'code',
				array(
					'language' => 'css',
					'line'     => substr_count( substr( $value, 0, (int) $match[0][1] ), "\n" ) + 1,
				)
			);
		}

		return null;
	}

	/**
	 * @param string              $rule   Rule id.
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
