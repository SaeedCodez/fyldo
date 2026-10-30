<?php
/**
 * Runs when Fyldo, installed as a plugin, is deleted from the Plugins screen: removes what the demo dashboard left
 * behind (its announcements table, the table's version option, the options of its pages). Plugins built with Fyldo
 * own their options and are never touched. Standalone on purpose: no Fyldo class is loaded here.
 *
 * @package Fyldo
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

( static function () {
	global $wpdb;

	$clean = static function () use ( $wpdb ) {
		// demo/announcements.php: Announcements::table() and DB_OPTION.
		$wpdb->query( 'DROP TABLE IF EXISTS ' . $wpdb->prefix . 'fyldo_demo_announcements' ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery, WordPress.DB.DirectDatabaseQuery.SchemaChange -- the demo's own table, no input.
		delete_option( 'fyldo_demo_announcements_db' );

		// The demo's page options (`fyldo-demo_{page}`) and Fyldo's bookkeeping for it (`fyldo-demo__fyldo`).
		$names = $wpdb->get_col( $wpdb->prepare( "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s", $wpdb->esc_like( 'fyldo-demo_' ) . '%' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		foreach ( $names as $name ) {
			delete_option( $name );
		}
	};

	if ( is_multisite() ) {
		foreach ( get_sites( array( 'fields' => 'ids' ) ) as $site ) {
			switch_to_blog( (int) $site );
			$clean();
			restore_current_blog();
		}
		return;
	}

	$clean();
} )();
