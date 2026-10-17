<?php
/**
 * Dates and times of the `date`, `time` and `datetime` fields: the stored formats, the site's time zone and clock.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Support;

use Fyldo\V1\Validation\Digits;

/**
 * What a date or time field stores is always Gregorian: a date `Y-m-d`, a time `H:i` (24-hour), a datetime `Y-m-d H:i:s`
 * in UTC (like `post_date_gmt`), nothing = ''. Jalali is drawn in the browser only. The site's time zone always comes from
 * WordPress (`wp_timezone()`), never from a request. Mirror of app/lib/datetime.ts.
 *
 * For plugin developers: `Dates::to_site( $utc )` reads a stored datetime in the site's time zone,
 * `Dates::range_to_site( $range )` both ends of a `datetime_range`, and `Dates::time_in_range( $range )` tells whether a
 * time (now, by default) is inside a `time_range`.
 */
final class Dates {

	const DATE     = '/^(\d{4})-(\d{2})-(\d{2})$/D';
	const TIME     = '/^([01]\d|2[0-3]):([0-5]\d)$/D';
	const DATETIME = '/^(\d{4})-(\d{2})-(\d{2}) ([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/D';

	/**
	 * A pinned "now" (UTC), for tests.
	 *
	 * @var \DateTimeImmutable|null
	 */
	private static $now = null;

	/**
	 * A pinned site time zone, for tests.
	 *
	 * @var \DateTimeZone|null
	 */
	private static $zone = null;

	/**
	 * A stored datetime (UTC, `Y-m-d H:i:s`) in the site's time zone, ready for `format()` or `wp_date()`. Null for an
	 * empty or invalid value.
	 *
	 *     $when = Dates::to_site( $options['sale_starts'] );
	 *     if ( $when ) echo esc_html( $when->format( 'Y-m-d H:i' ) );
	 *
	 * @param string $utc A value of a `datetime` field.
	 */
	public static function to_site( string $utc ): ?\DateTimeImmutable {
		if ( ! self::is_valid( 'datetime', $utc ) ) {
			return null;
		}
		$moment = \DateTimeImmutable::createFromFormat( '!Y-m-d H:i:s', $utc, new \DateTimeZone( 'UTC' ) );

		return false === $moment ? null : $moment->setTimezone( self::timezone() );
	}

	/**
	 * Both ends of a stored `datetime_range` in the site's time zone: `array( $start, $end )`, each null when empty or
	 * invalid.
	 *
	 *     list( $from, $to ) = Dates::range_to_site( $options['campaign'] );
	 *     if ( $from && $to ) echo esc_html( $from->format( 'Y-m-d H:i' ) . ' – ' . $to->format( 'Y-m-d H:i' ) );
	 *
	 * @param array<string,mixed> $range A value of a `datetime_range` field: `array( 'start' => …, 'end' => … )` in UTC.
	 * @return array{0:?\DateTimeImmutable,1:?\DateTimeImmutable}
	 */
	public static function range_to_site( array $range ): array {
		$ends = array();
		foreach ( array( 'start', 'end' ) as $key ) {
			$ends[] = isset( $range[ $key ] ) && is_string( $range[ $key ] ) ? self::to_site( $range[ $key ] ) : null;
		}

		return array( $ends[0], $ends[1] );
	}

	/**
	 * Whether a time is inside a stored `time_range`: the start included, the end excluded. A range whose end is earlier
	 * than its start crosses midnight (22:00 → 06:00 holds 23:30 and 05:59, not 06:00). False for an empty or invalid
	 * range, or one whose ends are equal.
	 *
	 *     if ( Dates::time_in_range( $options['quiet_hours'] ) ) return; // no notifications now
	 *
	 * @param array<string,mixed> $range A value of a `time_range` field: `array( 'start' => 'H:i', 'end' => 'H:i' )`.
	 * @param string|null         $time  `H:i`; default: now on the site's clock.
	 */
	public static function time_in_range( array $range, ?string $time = null ): bool {
		$time  = $time ?? self::now()->setTimezone( self::timezone() )->format( 'H:i' );
		$start = isset( $range['start'] ) && is_string( $range['start'] ) ? self::minute_of_day( 'time', $range['start'] ) : -1;
		$end   = isset( $range['end'] ) && is_string( $range['end'] ) ? self::minute_of_day( 'time', $range['end'] ) : -1;
		$at    = self::minute_of_day( 'time', $time );
		if ( $start < 0 || $end < 0 || $at < 0 || $start === $end ) {
			return false;
		}

		return $start < $end ? $at >= $start && $at < $end : $at >= $start || $at < $end;
	}

	/** The site's time zone: `wp_timezone()` (the "Timezone" setting), UTC without WordPress. */
	public static function timezone(): \DateTimeZone {
		if ( null !== self::$zone ) {
			return self::$zone;
		}

		return function_exists( 'wp_timezone' ) ? wp_timezone() : new \DateTimeZone( 'UTC' );
	}

	/** The zone as the browser gets it: an IANA name (`Asia/Tehran`) or a fixed offset (`+03:30`), like `wp_timezone_string()`. */
	public static function timezone_name(): string {
		if ( null === self::$zone && function_exists( 'wp_timezone_string' ) ) {
			return wp_timezone_string();
		}

		return self::timezone()->getName();
	}

	/**
	 * Pins the clock and the site's time zone (tests only); null restores the real ones.
	 *
	 * @internal
	 * @param string|null $now_utc `Y-m-d H:i:s` in UTC.
	 * @param string|null $zone    A time zone name or offset.
	 */
	public static function pin( ?string $now_utc, ?string $zone = null ): void {
		self::$now  = null === $now_utc ? null : new \DateTimeImmutable( $now_utc, new \DateTimeZone( 'UTC' ) );
		self::$zone = null === $zone ? null : new \DateTimeZone( $zone );
	}

	/** The current instant, in UTC. */
	public static function now(): \DateTimeImmutable {
		return self::$now ?? new \DateTimeImmutable( 'now', new \DateTimeZone( 'UTC' ) );
	}

	/**
	 * Whether a value is in the stored format of `$kind`: a real day (no 30 February), 00:00–23:59.
	 *
	 * @param string $kind  `date`, `time` or `datetime`.
	 * @param mixed  $value Value.
	 */
	public static function is_valid( string $kind, $value ): bool {
		if ( ! is_string( $value ) ) {
			return false;
		}
		if ( 'time' === $kind ) {
			return 1 === preg_match( self::TIME, $value );
		}
		if ( 1 !== preg_match( 'date' === $kind ? self::DATE : self::DATETIME, $value, $m ) ) {
			return false;
		}

		return (int) $m[1] >= 1 && checkdate( (int) $m[2], (int) $m[3], (int) $m[1] );
	}

	/**
	 * `today` (date) and `now` (datetime, to the minute) resolved in the site's time zone; any other bound as it is.
	 *
	 * @param string $kind  `date`, `time` or `datetime`.
	 * @param string $bound A stored-format value or a keyword.
	 */
	public static function resolve( string $kind, string $bound ): string {
		if ( 'date' === $kind && 'today' === $bound ) {
			return self::now()->setTimezone( self::timezone() )->format( 'Y-m-d' );
		}
		if ( 'datetime' === $kind && 'now' === $bound ) {
			return self::now()->format( 'Y-m-d H:i:00' );
		}

		return $bound;
	}

	/**
	 * The minute of the day a step counts: a time's own, a datetime's on the site's clock. -1 when it cannot be counted
	 * (an invalid value, or seconds: a step is whole minutes).
	 *
	 * @param string $kind  `time` or `datetime`.
	 * @param string $value A stored value.
	 */
	public static function minute_of_day( string $kind, string $value ): int {
		if ( 'time' === $kind ) {
			return self::is_valid( 'time', $value ) ? (int) substr( $value, 0, 2 ) * 60 + (int) substr( $value, 3, 2 ) : -1;
		}
		$site = self::to_site( $value );
		if ( null === $site || '00' !== substr( $value, 17, 2 ) ) {
			return -1;
		}

		return (int) $site->format( 'G' ) * 60 + (int) $site->format( 'i' );
	}

	/**
	 * A bound as a message shows it: the site's date (and time) format, a datetime in the site's time zone.
	 *
	 * @param string $kind  `date`, `time` or `datetime`.
	 * @param string $value A stored value.
	 */
	public static function display( string $kind, string $value ): string {
		if ( 'time' === $kind || ! function_exists( 'wp_date' ) ) {
			return $value;
		}
		$date_format = (string) get_option( 'date_format', 'F j, Y' );
		if ( 'date' === $kind ) {
			$day = self::is_valid( 'date', $value ) ? \DateTimeImmutable::createFromFormat( '!Y-m-d', $value, self::timezone() ) : false;
			return false === $day ? $value : (string) wp_date( $date_format, $day->getTimestamp(), self::timezone() );
		}
		$site = self::to_site( $value );

		return null === $site ? $value : (string) wp_date( $date_format . ' ' . (string) get_option( 'time_format', 'H:i' ), $site->getTimestamp(), self::timezone() );
	}

	/**
	 * What a date or time field makes of a raw value: text, trimmed, Persian / Arabic digits read as ASCII. Anything that
	 * is not text is nothing. The format is not fixed up: the field's rule reports a wrong one.
	 *
	 * @param mixed $raw Raw value.
	 */
	public static function read( $raw ): string {
		return is_string( $raw ) ? trim( Digits::to_ascii( $raw ) ) : '';
	}
}
