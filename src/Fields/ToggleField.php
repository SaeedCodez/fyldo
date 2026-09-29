<?php
/**
 * On/off switch.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Validation\Rules;

/**
 * Renders a Toggle (inline row).
 */
final class ToggleField extends AbstractField {

	public static function types(): array {
		return array( 'toggle' );
	}

	protected function default_layout(): string {
		return 'inline';
	}

	protected function fallback_default() {
		return false;
	}

	protected function normalize_type( array $config ): array {
		$config['default'] = isset( $config['default'] ) ? (bool) $config['default'] : false;

		return $config;
	}

	protected function sanitize_value( $raw ) {
		return rest_sanitize_boolean( $raw );
	}

	/** For a toggle, "required" means "must be on" (e.g. accepting a statement). */
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
