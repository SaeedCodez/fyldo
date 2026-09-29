<?php
/**
 * Single-line text: `text`, `url`, `email`.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Validation\Digits;

/**
 * Renders an Input. `url` and `email` values are read with ASCII digits (a Persian keyboard types ۰-۹).
 */
final class TextField extends AbstractField {

	public static function types(): array {
		return array( 'text', 'url', 'email' );
	}

	protected function default_layout(): string {
		return 'stacked';
	}

	protected function extra_keys(): array {
		return array( 'placeholder' );
	}

	protected function normalize_type( array $config ): array {
		$rules = $config['validate'];

		// Type-implied rules live in the exported rule set, so the browser mirrors them for free.
		if ( 'url' === $config['type'] && ! isset( $rules['schemes'] ) ) {
			$rules['schemes'] = array( 'http', 'https' );
		}
		if ( 'email' === $config['type'] ) {
			$rules['email'] = true;
		}

		$config['validate']    = $rules;
		$config['placeholder'] = isset( $config['placeholder'] ) ? (string) $config['placeholder'] : '';

		return $config;
	}

	protected function sanitize_value( $raw ) {
		if ( ! is_scalar( $raw ) ) {
			return '';
		}

		$text = sanitize_text_field( (string) $raw );

		if ( 'text' !== $this->type() ) {
			$text = Digits::to_ascii( $text );
		}

		switch ( $this->type() ) {
			case 'url':
				$url = esc_url_raw( $text );
				// A rejected scheme (javascript:, data:…) must surface as a validation error, not become "".
				return '' === $url ? $text : $url;

			case 'email':
				$email = sanitize_email( $text );
				return '' === $email ? $text : $email;

			default:
				return $text;
		}
	}

	protected function client_extra(): array {
		return array(
			'placeholder' => (string) $this->config['placeholder'],
		);
	}
}
