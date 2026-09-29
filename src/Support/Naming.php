<?php
/**
 * Every runtime-global identifier, derived from the instance slug and this copy's namespace.
 * Nothing here is a literal namespace: a Strauss-prefixed copy derives its own names.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Support;

/**
 * Slug/namespace → identifier derivations (docs/ARCHITECTURE.md §6.5).
 */
final class Naming {

	const SLUG_PATTERN = '/^[a-z][a-z0-9-]{2,39}$/';
	const PAGE_REGEX   = '[a-z0-9][a-z0-9_-]{0,39}';
	const PAGE_PATTERN = '/^' . self::PAGE_REGEX . '$/';

	/** Root namespace of this copy, e.g. "Fyldo\V1" or "Acme\Vendor\Fyldo\V1". */
	public static function ns(): string {
		return substr( __NAMESPACE__, 0, (int) strrpos( __NAMESPACE__, '\\' ) );
	}

	/** Major version taken from the namespace tail ("V1" → 1). */
	public static function major(): int {
		return 1 === preg_match( '/V(\d+)$/', self::ns(), $m ) ? (int) $m[1] : 0;
	}

	/** Lower-cased namespace joined with dashes: "fyldo-v1" / "acme-vendor-fyldo-v1". */
	public static function vendor_slug(): string {
		return strtolower( str_replace( '\\', '-', self::ns() ) );
	}

	public static function is_valid_slug( string $slug ): bool {
		return 1 === preg_match( self::SLUG_PATTERN, $slug );
	}

	public static function is_valid_page_id( string $page ): bool {
		return 1 === preg_match( self::PAGE_PATTERN, $page );
	}

	/** Default option name: literal `{slug}_{page}` — the stored data belongs to the consuming plugin. */
	public static function option( string $slug, string $page ): string {
		return $slug . '_' . $page;
	}

	/**
	 * REST namespace `fyldo-{slug}/v{major}`.
	 *
	 * @return non-falsy-string
	 */
	public static function rest_namespace( string $slug ): string {
		return self::non_falsy( 'fyldo-' . $slug . '/v' . self::major() );
	}

	public static function handle( string $slug, string $version ): string {
		return 'fyldo-' . $slug . '-' . $version;
	}

	public static function fonts_handle( string $slug, string $version ): string {
		return 'fyldo-' . $slug . '-fonts-' . $version;
	}

	/** Name of the single window property that carries the config (read + deleted by the app on boot). */
	public static function config_var( string $slug ): string {
		return '__fyldo_' . str_replace( '-', '_', $slug ) . '__';
	}

	/** Per-instance nonce action (in addition to core's `wp_rest`). */
	public static function nonce_action( string $slug ): string {
		return 'fyldo_' . $slug . '_rest';
	}

	public static function nonce_header(): string {
		return 'X-Fyldo-Nonce';
	}

	/**
	 * Per-instance hook name `fyldo/{slug}/{event}`; never empty, so it can be handed to apply_filters()/do_action().
	 *
	 * @return non-empty-string
	 */
	public static function hook( string $slug, string $event ): string {
		return self::non_empty( 'fyldo/' . $slug . '/' . $event );
	}

	public static function dom_id( string $slug ): string {
		return 'fyldo-' . $slug . '-root';
	}

	/** Name of the root attribute (static per major because the built CSS is shared). */
	public static function root_attribute(): string {
		return 'data-fyldo-v' . self::major();
	}

	/**
	 * Runtime guard behind the non-empty return types: an identifier must never be empty.
	 *
	 * @return non-empty-string
	 * @throws \LogicException When the value is empty.
	 */
	private static function non_empty( string $value ): string {
		if ( '' === $value ) {
			throw new \LogicException( 'Fyldo built an empty identifier.' );
		}

		return $value;
	}

	/**
	 * Like non_empty(), and not "0" either (WordPress rejects falsy namespaces).
	 *
	 * @return non-falsy-string
	 * @throws \LogicException When the value is empty or "0".
	 */
	private static function non_falsy( string $value ): string {
		if ( '' === $value || '0' === $value ) {
			throw new \LogicException( 'Fyldo built an empty identifier.' );
		}

		return $value;
	}
}
