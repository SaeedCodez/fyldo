<?php
/**
 * Any number of options.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;

/**
 * Renders a Checkbox group; the optional `parent` label adds the "all" checkbox that shows Indeterminate.
 * The value is the list of selected option values, in option order.
 */
final class CheckboxGroupField extends AbstractOptionsField {

	public static function types(): array {
		return array( 'checkbox_group' );
	}

	protected function noun(): string {
		return 'Checkbox group';
	}

	protected function option_keys(): array {
		return array( 'description' );
	}

	protected function default_layout(): string {
		return 'stacked';
	}

	protected function extra_keys(): array {
		return array( 'options', 'parent' );
	}

	/**
	 * @return array<int,string>
	 */
	protected function fallback_default() {
		return array();
	}

	protected function normalize_type( array $config ): array {
		$config = $this->normalize_options( $config );

		$default = $config['default'] ?? array();
		if ( ! is_array( $default ) ) {
			throw new ConfigException( sprintf( 'Checkbox group "%s": `default` must be a list of option values.', $config['id'] ) );
		}
		$default = array_values( array_unique( array_map( 'strval', $default ) ) );

		if ( is_array( $config['options'] ) ) {
			$unknown = array_diff( $default, $this->enabled_values() );
			if ( array() !== $unknown ) {
				throw new ConfigException( sprintf( 'Checkbox group "%1$s": the default value(s) %2$s are not enabled options.', $config['id'], implode( ', ', $unknown ) ) );
			}
		}

		$config['default'] = $default;
		$config['parent']  = isset( $config['parent'] ) ? (string) $config['parent'] : '';

		return $config;
	}

	public function rules(): array {
		$rules            = parent::rules();
		$rules['allowed'] = $this->enabled_values();

		return $rules;
	}

	/**
	 * A list of strings, de-duplicated, known options first in option order. Unknown values are kept (after the
	 * known ones) so the `allowed` rule reports them instead of silently dropping them.
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

	protected function client_extra(): array {
		return array(
			'parent'  => (string) $this->config['parent'],
			'options' => $this->options(),
		);
	}
}
