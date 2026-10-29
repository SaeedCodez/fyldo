<?php
/**
 * Public facade. Consumers call Fyldo::create() on `init` (any distribution mode).
 *
 * @package Fyldo
 */

namespace Fyldo\V1;

use Fyldo\V1\Admin\Screen;
use Fyldo\V1\Assets\Assets;
use Fyldo\V1\I18n\Textdomain;
use Fyldo\V1\Rest\Controller;
use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Support\Icons;
use Fyldo\V1\Support\Naming;

/**
 * Registry of instances + the shared WordPress hooks (registered once, whichever copy runs).
 */
final class Fyldo {

	/** @var array<string,Instance> */
	private static $instances = array();

	/** @var bool */
	private static $initialized = false;

	/**
	 * Registers the shared hooks. Idempotent; called by every bundled copy through Loader::on_ready().
	 *
	 * @internal
	 */
	public static function init(): void {
		if ( self::$initialized ) {
			return;
		}
		self::$initialized = true;

		add_action( 'init', array( Textdomain::class, 'load' ), 0 );
		add_action( 'admin_menu', array( self::class, 'register_screens' ) );
		add_action( 'rest_api_init', array( self::class, 'register_rest_routes' ) );
		add_action( 'admin_init', array( self::class, 'register_ajax' ) );
		add_action( 'admin_enqueue_scripts', array( self::class, 'enqueue' ) );
		add_filter( 'admin_body_class', array( self::class, 'body_class' ) );
		add_action( 'in_admin_header', array( self::class, 'clear_admin_notices' ), PHP_INT_MAX );
	}

	/**
	 * Creates (and registers) an instance.
	 *
	 * @param string              $slug   Unique slug, `^[a-z][a-z0-9-]{2,39}$` — prefix it with your vendor name.
	 * @param array<string,mixed> $config Instance config (title, version, capability, navigation, menu, links).
	 * @throws ConfigException When the slug or the config is invalid.
	 */
	public static function create( string $slug, array $config = array() ): Instance {
		if ( ! Naming::is_valid_slug( $slug ) ) {
			throw new ConfigException( sprintf( 'Fyldo slug "%s" is invalid: 3–40 characters, lower-case letters, digits and "-", starting with a letter.', $slug ) );
		}

		if ( isset( self::$instances[ $slug ] ) ) {
			Instance::doing_it_wrong( __METHOD__, sprintf( 'A Fyldo instance with the slug "%s" already exists; returning it. Slugs must be unique per site.', $slug ) );

			return self::$instances[ $slug ];
		}

		self::$instances[ $slug ] = new Instance( $slug, $config );

		return self::$instances[ $slug ];
	}

	/**
	 * @throws \OutOfBoundsException When no instance has that slug.
	 */
	public static function instance( string $slug ): Instance {
		if ( ! isset( self::$instances[ $slug ] ) ) {
			throw new \OutOfBoundsException( sprintf( 'No Fyldo instance "%s". Create it on `init` with Fyldo::create().', $slug ) );
		}

		return self::$instances[ $slug ];
	}

	/** @return array<string,Instance> */
	public static function instances(): array {
		return self::$instances;
	}

	/**
	 * One Iconsax icon as `<svg>` markup, for pages Fyldo does not draw (a site's front end, an email): only that icon is
	 * read, never the whole set. 24×24 viewBox, drawn in `currentColor`, decorative unless `label` is given; no script, no
	 * event handlers. '' when `$name` is not an icon (see is_icon()). Read once per request.
	 *
	 * @param string              $name Iconsax name in kebab case, as the `icon` field stores it (`setting-2`).
	 * @param array<string,mixed> $args `size` (px: width and height; none by default, so CSS sizes it), `class`, `label`.
	 */
	public static function icon( string $name, array $args = array() ): string {
		return Icons::svg( $name, $args );
	}

	/** Whether `$name` is an Iconsax name Fyldo has (kebab case, `setting-2`): to check a stored or submitted icon. */
	public static function is_icon( string $name ): bool {
		return Icons::exists( $name );
	}

	/** @internal */
	public static function register_screens(): void {
		foreach ( self::$instances as $instance ) {
			$instance->check_groups();
			Screen::register( $instance );
		}
	}

	/** @internal */
	public static function register_rest_routes(): void {
		foreach ( self::$instances as $instance ) {
			( new Controller( $instance ) )->register_routes();
		}
	}

	/**
	 * The nonce refresh of every instance (admin-ajax runs `admin_init` before `wp_ajax_{action}`). Logged-in users only.
	 *
	 * @internal
	 */
	public static function register_ajax(): void {
		foreach ( self::$instances as $instance ) {
			$controller = new Controller( $instance );
			add_action( 'wp_ajax_' . Naming::nonce_refresh_action( $instance->slug() ), array( $controller, 'send_nonces' ) );
		}
	}

	/**
	 * @param string $hook Current admin page hook suffix.
	 * @internal
	 */
	public static function enqueue( $hook ): void {
		foreach ( self::$instances as $instance ) {
			Assets::enqueue( $instance, (string) $hook );
		}
	}

	/**
	 * @param string $classes Body classes.
	 * @internal
	 */
	public static function body_class( $classes ): string {
		return Screen::body_class( (string) $classes, array_values( self::$instances ) );
	}

	/**
	 * No WordPress admin notice on a Fyldo screen.
	 *
	 * @internal
	 */
	public static function clear_admin_notices(): void {
		Screen::clear_admin_notices( array_values( self::$instances ) );
	}
}
