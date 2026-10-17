<?php
/**
 * Admin menu entry + the root element the React app mounts into.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Admin;

use Fyldo\V1\Instance;
use Fyldo\V1\Support\Naming;
use Fyldo\V1\Support\Theme;

/**
 * One admin screen per instance (pages and tabs are client-side routes).
 */
final class Screen {

	/** The hooks admin-header.php prints notices on, inside `#wpbody-content` and above the root. */
	const NOTICE_HOOKS = array( 'admin_notices', 'network_admin_notices', 'user_admin_notices', 'all_admin_notices' );

	public static function register( Instance $instance ): void {
		$config   = $instance->config();
		$menu     = $config['menu'];
		$callback = static function () use ( $instance ): void {
			self::render( $instance );
		};

		if ( 'top' === $menu['type'] ) {
			$hook = add_menu_page(
				$instance->title(),
				$instance->menu_title(),
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
				$instance->menu_title(),
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
	 * after the first heading inside `.wrap`, and must never touch the React tree. The plugin's theme is set on it as
	 * custom properties: an inline style beats the token defaults, and reaches everything Fyldo draws (its popovers and
	 * dialogs portal into the root) and nothing outside.
	 */
	public static function render( Instance $instance ): void {
		$style = Theme::style( $instance->theme() );
		printf(
			'<div id="%1$s" %2$s="%3$s" dir="%4$s" lang="%5$s" class="fyldo-root"%6$s></div>',
			esc_attr( Naming::dom_id( $instance->slug() ) ),
			esc_attr( Naming::root_attribute() ),
			esc_attr( $instance->slug() ),
			esc_attr( is_rtl() ? 'rtl' : 'ltr' ),
			esc_attr( str_replace( '_', '-', determine_locale() ) ),
			'' === $style ? '' : ' style="' . esc_attr( $style ) . '"'
		);

		echo '<noscript><p style="padding:24px">' . esc_html__( 'This settings screen needs JavaScript. Please enable it and reload the page.', 'fyldo' ) . '</p></noscript>';
	}

	/**
	 * Adds a body class on Fyldo screens (used to hide the WP footer and remove the content padding).
	 *
	 * @param string     $classes   Space-separated body classes.
	 * @param Instance[] $instances All instances.
	 */
	public static function body_class( string $classes, array $instances ): string {
		return self::is_current( $instances ) ? $classes . ' fyldo-screen' : $classes;
	}

	/**
	 * A Fyldo screen is the app's alone: no admin notice from core (update nag, recovery mode, …) or another plugin is
	 * printed above it. Runs last on `in_admin_header`, just before admin-header.php fires the notice hooks, so it
	 * also catches callbacks added late. The app's own notices go through `Instance::admin_notice()`; app.css hides
	 * whatever still lands next to the root (notices added by JavaScript, the Screen Options and Help tabs).
	 *
	 * @param Instance[] $instances All instances.
	 */
	public static function clear_admin_notices( array $instances ): void {
		if ( ! self::is_current( $instances ) ) {
			return;
		}

		foreach ( self::NOTICE_HOOKS as $hook ) {
			remove_all_actions( $hook );
		}
	}

	/**
	 * Whether the current admin screen belongs to one of the instances.
	 *
	 * @param Instance[] $instances All instances.
	 */
	private static function is_current( array $instances ): bool {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( null === $screen ) {
			return false;
		}

		foreach ( $instances as $instance ) {
			if ( '' !== $instance->hook_suffix() && $screen->id === $instance->hook_suffix() ) {
				return true;
			}
		}

		return false;
	}
}
