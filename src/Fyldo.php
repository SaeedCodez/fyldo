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
	 */
	public static function init(): void {
		if ( self::$initialized ) {
			return;
		}
		self::$initialized = true;

		add_action( 'init', array( Textdomain::class, 'load' ), 0 );
		add_action( 'admin_menu', array( self::class, 'register_screens' ) );
		add_action( 'rest_api_init', array( self::class, 'register_rest_routes' ) );
		add_action( 'admin_enqueue_scripts', array( self::class, 'enqueue' ) );
		add_filter( 'admin_body_class', array( self::class, 'body_class' ) );
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

	public static function register_screens(): void {
		foreach ( self::$instances as $instance ) {
			Screen::register( $instance );
		}
	}

	public static function register_rest_routes(): void {
		foreach ( self::$instances as $instance ) {
			( new Controller( $instance ) )->register_routes();
		}
	}

	/** @param string $hook Current admin page hook suffix. */
	public static function enqueue( $hook ): void {
		foreach ( self::$instances as $instance ) {
			Assets::enqueue( $instance, (string) $hook );
		}
	}

	/**
	 * @param string $classes Body classes.
	 */
	public static function body_class( $classes ): string {
		return Screen::body_class( (string) $classes, array_values( self::$instances ) );
	}
}
