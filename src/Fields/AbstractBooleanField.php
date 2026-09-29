<?php
/**
 * Base of the on/off types: `toggle` and `checkbox`.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Validation\Rules;

/**
 * A boolean value. "Required" means "must be on" (e.g. accepting a statement).
 */
abstract class AbstractBooleanField extends AbstractField {

	/**
	 * Off unless configured otherwise.
	 *
	 * @return bool
	 */
	protected function fallback_default() {
		return false;
	}

	protected function normalize_type( array $config ): array {
		$config['default'] = isset( $config['default'] ) ? (bool) $config['default'] : false;

		return $config;
	}

	protected function sanitize_value( $raw ) {
		// Strings, ints and bools go through core's string-aware sanitizer ("false", "0"); anything else (floats, arrays)
		// keeps PHP's own truthiness, which is exactly what core does for them too.
		return ( is_string( $raw ) || is_int( $raw ) || is_bool( $raw ) ) ? rest_sanitize_boolean( $raw ) : (bool) $raw;
	}

	protected function implicit_check( $value ): ?array {
		if ( ! empty( $this->rules()['required'] ) && true !== $value ) {
			return array(
				'rule'   => 'required',
				'params' => array(),
			);
		}

		return null;
	}

	public function failure( $value ): ?array {
		// Rules::is_empty(false) is false, so the base class would skip implicit checks only for empty values.
		$declared = Rules::check( array_diff_key( $this->rules(), array( 'required' => true ) ), $value );

		return null !== $declared ? $declared : $this->implicit_check( $value );
	}
}
