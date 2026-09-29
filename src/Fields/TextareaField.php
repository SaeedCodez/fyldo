<?php
/**
 * Multi-line text.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;

/**
 * Renders a Textarea. With a `max_length` rule it shows the live counter; over the limit is an error, never a truncation.
 */
final class TextareaField extends AbstractField {

	/** Rows the height is authored for: Figma's default 104 px control. */
	const DEFAULT_ROWS = 4;

	public static function types(): array {
		return array( 'textarea' );
	}

	protected function default_layout(): string {
		return 'stacked';
	}

	protected function extra_keys(): array {
		return array( 'placeholder', 'rows', 'resize' );
	}

	protected function normalize_type( array $config ): array {
		$rows = $config['rows'] ?? self::DEFAULT_ROWS;
		if ( ! is_int( $rows ) || $rows < 2 || $rows > 30 ) {
			throw new ConfigException( sprintf( 'Textarea field "%s": `rows` must be a whole number between 2 and 30.', $config['id'] ) );
		}

		$resize = $config['resize'] ?? 'vertical';
		if ( ! in_array( $resize, array( 'vertical', 'none' ), true ) ) {
			throw new ConfigException( sprintf( 'Textarea field "%s": `resize` must be "vertical" or "none".', $config['id'] ) );
		}

		$config['rows']        = $rows;
		$config['resize']      = $resize;
		$config['placeholder'] = isset( $config['placeholder'] ) ? (string) $config['placeholder'] : '';
		$config['default']     = isset( $config['default'] ) ? (string) $config['default'] : '';

		return $config;
	}

	protected function sanitize_value( $raw ) {
		// Keeps line breaks (unlike sanitize_text_field), strips tags and invalid UTF-8.
		return is_scalar( $raw ) ? sanitize_textarea_field( (string) $raw ) : '';
	}

	protected function client_extra(): array {
		return array(
			'placeholder' => (string) $this->config['placeholder'],
			'rows'        => (int) $this->config['rows'],
			'resize'      => (string) $this->config['resize'],
		);
	}
}
