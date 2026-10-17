<?php
/**
 * Base of the date, time and datetime range fields.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Support\Dates;

/**
 * Two values of the single type, start → end, stored as one array `array( 'start' => …, 'end' => … )`, each end in the
 * single type's format (nothing = `array( 'start' => '', 'end' => '' )`). Each end is picked with the single picker.
 *
 * Config: the single type's (`calendar`, `min`, `max`, `step`, `placeholder`), applied to both ends, plus
 * `start_placeholder` / `end_placeholder`. The implied rule is the single type's with `range` on: each end passes it, both
 * ends are set or both empty, and the end comes after the start (`date_range`: on or after; `datetime_range`: strictly
 * after; `time_range`: different, an earlier end being the next day).
 */
abstract class AbstractDateRangeField extends AbstractDateTimeField {

	protected function default_layout(): string {
		return 'stacked';
	}

	protected function fallback_default() {
		return array(
			'start' => '',
			'end'   => '',
		);
	}

	protected function extra_keys(): array {
		return array_merge( parent::extra_keys(), array( 'start_placeholder', 'end_placeholder' ) );
	}

	protected function normalize_type( array $config ): array {
		$config = parent::normalize_type( $config );

		// The single type's rule, with the pair checks on.
		$kind = $this->kind();
		$rule = $config['validate'][ $kind ];

		$config['validate'][ $kind ] = array_merge( is_array( $rule ) ? $rule : array(), array( 'range' => true ) );
		$config['start_placeholder'] = isset( $config['start_placeholder'] ) ? (string) $config['start_placeholder'] : '';
		$config['end_placeholder']   = isset( $config['end_placeholder'] ) ? (string) $config['end_placeholder'] : '';

		return $config;
	}

	/**
	 * A range default: both ends in the single type's format, or both empty.
	 *
	 * @param mixed  $configured The configured default.
	 * @param string $name       The kind, capitalised, for the message.
	 * @param string $id         The field id, for the message.
	 * @return array{start:string,end:string}
	 * @throws ConfigException When it is not such a pair.
	 */
	protected function normalize_default( $configured, string $name, string $id ) {
		$pair = is_array( $configured ) && array() === array_diff( array_keys( $configured ), array( 'start', 'end' ) ) ? $this->sanitize_value( $configured ) : null;
		$ok   = null !== $pair && ( '' === $pair['start'] ) === ( '' === $pair['end'] )
			&& ( '' === $pair['start'] || ( Dates::is_valid( $this->kind(), $pair['start'] ) && Dates::is_valid( $this->kind(), $pair['end'] ) ) );
		if ( null === $pair || ! $ok ) {
			throw new ConfigException( sprintf( '%1$s range field "%2$s": `default` must be array( \'start\' => …, \'end\' => … ) with %3$s at both ends, or both "".', $name, $id, $this->example() ) );
		}

		return $pair;
	}

	/**
	 * Both ends, read like the single type's value; unknown keys are dropped, anything that is not an array is empty.
	 *
	 * @param mixed $raw Raw value.
	 * @return array{start:string,end:string}
	 */
	protected function sanitize_value( $raw ) {
		$raw = is_array( $raw ) ? $raw : array();

		return array(
			'start' => Dates::read( $raw['start'] ?? '' ),
			'end'   => Dates::read( $raw['end'] ?? '' ),
		);
	}

	protected function client_extra(): array {
		return array_merge(
			parent::client_extra(),
			array(
				'start_placeholder' => (string) $this->config['start_placeholder'],
				'end_placeholder'   => (string) $this->config['end_placeholder'],
			)
		);
	}
}
