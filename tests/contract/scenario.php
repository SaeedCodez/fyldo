<?php
/**
 * One Loader negotiation, in a fresh PHP process (the Loader class can only be defined once). Started by run.php.
 *
 * Argument: JSON `{ copies: [ { dir, version } ], winner: { dir, version } }`, the copies in registration order. Each copy
 * does what its fyldo.php does (docs/ARCHITECTURE.md §6.2): define the Loader if no copy has yet, register(), on_ready().
 * Then plugins_loaded runs boot() and the checks below. Prints "ok", or the failed checks and exits 1.
 *
 * @package Fyldo
 */

error_reporting( E_ALL );
set_error_handler(
	static function ( int $severity, string $message, string $file, int $line ): bool {
		throw new ErrorException( $message, 0, $severity, $file, $line );
	}
);

// The WordPress functions the Loader guards with function_exists(), stubbed as in tests/php/Unit/LoaderTest.php.
$GLOBALS['fyldo_contract'] = array(
	'actions' => array(),
	'wrong'   => array(),
);

function add_action( $hook, $callback, $priority = 10, $accepted_args = 1 ) {
	$GLOBALS['fyldo_contract']['actions'][] = array( $hook, $callback, $priority );
	return true;
}

function did_action( $hook ) {
	return 0;
}

function _doing_it_wrong( $function_name, $message, $version ) {
	$GLOBALS['fyldo_contract']['wrong'][] = $message;
}

function esc_html( $text ) {
	return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
}

$spec     = json_decode( (string) ( $argv[1] ?? '' ), true );
$failures = array();
$check    = static function ( bool $ok, string $what ) use ( &$failures ): void {
	if ( ! $ok ) {
		$failures[] = $what;
	}
};

if ( ! is_array( $spec ) || empty( $spec['copies'] ) || empty( $spec['winner'] ) ) {
	echo "usage: php scenario.php '{\"copies\":[{\"dir\":…,\"version\":…}],\"winner\":{…}}'\n";
	exit( 1 );
}

$loader  = 'Fyldo\\V1\\Bootstrap\\Loader';
$copies  = $spec['copies'];
$winner  = (string) realpath( $spec['winner']['dir'] );
$definer = (string) realpath( $copies[0]['dir'] . '/src/Bootstrap/Loader.php' );
$ran     = array();

try {
	foreach ( $copies as $i => $copy ) {
		// fyldo.php: the first copy loaded defines the Loader, every copy registers and queues its init.
		if ( ! class_exists( $loader, false ) ) {
			require_once $copy['dir'] . '/src/Bootstrap/Loader.php';
		}
		// An extra `$meta` key: new information travels there, and an older Loader must ignore it.
		$loader::register(
			$copy['version'],
			$copy['dir'],
			array(
				'requires_php' => '7.4',
				'requires_wp'  => '6.5',
				'from_future'  => 'ignored',
			)
		);
		$ran[ $i ] = 0;
		$loader::on_ready(
			static function () use ( &$ran, $i ): void {
				++$ran[ $i ];
			}
		);
	}

	$check( (string) ( new ReflectionClass( $loader ) )->getFileName() === $definer, 'the first copy registered defines the Loader class' );
	$check( 1 === $loader::CONTRACT, 'Loader::CONTRACT is 1' );

	$distinct = array();
	foreach ( $copies as $copy ) {
		$distinct[ (string) realpath( $copy['dir'] ) ] = true;
	}
	$check( count( $distinct ) === count( $loader::copies() ), sprintf( 'copies() lists %d copies (got %d)', count( $distinct ), count( $loader::copies() ) ) );

	// Before plugins_loaded: nothing is chosen and no callback ran; boot is hooked once, on plugins_loaded, priority 0.
	$check( null === $loader::loaded_version() && null === $loader::loaded_path(), 'nothing is loaded before boot' );
	$check( array() === array_filter( $ran ), 'no on_ready callback runs before boot' );
	$hooked = array_values(
		array_filter(
			$GLOBALS['fyldo_contract']['actions'],
			static function ( array $action ): bool {
				return 'plugins_loaded' === $action[0];
			}
		)
	);
	$check( 1 === count( $hooked ), sprintf( 'boot is hooked once on plugins_loaded (got %d)', count( $hooked ) ) );
	$check( isset( $hooked[0] ) && array( $loader, 'boot' ) === $hooked[0][1] && 0 === $hooked[0][2], 'the hook is Loader::boot at priority 0' );

	// plugins_loaded (twice: boot is idempotent).
	if ( isset( $hooked[0] ) ) {
		call_user_func( $hooked[0][1] );
		call_user_func( $hooked[0][1] );
	}

	$check( $spec['winner']['version'] === $loader::loaded_version(), sprintf( 'loaded_version() is %s (got %s)', $spec['winner']['version'], var_export( $loader::loaded_version(), true ) ) );
	$check( $winner === $loader::loaded_path(), sprintf( 'loaded_path() is %s (got %s)', $winner, var_export( $loader::loaded_path(), true ) ) );
	foreach ( $ran as $i => $count ) {
		$check( 1 === $count, sprintf( 'the on_ready callback of copy %d ran once (ran %d times)', $i, $count ) );
	}

	// After boot, on_ready runs at once.
	$late = 0;
	$loader::on_ready(
		static function () use ( &$late ): void {
			++$late;
		}
	);
	$check( 1 === $late, 'on_ready after boot runs immediately, once' );

	// The winner's autoloader serves Fyldo\V1 classes from the winner's tree (a class and its parent).
	$check( class_exists( 'Fyldo\\V1\\Fields\\TextField' ), 'Fyldo\\V1\\Fields\\TextField autoloads' );
	foreach ( array( 'Fyldo\\V1\\Fields\\TextField', 'Fyldo\\V1\\Fields\\AbstractField' ) as $class ) {
		$file = class_exists( $class, false ) ? (string) ( new ReflectionClass( $class ) )->getFileName() : '';
		$check( 0 === strpos( $file, $winner . '/src/' ), sprintf( '%s comes from the winner (got %s)', $class, $file ) );
	}

	// No double load: nothing of a losing copy's src/ is included, except the Loader of the copy that defined it.
	foreach ( array_keys( $distinct ) as $dir ) {
		if ( $dir === $winner ) {
			continue;
		}
		foreach ( get_included_files() as $file ) {
			$check( 0 !== strpos( $file, $dir . '/src/' ) || $file === $definer, sprintf( 'a losing copy\'s file is not loaded: %s', $file ) );
		}
	}

	$check( array() === $GLOBALS['fyldo_contract']['wrong'], 'no _doing_it_wrong during negotiation' );

	// A copy registered after boot cannot change the winner, and is reported.
	$loader::register( '1.999.0', $copies[0]['dir'] . '/../registered-too-late' );
	$check( $spec['winner']['version'] === $loader::loaded_version(), 'a late registration does not change the winner' );
	$check( 1 === count( $GLOBALS['fyldo_contract']['wrong'] ), 'a late registration is reported with _doing_it_wrong' );
} catch ( Throwable $e ) {
	$failures[] = get_class( $e ) . ': ' . $e->getMessage() . ' (' . $e->getFile() . ':' . $e->getLine() . ')';
}

if ( array() !== $failures ) {
	echo implode( "\n", $failures ), "\n";
	exit( 1 );
}

echo "ok\n";
