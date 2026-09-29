<?php
/**
 * Admin menu entry + the root element the React app mounts into.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Admin;

use Fyldo\V1\Instance;
use Fyldo\V1\Support\Naming;

/**
 * One admin screen per instance (pages and tabs are client-side routes).
 */
final class Screen {

	public static function register( Instance $instance ): void {
		$config   = $instance->config();
		$menu     = $config['menu'];
		$callback = static function () use ( $instance ): void {
			self::render( $instance );
		};

		if ( 'top' === $menu['type'] ) {
			$hook = add_menu_page(
				$instance->title(),
				(string) $menu['title'],
				(string) $config['capability'],
				$instance->slug(),
				$callback,
				(string) $menu['icon'],
				$menu['position']
			);
		} else {
			$hook = add_submenu_page(
				(string) $menu['parent'],
				$instance->title(),
				(string) $menu['title'],
				(string) $config['capability'],
				$instance->slug(),
				$callback,
				$menu['position']
			);
		}

		if ( is_string( $hook ) ) {
			$instance->set_hook_suffix( $hook );
		}
	}

	/**
	 * Root element. It is deliberately NOT wrapped in `.wrap`: core JS relocates `.notice` elements to just
	 * after the first heading inside `.wrap`, and must never touch the React tree.
	 */
	public static function render( Instance $instance ): void {
		printf(
			'<div id="%1$s" %2$s="%3$s" dir="%4$s" lang="%5$s" class="fyldo-root"></div>',
			esc_attr( Naming::dom_id( $instance->slug() ) ),
			esc_attr( Naming::root_attribute() ),
			esc_attr( $instance->slug() ),
			esc_attr( is_rtl() ? 'rtl' : 'ltr' ),
			esc_attr( str_replace( '_', '-', determine_locale() ) )
		);

		echo '<noscript><p style="padding:24px">' . esc_html__( 'This settings screen needs JavaScript. Please enable it and reload the page.', 'fyldo' ) . '</p></noscript>';
	}

	/**
	 * Adds a body class on Fyldo screens (used to hide the WP footer and remove the content padding).
	 *
	 * @param string    $classes Space-separated body classes.
	 * @param Instance[] $instances All instances.
	 */
	public static function body_class( string $classes, array $instances ): string {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( null === $screen ) {
			return $classes;
		}

		foreach ( $instances as $instance ) {
			if ( '' !== $instance->hook_suffix() && $screen->id === $instance->hook_suffix() ) {
				return $classes . ' fyldo-screen';
			}
		}

		return $classes;
	}
}
