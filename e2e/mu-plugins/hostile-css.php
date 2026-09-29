<?php
/**
 * Plugin Name: Hostile admin CSS (e2e only)
 * Description: With ?fyldo_hostile=1 injects unscoped, unlayered admin CSS that tries to break every control. Never shipped.
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'admin_head',
	static function () {
		if ( ! isset( $_GET['fyldo_hostile'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			return;
		}
		$files = array( 'hostile.css' );
		if ( 'important' === $_GET['fyldo_hostile'] ) { // phpcs:ignore WordPress.Security.NonceVerification
			$files[] = 'hostile-important.css';
		}
		foreach ( $files as $file ) {
			echo '<style id="fyldo-' . esc_attr( basename( $file, '.css' ) ) . '">' . file_get_contents( __DIR__ . '/' . $file ) . '</style>'; // phpcs:ignore
		}
	}
);
