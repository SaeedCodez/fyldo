<?php
/**
 * A field the developer draws with their own JavaScript module (React or plain DOM).
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;

/**
 * Fyldo draws the row (title, description, error) and loads `module`, an ES module whose default export draws the
 * control (docs/custom-fields.md). The value is any JSON value; without a `sanitize_cb` it is cleaned like text, all the
 * way down (tags stripped, line breaks kept). `props` reach the module as they are: translated labels, option lists.
 */
final class CustomField extends AbstractField {

	/** Arrays deeper than this are cut: a value is settings, not a document. */
	const MAX_DEPTH = 8;

	public static function types(): array {
		return array( 'custom' );
	}

	protected function default_layout(): string {
		return 'field';
	}

	protected function fallback_default() {
		return null;
	}

	protected function extra_keys(): array {
		return array( 'module', 'style', 'props' );
	}

	/** URL of the stylesheet to enqueue with the screen; '' = none. */
	public function style(): string {
		return (string) $this->config['style'];
	}

	protected function normalize_type( array $config ): array {
		$id = (string) $config['id'];

		$module = self::clean_url( $config['module'] ?? '' );
		if ( '' === $module ) {
			throw new ConfigException( sprintf( 'Custom field "%s": `module` must be the URL of its JavaScript module (http(s), or a path starting with "/").', $id ) );
		}

		$style = $config['style'] ?? '';
		if ( '' !== $style ) {
			$style = self::clean_url( $style );
			if ( '' === $style ) {
				throw new ConfigException( sprintf( 'Custom field "%s": `style` must be the URL of a stylesheet (http(s), or a path starting with "/").', $id ) );
			}
		}

		$props = $config['props'] ?? array();
		if ( ! is_array( $props ) || ( array() !== $props && array_values( $props ) === $props ) || ! self::is_json( $props ) ) {
			throw new ConfigException( sprintf( 'Custom field "%s": `props` must be an array keyed by name, holding only text, numbers, booleans, null and arrays.', $id ) );
		}

		$config['module'] = $module;
		$config['style']  = $style;
		$config['props']  = $props;
		if ( array_key_exists( 'default', $config ) ) {
			$config['default'] = $this->sanitize_value( $config['default'] );
		}

		return $config;
	}

	protected function sanitize_value( $raw ) {
		return self::clean( $raw, 0 );
	}

	protected function client_extra(): array {
		return array(
			'module' => (string) $this->config['module'],
			// An object even when empty, so the browser always gets `{}`, never `[]`.
			'props'  => (object) $this->config['props'],
		);
	}

	/**
	 * Any JSON value, with every string (and key) cleaned like a textarea's text. Anything else becomes null.
	 *
	 * @param mixed $value Raw value.
	 * @param int   $depth How deep `$value` sits.
	 * @return mixed
	 */
	private static function clean( $value, int $depth ) {
		if ( is_string( $value ) ) {
			return sanitize_textarea_field( $value );
		}
		if ( is_bool( $value ) || is_int( $value ) || null === $value ) {
			return $value;
		}
		if ( is_float( $value ) ) {
			return is_finite( $value ) ? $value : null;
		}
		if ( ! is_array( $value ) || $depth >= self::MAX_DEPTH ) {
			return null;
		}

		$out = array();
		foreach ( $value as $key => $item ) {
			$out[ is_int( $key ) ? $key : sanitize_text_field( (string) $key ) ] = self::clean( $item, $depth + 1 );
		}

		return $out;
	}

	/**
	 * Whether a value is plain data (what JSON can carry): no objects, no callbacks.
	 *
	 * @param mixed $value Value.
	 */
	private static function is_json( $value ): bool {
		if ( is_array( $value ) ) {
			foreach ( $value as $item ) {
				if ( ! self::is_json( $item ) ) {
					return false;
				}
			}
			return true;
		}

		return null === $value || ( is_scalar( $value ) && ( ! is_float( $value ) || is_finite( $value ) ) );
	}

	/**
	 * An http(s) URL or a path from the site root; '' when it is neither.
	 *
	 * @param mixed $url Developer value.
	 */
	private static function clean_url( $url ): string {
		if ( ! is_string( $url ) ) {
			return '';
		}
		$url = trim( $url );
		if ( 1 !== preg_match( '#^(https?://|/(?!/))#i', $url ) ) {
			return '';
		}

		return esc_url_raw( $url, array( 'http', 'https' ) );
	}
}
