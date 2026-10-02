<?php
/**
 * Enqueues the built app for ONE instance, only on that instance's own screen.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Assets;

use Fyldo\V1\Bootstrap\Loader;
use Fyldo\V1\Fields\AbstractMediaField;
use Fyldo\V1\Instance;
use Fyldo\V1\Support\Naming;

/**
 * Handles, URLs and the inline config for an instance.
 */
final class Assets {

	/**
	 * @param Instance $instance Instance.
	 * @param string   $hook     Current admin page hook suffix.
	 */
	public static function enqueue( Instance $instance, string $hook ): void {
		if ( '' === $instance->hook_suffix() || $hook !== $instance->hook_suffix() ) {
			return;
		}

		$version = Loader::loaded_version();
		$path    = Loader::loaded_path();
		if ( null === $version || null === $path ) {
			return;
		}

		$slug = $instance->slug();

		/**
		 * Filters the URL of Fyldo's `assets/dist` directory (escape hatch for symlinked or unusual installs).
		 *
		 * @param string $url  Resolved URL ('' when it could not be determined).
		 * @param string $path Absolute path of the active Fyldo copy.
		 */
		$base = (string) apply_filters( Naming::hook( $slug, 'assets_url' ), Url::for_path( $path . '/assets/dist' ), $path );
		if ( '' === $base ) {
			Instance::doing_it_wrong( __METHOD__, sprintf( 'Fyldo could not work out the URL of its assets (%s). Filter `%s` to provide it.', $path, Naming::hook( $slug, 'assets_url' ) ) );
			return;
		}

		$handle       = Naming::handle( $slug, $version );
		$fonts_handle = Naming::fonts_handle( $slug, $version );
		$cache_bust   = self::cache_bust( $version, $path . '/assets/dist/boot.js' );

		wp_register_style( $fonts_handle, $base . '/fonts.css', array(), $cache_bust );
		wp_register_style( $handle, $base . '/app.css', array( $fonts_handle ), $cache_bust );
		wp_enqueue_style( $handle );

		// The native media modal (wp.media) for the `image` and `file` fields: only on a screen that has one.
		if ( self::has_media_field( $instance ) && function_exists( 'wp_enqueue_media' ) ) {
			wp_enqueue_media();
		}

		wp_register_script(
			$handle,
			$base . '/boot.js',
			array(),
			$cache_bust,
			array(
				'strategy'  => 'defer',
				'in_footer' => true,
			)
		);

		// `<` `>` `&` `'` `"` are hex-escaped so no value can close the inline <script>.
		$json = wp_json_encode( ClientConfig::build( $instance ), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE );
		wp_add_inline_script( $handle, 'window.' . Naming::config_var( $slug ) . '=' . $json . ';', 'before' );
		wp_enqueue_script( $handle );
	}

	/** Whether any page of the instance has an `image` or `file` field. */
	private static function has_media_field( Instance $instance ): bool {
		foreach ( $instance->pages() as $page ) {
			foreach ( $page->fields() as $field ) {
				if ( $field instanceof AbstractMediaField ) {
					return true;
				}
			}
		}

		return false;
	}

	/** Development builds (`-dev`) bust the cache with the file time. */
	private static function cache_bust( string $version, string $file ): string {
		if ( false !== strpos( $version, 'dev' ) && is_readable( $file ) ) {
			return $version . '.' . (string) filemtime( $file );
		}

		return $version;
	}
}
