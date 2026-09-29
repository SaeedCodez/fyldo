<?php
/**
 * Any number of options.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

/**
 * Renders a Checkbox group; the optional `parent` label adds the "all" checkbox that shows Indeterminate.
 * The value is the list of selected option values, in option order.
 */
final class CheckboxGroupField extends AbstractListField {

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

	protected function normalize_type( array $config ): array {
		$config           = $this->normalize_list( $config );
		$config['parent'] = isset( $config['parent'] ) ? (string) $config['parent'] : '';

		return $config;
	}

	protected function client_extra(): array {
		return array(
			'parent'  => (string) $this->config['parent'],
			'options' => $this->options(),
		);
	}
}
