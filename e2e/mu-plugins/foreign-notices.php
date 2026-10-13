<?php
/**
 * Plugin Name: Foreign admin notices (e2e only)
 * Description: With ?fyldo_foreign=1 plays another plugin on every admin screen: notices on admin_notices and all_admin_notices (one added late, on in_admin_header), a banner on in_admin_header, a settings error, a Help tab and a notice added by JavaScript with an inline display. Never shipped.
 */

defined( 'ABSPATH' ) || exit;

if ( ! isset( $_GET['fyldo_foreign'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
	return;
}

foreach ( array( 'admin_notices', 'all_admin_notices' ) as $fyldo_foreign_hook ) {
	add_action(
		$fyldo_foreign_hook,
		static function () use ( $fyldo_foreign_hook ) {
			echo '<div class="notice notice-warning is-dismissible" data-foreign="' . esc_attr( $fyldo_foreign_hook ) . '"><p>Foreign notice</p></div>';
		}
	);
}

add_action(
	'in_admin_header',
	static function () {
		echo '<div data-foreign="banner">Foreign banner</div>';
		add_action(
			'admin_notices',
			static function () {
				echo '<div class="notice notice-error" data-foreign="late"><p>Foreign notice, added late</p></div>';
			}
		);
	}
);

add_action(
	'admin_init',
	static function () {
		add_settings_error( 'fyldo-foreign', 'foreign', 'Foreign settings error' );
	}
);

add_action(
	'current_screen',
	static function ( $screen ) {
		$screen->add_help_tab(
			array(
				'id'      => 'fyldo-foreign',
				'title'   => 'Foreign help',
				'content' => '<p>Foreign help</p>',
			)
		);
	}
);

add_action(
	'admin_footer',
	static function () {
		echo '<script>(function(){var n=document.createElement("div");n.className="notice notice-info";n.dataset.foreign="js";n.style.display="block";n.innerHTML="<p>Foreign notice, added by JavaScript</p>";document.getElementById("wpbody-content").prepend(n);})();</script>';
	}
);
