<?php
/**
 * The JavaScript a developer hands Fyldo: the ES module of a custom field or a custom page, its stylesheet, its props.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Support;

/**
 * The one place that says what a module URL and module props may be (CustomField and CustomPage share the rules).
 */
final class Module {

	/**
	 * An http(s) URL or a path from the site root; '' when it is neither.
	 *
	 * @param mixed $url Developer value.
	 */
	public static function url( $url ): string {
		if ( ! is_string( $url ) ) {
			return '';
		}
		$url = trim( $url );
		if ( 1 !== preg_match( '#^(https?://|/(?!/))#i', $url ) ) {
			return '';
		}

		return esc_url_raw( $url, array( 'http', 'https' ) );
	}

	/**
	 * Whether a value can be a module's `props`: an array keyed by name (or empty) holding only plain data.
	 *
	 * @param mixed $props Developer value.
	 */
	public static function is_props( $props ): bool {
		return is_array( $props ) && ( array() === $props || array_values( $props ) !== $props ) && self::is_json( $props );
	}

	/**
	 * Whether a value is plain data (what JSON can carry): no objects, no callbacks.
	 *
	 * @param mixed $value Value.
	 */
	public static function is_json( $value ): bool {
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
}
