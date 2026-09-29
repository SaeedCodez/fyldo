<?php
/**
 * Exactly one of 2–5 visible options.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Instance;
use Fyldo\V1\Schema\ConfigException;

/**
 * Renders a Radio group. A radio group always has a selection, so `default` is required.
 */
final class RadioField extends AbstractOptionsField {

	/** More visible choices than this belong in a Select (design-spec rule 14). */
	const MAX_VISIBLE = 5;

	public static function types(): array {
		return array( 'radio' );
	}

	protected function noun(): string {
		return 'Radio';
	}

	protected function option_keys(): array {
		return array( 'description' );
	}

	protected function default_layout(): string {
		return 'stacked';
	}

	protected function extra_keys(): array {
		return array( 'options' );
	}

	protected function normalize_type( array $config ): array {
		$config  = $this->normalize_options( $config );
		$default = isset( $config['default'] ) && is_scalar( $config['default'] ) ? (string) $config['default'] : '';

		if ( '' === $default ) {
			throw new ConfigException( sprintf( 'Radio field "%s" needs a `default`: a radio group always has one option selected.', $config['id'] ) );
		}
		$config['default'] = $default;

		if ( is_array( $config['options'] ) ) {
			$count = count( $this->options() );
			if ( $count < 2 ) {
				throw new ConfigException( sprintf( 'Radio field "%s" needs at least two options.', $config['id'] ) );
			}
			if ( ! in_array( $default, $this->enabled_values(), true ) ) {
				throw new ConfigException( sprintf( 'Radio field "%1$s": the default "%2$s" is not one of its enabled options.', $config['id'], $default ) );
			}
			if ( $count > self::MAX_VISIBLE ) {
				Instance::doing_it_wrong(
					sprintf( 'Fyldo radio field "%s"', $config['id'] ),
					'A radio group shows every option at once; from six options on use a `select` field.'
				);
			}
		}

		return $config;
	}

	/** A radio group is never empty: the browser mirrors `required` too. */
	public function rules(): array {
		$rules             = parent::rules();
		$rules['required'] = true;
		$rules['allowed']  = $this->enabled_values();

		return $rules;
	}

	protected function sanitize_value( $raw ) {
		return is_scalar( $raw ) ? sanitize_text_field( (string) $raw ) : '';
	}

	protected function client_extra(): array {
		return array(
			'options' => $this->options(),
		);
	}
}
