<?php
/**
 * Plugin Name: Fyldo e2e locale switch
 * Description: With ?fyldo_locale=fa_IR the request runs as Persian/RTL without installing a language pack. Never shipped.
 */

defined( 'ABSPATH' ) || exit;

if ( isset( $_GET['fyldo_locale'] ) && 'fa_IR' === $_GET['fyldo_locale'] ) { // phpcs:ignore WordPress.Security.NonceVerification
	add_filter(
		'locale',
		static function () {
			return 'fa_IR';
		}
	);
	// WordPress derives is_rtl() from the core "text direction" string of the active language pack.
	add_filter(
		'gettext_with_context',
		static function ( $translation, $text, $context ) {
			return ( 'text direction' === $context && 'ltr' === $text ) ? 'rtl' : $translation;
		},
		10,
		3
	);
}
