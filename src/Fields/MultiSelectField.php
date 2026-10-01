<?php
/**
 * Pick any number of many options (6 or more; fewer fit a checkbox group).
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;

/**
 * Renders a Multi Select: tags in the field, a popup with a search row, checkbox options and a footer with Clear.
 * The value is the list of selected option values, in option order. `validate` accepts `min` / `max` (the number of
 * selected options) besides `required`.
 */
final class MultiSelectField extends AbstractListField {

	public static function types(): array {
		return array( 'multi_select' );
	}

	protected function noun(): string {
		return 'Multi select';
	}

	protected function option_keys(): array {
		return array( 'icon' );
	}

	protected function default_layout(): string {
		return 'field';
	}

	protected function extra_keys(): array {
		return array( 'placeholder', 'options', 'searchable', 'clearable' );
	}

	protected function normalize_type( array $config ): array {
		$config = $this->normalize_list( $config );

		$config['placeholder'] = isset( $config['placeholder'] ) ? (string) $config['placeholder'] : '';
		$config['searchable']  = ! array_key_exists( 'searchable', $config ) || ! empty( $config['searchable'] );
		$config['clearable']   = ! empty( $config['clearable'] );

		$validate = (array) $config['validate'];
		foreach ( array( 'min', 'max' ) as $limit ) {
			if ( isset( $validate[ $limit ] ) && ( ! is_int( $validate[ $limit ] ) || $validate[ $limit ] < 0 ) ) {
				throw new ConfigException( sprintf( 'Multi select "%1$s": `%2$s` must be a whole number of options, 0 or more.', $config['id'], $limit ) );
			}
		}
		if ( isset( $validate['min'], $validate['max'] ) && $validate['min'] > $validate['max'] ) {
			throw new ConfigException( sprintf( 'Multi select "%s": `min` is greater than `max`, so no selection could be valid.', $config['id'] ) );
		}
		if ( isset( $validate['min'] ) && is_array( $config['options'] ) && $validate['min'] > count( $this->enabled_values() ) ) {
			throw new ConfigException( sprintf( 'Multi select "%1$s": `min` is %2$d but only %3$d options can be chosen.', $config['id'], $validate['min'], count( $this->enabled_values() ) ) );
		}

		return $config;
	}

	protected function client_extra(): array {
		return array(
			'placeholder' => (string) $this->config['placeholder'],
			'searchable'  => (bool) $this->config['searchable'],
			'clearable'   => (bool) $this->config['clearable'],
			'options'     => $this->options(),
		);
	}
}
