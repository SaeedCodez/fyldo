<?php
/**
 * Plugin Name:       Fyldo
 * Description:       Settings-page framework for WordPress plugin developers. Declare pages, sections and fields in PHP; get a modern admin UI with REST-backed validation and saving.
 * Version:           1.0.0-beta.3
 * Requires at least: 6.5
 * Requires PHP:      7.4
 * Author:            Fyldo
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       fyldo
 *
 * This ONE file is the plugin main file, the drop-in include (`require_once __DIR__ . '/fyldo/fyldo.php';`)
 * and the Composer `files` autoload entry. It must stay tiny and may only use the frozen
 * Loader contract (register, on_ready): an OLDER copy's Loader may be the one that is loaded.
 * See docs/ARCHITECTURE.md §6.
 *
 * @package Fyldo
 */

namespace Fyldo\V1;

// Direct access / non-WordPress CLI (e.g. a consumer's PHPUnit or PHPStan loading Composer's autoloader): do nothing.
// A top-level `return` is as safe as `exit` here (nothing has run yet) and does not kill unrelated tools that
// include this file through Composer's `files` autoload.
if ( ! defined( 'ABSPATH' ) ) {
	return;
}

// The first copy loaded defines the Loader; later copies only call register().
// `Loader::class` is a compile-time constant (no autoload, no string): Strauss-safe.
if ( ! class_exists( Bootstrap\Loader::class, false ) ) {
	require_once __DIR__ . '/src/Bootstrap/Loader.php';
}

// A closure keeps the file scope free of variables (this file may run in the global scope).
( static function () {
	$data = \get_file_data( __FILE__, array( 'Version' => 'Version' ) );

	Bootstrap\Loader::register(
		'' !== $data['Version'] ? $data['Version'] : '0.0.0',
		__DIR__,
		array(
			'requires_php' => '7.4',
			'requires_wp'  => '6.5',
		)
	);

	// Every copy queues the same idempotent init; it runs the WINNER's Fyldo class.
	Bootstrap\Loader::on_ready(
		static function () {
			Fyldo::init();
		}
	);

	// Installed as a plugin (this folder sits directly in the plugins folder): add the demo dashboard. A drop-in
	// copy (plugins/acme/fyldo) or a Composer package (plugins/acme/vendor/fyldo/fyldo) has another parent folder,
	// so it never loads it (and only one copy can be the plugin, so the demo class is defined once).
	$plugins = \defined( 'WP_PLUGIN_DIR' ) ? \realpath( WP_PLUGIN_DIR ) : false;
	$demo    = __DIR__ . '/demo/demo.php';
	if ( false !== $plugins && \wp_normalize_path( \dirname( __DIR__ ) ) === \wp_normalize_path( $plugins ) && \is_readable( $demo ) ) {
		require_once $demo;
		Demo\Demo::boot( __FILE__ );
	}
} )();
