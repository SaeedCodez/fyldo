<?php
/**
 * Write-only secret: passwords, API keys, tokens.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;

/**
 * Renders an Input (`type="password"`). The stored value never goes to the browser: the browser learns only whether
 * one is set (value `null`) or not (`''`). On save `null` keeps what is stored, `''` clears it, anything else replaces
 * it. The value is stored and returned by `Instance::get()` exactly as typed (never trimmed or altered).
 */
final class PasswordField extends AbstractField {

	/** `autocomplete` tokens that make sense for a settings secret. */
	const AUTOCOMPLETE = array( 'new-password', 'current-password', 'off' );

	public static function types(): array {
		return array( 'password' );
	}

	protected function default_layout(): string {
		return 'stacked';
	}

	protected function extra_keys(): array {
		return array( 'placeholder', 'autocomplete' );
	}

	protected function normalize_type( array $config ): array {
		if ( array_key_exists( 'default', $config ) ) {
			throw new ConfigException( sprintf( 'Password field "%s" cannot have a `default`: it is write-only and never sent to the browser.', $config['id'] ) );
		}

		// `new-password` keeps browsers from filling the site owner's own login password into an API-key field.
		$autocomplete = isset( $config['autocomplete'] ) ? (string) $config['autocomplete'] : 'new-password';
		if ( ! in_array( $autocomplete, self::AUTOCOMPLETE, true ) ) {
			throw new ConfigException( sprintf( 'Password field "%1$s": `autocomplete` must be one of %2$s.', $config['id'], implode( ', ', self::AUTOCOMPLETE ) ) );
		}

		$config['autocomplete'] = $autocomplete;
		$config['placeholder']  = isset( $config['placeholder'] ) ? (string) $config['placeholder'] : '';

		return $config;
	}

	public function keeps_stored( $raw ): bool {
		return ! is_string( $raw ) && ! is_int( $raw ) && ! is_float( $raw );
	}

	protected function sanitize_value( $raw ) {
		return is_scalar( $raw ) ? (string) $raw : '';
	}

	public function client_value( $value ) {
		return '' === (string) $value ? '' : null;
	}

	protected function client_extra(): array {
		return array(
			'placeholder'  => (string) $this->config['placeholder'],
			'autocomplete' => (string) $this->config['autocomplete'],
		);
	}
}
