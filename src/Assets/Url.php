<?php
/**
 * Absolute filesystem path → public URL, for a copy of Fyldo that can live anywhere under wp-content
 * (plugin, mu-plugin, theme, Composer vendor dir inside a plugin).
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Assets;

/**
 * Path→URL resolver.
 */
final class Url {

	/**
	 * @param string $absolute Absolute path to a file or directory.
	 * @return string URL, or '' when the path is outside every WordPress content root.
	 */
	public static function for_path( string $absolute ): string {
		$path = wp_normalize_path( $absolute );

		$roots = array(
			array( WP_PLUGIN_DIR, plugins_url() ),
			array( WPMU_PLUGIN_DIR, content_url( 'mu-plugins' ) ),
			array( get_theme_root(), get_theme_root_uri() ),
			array( WP_CONTENT_DIR, content_url() ),
			array( ABSPATH, site_url( '/' ) ),
		);

		foreach ( $roots as $root ) {
			foreach ( array_unique( array( wp_normalize_path( $root[0] ), wp_normalize_path( (string) realpath( $root[0] ) ) ) ) as $dir ) {
				$dir = untrailingslashit( $dir );
				if ( '' !== $dir && 0 === strpos( $path . '/', $dir . '/' ) ) {
					return untrailingslashit( $root[1] ) . substr( $path, strlen( $dir ) );
				}
			}
		}

		return '';
	}
}
