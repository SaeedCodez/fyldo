<?php
/**
 * Base of the fields whose value is a list of picked options: `checkbox_group`, `multi_select`.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;

/**
 * Option list + list value: only known values, in option order, de-duplicated; unknown values are kept last so the
 * `allowed` rule reports them instead of silently dropping them. `min` / `max` count the selected items.
 */
abstract class AbstractListField extends AbstractOptionsField {

	/**
	 * @return array<int,string>
	 */
	protected function fallback_default() {
		return array();
	}

	/**
	 * Normalises `options` and `default` (a list of enabled option values).
	 *
	 * @param array<string,mixed> $config Config after common normalisation.
	 * @return array<string,mixed>
	 * @throws ConfigException When options are missing or the default is not a list of enabled options.
	 */
	protected function normalize_list( array $config ): array {
		$config = $this->normalize_options( $config );

		$default = $config['default'] ?? array();
		if ( ! is_array( $default ) ) {
			throw new ConfigException( sprintf( '%1$s "%2$s": `default` must be a list of option values.', $this->noun(), $config['id'] ) );
		}
		$default = array_values( array_unique( array_map( 'strval', $default ) ) );

		if ( is_array( $config['options'] ) ) {
			$unknown = array_diff( $default, $this->enabled_values() );
			if ( array() !== $unknown ) {
				throw new ConfigException( sprintf( '%1$s "%2$s": the default value(s) %3$s are not enabled options.', $this->noun(), $config['id'], implode( ', ', $unknown ) ) );
			}
		}

		$config['default'] = $default;

		return $config;
	}

	public function rules(): array {
		$rules            = parent::rules();
		$rules['allowed'] = $this->enabled_values();

		return $rules;
	}

	/**
	 * A list of strings, de-duplicated, known options first in option order.
	 *
	 * @param mixed $raw Raw value.
	 * @return array<int,string>
	 */
	protected function sanitize_value( $raw ) {
		if ( ! is_array( $raw ) ) {
			return array();
		}

		$picked = array();
		foreach ( $raw as $item ) {
			if ( is_scalar( $item ) && ! is_bool( $item ) ) {
				$picked[] = sanitize_text_field( (string) $item );
			}
		}
		$picked = array_values( array_unique( $picked ) );

		$ordered = array();
		foreach ( $this->options() as $option ) {
			if ( in_array( $option['value'], $picked, true ) ) {
				$ordered[] = $option['value'];
			}
		}

		return array_merge( $ordered, array_values( array_diff( $picked, $ordered ) ) );
	}
}
