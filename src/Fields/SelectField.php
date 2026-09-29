<?php
/**
 * Pick exactly one of many options.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;

/**
 * Renders a Select (or a searchable combobox for long lists).
 */
final class SelectField extends AbstractField {

	/** @var array<int,array{value:string,label:string,disabled:bool,icon?:string}>|null */
	private $resolved = null;

	public static function types(): array {
		return array( 'select' );
	}

	protected function default_layout(): string {
		return 'stacked';
	}

	protected function extra_keys(): array {
		return array( 'placeholder', 'options', 'searchable' );
	}

	protected function normalize_type( array $config ): array {
		if ( ! isset( $config['options'] ) || ( ! is_array( $config['options'] ) && ! is_callable( $config['options'] ) ) ) {
			throw new ConfigException( sprintf( 'Select field "%s" needs `options` (an array or a callable returning one).', $config['id'] ) );
		}

		$config['placeholder'] = isset( $config['placeholder'] ) ? (string) $config['placeholder'] : '';
		$config['searchable']  = ! empty( $config['searchable'] );
		$config['default']     = isset( $config['default'] ) ? (string) $config['default'] : '';

		if ( is_array( $config['options'] ) ) {
			$options = self::normalize_options( $config['options'], $config['id'] );
			if ( array() === $options ) {
				throw new ConfigException( sprintf( 'Select field "%s" has no options.', $config['id'] ) );
			}
			$this->resolved = $options;
		}

		return $config;
	}

	/**
	 * Options as a list of value/label objects (callables are resolved once per request).
	 *
	 * @return array<int,array{value:string,label:string,disabled:bool,icon?:string}>
	 */
	public function options(): array {
		if ( null === $this->resolved ) {
			$this->resolved = self::normalize_options( (array) call_user_func( $this->config['options'] ), $this->id() );
		}

		return $this->resolved;
	}

	public function rules(): array {
		$rules = parent::rules();

		$allowed = array();
		foreach ( $this->options() as $option ) {
			if ( ! $option['disabled'] ) {
				$allowed[] = $option['value'];
			}
		}
		$rules['allowed'] = $allowed;

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

	/**
	 * Accepts `[ value => label ]` or `[ [ 'value' =>, 'label' =>, 'disabled' =>, 'icon' => ] ]`.
	 *
	 * @param array<mixed> $raw     Developer options.
	 * @param string       $field_id For error messages.
	 * @return array<int,array{value:string,label:string,disabled:bool,icon?:string}>
	 * @throws ConfigException On malformed options.
	 */
	private static function normalize_options( array $raw, string $field_id ): array {
		$list = array();

		foreach ( $raw as $key => $item ) {
			if ( is_array( $item ) ) {
				if ( ! isset( $item['value'], $item['label'] ) ) {
					throw new ConfigException( sprintf( 'Select field "%s": option arrays need `value` and `label`.', $field_id ) );
				}
				$option = array(
					'value'    => (string) $item['value'],
					'label'    => (string) $item['label'],
					'disabled' => ! empty( $item['disabled'] ),
				);
				if ( isset( $item['icon'] ) && '' !== $item['icon'] ) {
					$option['icon'] = (string) $item['icon'];
				}
			} else {
				// PHP turns numeric-string keys into ints: cast back.
				$option = array(
					'value'    => (string) $key,
					'label'    => (string) $item,
					'disabled' => false,
				);
			}
			$list[] = $option;
		}

		return $list;
	}
}
