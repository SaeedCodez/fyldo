<?php
/**
 * Base of the date, time and datetime fields.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Support\Dates;

/**
 * One date, time or datetime, stored the way WordPress stores them: always Gregorian, a date `Y-m-d`, a time `H:i`
 * (24-hour), a datetime `Y-m-d H:i:s` in UTC (like `post_date_gmt`); nothing = ''. The Jalali calendar is only drawn by the
 * browser and never reaches the server.
 *
 * Config: `calendar` (`auto`, the default: Jalali on a site whose locale starts with "fa", else Gregorian, with a switch in
 * the panel; `jalali` or `gregorian` lock it and hide the switch; not for `time`), `min` / `max` (a value in the stored
 * format, or `today` for a date, `now` for a datetime, resolved in the site's time zone), `step` (minutes, time and
 * datetime; it divides an hour; default 1) and `placeholder`. They become the field's implied `date` / `time` / `datetime`
 * rule, which the server checks again on every save: the strict format (no 30 February, 00:00–23:59), `min`, `max` and the
 * step. The site's time zone comes from WordPress, never from the request.
 */
abstract class AbstractDateTimeField extends AbstractField {

	const CALENDARS = array( 'auto', 'jalali', 'gregorian' );

	/** `date`, `time` or `datetime`: the stored format and the implied rule. */
	abstract protected function kind(): string;

	/** What the format looks like, for the developer's error messages. */
	abstract protected function example(): string;

	protected function default_layout(): string {
		return 'field';
	}

	protected function extra_keys(): array {
		$keys = array( 'min', 'max', 'placeholder' );
		if ( 'time' !== $this->kind() ) {
			$keys[] = 'calendar';
		}
		if ( 'date' !== $this->kind() ) {
			$keys[] = 'step';
		}

		return $keys;
	}

	protected function normalize_type( array $config ): array {
		$id   = (string) $config['id'];
		$kind = $this->kind();
		$name = ucfirst( $kind );

		$rules = $config['validate'];
		foreach ( array( 'min', 'max', 'step', 'date', 'time', 'datetime' ) as $key ) {
			if ( isset( $rules[ $key ] ) ) {
				throw new ConfigException( sprintf( '%1$s field "%2$s": set `%3$s` on the field, not in `validate`.', $name, $id, $key ) );
			}
		}

		$calendar = $config['calendar'] ?? 'auto';
		if ( ! in_array( $calendar, self::CALENDARS, true ) ) {
			throw new ConfigException( sprintf( '%1$s field "%2$s": `calendar` must be "auto", "jalali" or "gregorian".', $name, $id ) );
		}
		$config['calendar'] = $calendar;

		// The field's own keys become its implied rule; Rules::config_error() checks them (reported as "Field …: …").
		$rule = array();
		foreach ( array( 'min', 'max', 'step' ) as $key ) {
			if ( array_key_exists( $key, $config ) ) {
				$rule[ $key ] = $config[ $key ];
			}
		}
		if ( isset( $rule['step'] ) && 1 === $rule['step'] ) {
			unset( $rule['step'] );
		}
		$rules[ $kind ]     = array() === $rule ? true : $rule;
		$config['validate'] = $rules;

		if ( array_key_exists( 'default', $config ) ) {
			$config['default'] = $this->normalize_default( $config['default'], $name, $id );
		}

		$config['placeholder'] = isset( $config['placeholder'] ) ? (string) $config['placeholder'] : '';

		return $config;
	}

	/**
	 * The developer's `default`, in the stored format.
	 *
	 * @param mixed  $configured The configured default.
	 * @param string $name       The kind, capitalised, for the message.
	 * @param string $id         The field id, for the message.
	 * @return mixed
	 * @throws ConfigException When it is not a value of the field's kind.
	 */
	protected function normalize_default( $configured, string $name, string $id ) {
		$value = is_string( $configured ) ? Dates::read( $configured ) : null;
		if ( null === $value || ( '' !== $value && ! Dates::is_valid( $this->kind(), $value ) ) ) {
			throw new ConfigException( sprintf( '%1$s field "%2$s": `default` must be %3$s, or "".', $name, $id, $this->example() ) );
		}

		return $value;
	}

	protected function sanitize_value( $raw ) {
		return Dates::read( $raw );
	}

	protected function client_extra(): array {
		return array(
			'calendar'    => 'time' === $this->kind() ? 'gregorian' : (string) $this->config['calendar'],
			'placeholder' => (string) $this->config['placeholder'],
		);
	}
}
