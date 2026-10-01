<?php
/**
 * Pick exactly one of many options.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

/**
 * Renders a Select (or a searchable combobox for long lists).
 */
final class SelectField extends AbstractOptionsField {

	public static function types(): array {
		return array( 'select' );
	}

	protected function noun(): string {
		return 'Select';
	}

	protected function option_keys(): array {
		return array( 'icon' );
	}

	protected function default_layout(): string {
		return 'field';
	}

	protected function extra_keys(): array {
		return array( 'placeholder', 'options', 'searchable' );
	}

	protected function normalize_type( array $config ): array {
		$config = $this->normalize_options( $config );

		$config['placeholder'] = isset( $config['placeholder'] ) ? (string) $config['placeholder'] : '';
		$config['searchable']  = ! empty( $config['searchable'] );
		$config['default']     = isset( $config['default'] ) ? (string) $config['default'] : '';

		return $config;
	}

	public function rules(): array {
		$rules            = parent::rules();
		$rules['allowed'] = $this->enabled_values();

		return $rules;
	}

	protected function sanitize_value( $raw ) {
		return is_scalar( $raw ) ? sanitize_text_field( (string) $raw ) : '';
	}

	protected function client_extra(): array {
		return array(
			'placeholder' => (string) $this->config['placeholder'],
			'searchable'  => (bool) $this->config['searchable'],
			'options'     => $this->options(),
		);
	}
}
