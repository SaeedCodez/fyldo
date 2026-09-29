<?php
/**
 * Version negotiation for one Fyldo major.
 *
 * FROZEN CONTRACT (docs/ARCHITECTURE.md §6.2). The first Fyldo copy loaded on a site defines this class;
 * every other copy — possibly a NEWER one — only calls its public methods. Inside a major:
 *   - the signatures and semantics of register(), on_ready(), boot(), loaded_version(), loaded_path(), copies()
 *     never change; new information travels in the `$meta` array (extra keys are ignored by older Loaders);
 *   - this file may only use PHP 7.4 syntax and core WordPress functions guarded with function_exists();
 *   - it must not depend on any other Fyldo class.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Bootstrap;

/**
 * Registry of bundled copies + winner selection.
 */
final class Loader {

	/** Bump ⇒ a new major. */
	const CONTRACT = 1;

	/**
	 * Registered copies, keyed by real path.
	 *
	 * @var array<string, array{version:string,path:string,requires_php:string,requires_wp:string}>
	 */
	private static $copies = array();

	/** @var bool */
	private static $hooked = false;

	/** @var bool */
	private static $booted = false;

	/** @var array|null */
	private static $winner = null;

	/** @var callable[] */
	private static $callbacks = array();

	/**
	 * Registers one bundled copy. Call as early as possible (plugin load / Composer autoload).
	 *
	 * @param string               $version Semver of the copy, e.g. "1.4.2" or "1.5.0-beta.1".
	 * @param string               $path    Absolute directory of the copy (contains src/).
	 * @param array<string,string> $meta    Optional: requires_php, requires_wp. Unknown keys are ignored.
	 */
	public static function register( string $version, string $path, array $meta = array() ): void {
		$real = realpath( $path );
		$key  = false !== $real ? $real : $path;

		if ( isset( self::$copies[ $key ] ) ) {
			return;
		}

		self::$copies[ $key ] = array(
			'version'      => $version,
			'path'         => $key,
			'requires_php' => isset( $meta['requires_php'] ) ? (string) $meta['requires_php'] : '7.4',
			'requires_wp'  => isset( $meta['requires_wp'] ) ? (string) $meta['requires_wp'] : '6.5',
		);

		if ( self::$booted ) {
			// A copy registered after the winner was chosen cannot change the outcome.
			if ( function_exists( '_doing_it_wrong' ) ) {
				_doing_it_wrong(
					__METHOD__,
					sprintf(
						'Fyldo %1$s (%2$s) registered too late; %3$s is already active. Register before the plugins_loaded action.',
						$version,
						$key,
						(string) self::loaded_version()
					),
					'1.0.0'
				);
			}
			return;
		}

		if ( ! self::$hooked ) {
			self::$hooked = true;

			if ( function_exists( 'did_action' ) && did_action( 'plugins_loaded' ) ) {
				self::boot();
			} elseif ( function_exists( 'add_action' ) ) {
				add_action( 'plugins_loaded', array( __CLASS__, 'boot' ), 0 );
			}
		}
	}

	/**
	 * Chooses the highest eligible copy, registers its autoloader and runs the ready callbacks.
	 * Idempotent; normally called by WordPress on plugins_loaded, priority 0.
	 */
	public static function boot(): void {
		if ( self::$booted ) {
			return;
		}
		self::$booted = true;

		$eligible = array();
		foreach ( self::$copies as $copy ) {
			if ( self::is_eligible( $copy ) ) {
				$eligible[] = $copy;
			}
		}

		if ( array() === $eligible ) {
			self::report_no_eligible_copy();
			return;
		}

		usort(
			$eligible,
			static function ( array $a, array $b ): int {
				$by_version = version_compare( $b['version'], $a['version'] );
				return 0 !== $by_version ? $by_version : strcmp( $a['path'], $b['path'] );
			}
		);

		self::$winner = $eligible[0];
		self::register_autoloader( self::$winner['path'] );

		$callbacks       = self::$callbacks;
		self::$callbacks = array();
		foreach ( $callbacks as $callback ) {
			call_user_func( $callback );
		}
	}

	/**
	 * Runs $callback once the winner is active (immediately if it already is).
	 *
	 * @param callable $callback No arguments.
	 */
	public static function on_ready( callable $callback ): void {
		if ( ! self::$booted ) {
			self::$callbacks[] = $callback;
			return;
		}

		if ( null !== self::$winner ) {
			call_user_func( $callback );
		}
	}

	/** Version of the active copy, or null before boot / when none is eligible. */
	public static function loaded_version(): ?string {
		return null !== self::$winner ? self::$winner['version'] : null;
	}

	/** Directory of the active copy, or null. */
	public static function loaded_path(): ?string {
		return null !== self::$winner ? self::$winner['path'] : null;
	}

	/**
	 * Diagnostics: every registered copy.
	 *
	 * @return array<int, array{version:string,path:string,requires_php:string,requires_wp:string}>
	 */
	public static function copies(): array {
		return array_values( self::$copies );
	}

	/**
	 * @param array{requires_php:string,requires_wp:string} $copy Copy record.
	 */
	private static function is_eligible( array $copy ): bool {
		if ( version_compare( PHP_VERSION, $copy['requires_php'], '<' ) ) {
			return false;
		}

		global $wp_version;
		if ( isset( $wp_version ) && version_compare( (string) $wp_version, $copy['requires_wp'], '<' ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Registers a PSR-4 autoloader for this major's namespace, prepended so it beats any Composer loader.
	 * The namespace comes from __NAMESPACE__ (never a literal), so a Strauss-prefixed copy maps its own prefix.
	 */
	private static function register_autoloader( string $path ): void {
		$prefix = substr( __NAMESPACE__, 0, (int) strrpos( __NAMESPACE__, '\\' ) ) . '\\';
		$length = strlen( $prefix );
		$base   = $path . '/src/';

		spl_autoload_register(
			static function ( string $class ) use ( $prefix, $length, $base ): void {
				if ( 0 !== strncmp( $class, $prefix, $length ) ) {
					return;
				}

				$file = $base . str_replace( '\\', '/', substr( $class, $length ) ) . '.php';
				if ( is_file( $file ) ) {
					require_once $file;
				}
			},
			true,
			true
		);
	}

	private static function report_no_eligible_copy(): void {
		if ( ! function_exists( 'add_action' ) ) {
			return;
		}

		add_action(
			'admin_notices',
			static function (): void {
				if ( ! current_user_can( 'activate_plugins' ) ) {
					return;
				}
				echo '<div class="notice notice-error"><p>';
				echo esc_html( 'Fyldo could not start: no bundled copy is compatible with this site\'s PHP and WordPress versions.' );
				echo '</p></div>';
			}
		);
	}
}
