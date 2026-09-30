<?php
/**
 * Plugin Name: Fyldo probe (e2e only)
 * Description: Exposes what the Fyldo Loaders decided, so the coexistence suite can assert it. Never shipped.
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'rest_api_init',
	static function () {
		register_rest_route(
			'fyldo-probe/v1',
			'/state',
			array(
				'methods'             => 'GET',
				'permission_callback' => static function () {
					return current_user_can( 'manage_options' );
				},
				'callback'            => static function () {
					$state = array();
					// Test-only literals: every namespace the fixtures may define.
					foreach ( array( 'Fyldo\\V1', 'Fyldo\\V2', 'Omega\\Vendor\\Fyldo\\V1' ) as $ns ) {
						$loader = $ns . '\\Bootstrap\\Loader';
						if ( ! class_exists( $loader, false ) ) {
							continue;
						}
						$fyldo_files = array_values( preg_grep( '#/src/Fyldo\.php$#', get_included_files() ) );
						$state[ $ns ] = array(
							'version'  => $loader::loaded_version(),
							'path'     => $loader::loaded_path(),
							'copies'   => $loader::copies(),
							'included' => array_values(
								array_filter(
									$fyldo_files,
									static function ( $file ) use ( $loader ) {
										// A copy's Fyldo.php belongs to a namespace if its source declares it.
										$head = (string) file_get_contents( $file, false, null, 0, 400 ); // phpcs:ignore
										return false !== strpos( $head, 'namespace ' . substr( $loader, 0, strrpos( $loader, '\\Bootstrap' ) ) . ';' );
									}
								)
							),
						);
					}
					return $state;
				},
			)
		);
	}
);

add_action(
	'rest_api_init',
	static function () {
		register_rest_route(
			'fyldo-probe/v1',
			'/reset',
			array(
				'methods'             => 'POST',
				'permission_callback' => static function () {
					return current_user_can( 'manage_options' );
				},
				'callback'            => static function () {
					global $wpdb;
					// Every fixture instance stores `acme-<name>_<page>`.
					$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE 'acme-%\\_general' OR option_name LIKE 'acme-%\\_fields' OR option_name LIKE 'acme-%\\_advanced'" ); // phpcs:ignore
					wp_cache_flush();
					return array( 'reset' => true );
				},
			)
		);
	}
);
