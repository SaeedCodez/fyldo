<?php
/**
 * Loader = the frozen negotiation contract (docs/ARCHITECTURE.md §6.2).
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Bootstrap\Loader;
use PHPUnit\Framework\TestCase;

final class LoaderTest extends TestCase {

	/** @var string[] */
	private $dirs = array();

	protected function setUp(): void {
		$this->reset_loader();
		$GLOBALS['__fyldo_test_actions'] = array();
		$GLOBALS['__fyldo_test_did']     = array();
		$GLOBALS['__fyldo_test_wrong']   = array();
	}

	protected function tearDown(): void {
		foreach ( $this->dirs as $dir ) {
			$this->remove_dir( $dir );
		}
		$this->reset_loader();
	}

	public function test_highest_version_wins(): void {
		$a = $this->copy_dir();
		$b = $this->copy_dir();
		$c = $this->copy_dir();

		Loader::register( '1.0.0', $a );
		Loader::register( '1.2.1', $b );
		Loader::register( '1.1.9', $c );
		Loader::boot();

		$this->assertSame( '1.2.1', Loader::loaded_version() );
		$this->assertSame( realpath( $b ), Loader::loaded_path() );
	}

	public function test_version_comparison_is_numeric_not_lexical(): void {
		Loader::register( '1.9.0', $this->copy_dir() );
		Loader::register( '1.10.0', $this->copy_dir() );
		Loader::boot();

		$this->assertSame( '1.10.0', Loader::loaded_version() );
	}

	public function test_a_release_beats_its_own_prerelease(): void {
		Loader::register( '1.5.0-beta.2', $this->copy_dir() );
		Loader::register( '1.5.0', $this->copy_dir() );
		Loader::register( '1.5.0-rc.1', $this->copy_dir() );
		Loader::boot();

		$this->assertSame( '1.5.0', Loader::loaded_version() );
	}

	public function test_equal_versions_tie_break_on_path_deterministically(): void {
		$a = $this->copy_dir();
		$b = $this->copy_dir();

		// Registration order must not matter.
		Loader::register( '1.1.0', $b );
		Loader::register( '1.1.0', $a );
		Loader::boot();

		$expected = min( realpath( $a ), realpath( $b ) );
		$this->assertSame( $expected, Loader::loaded_path() );
	}

	public function test_the_same_directory_registered_twice_counts_once(): void {
		$a = $this->copy_dir();

		Loader::register( '1.0.0', $a );
		Loader::register( '1.0.0', $a . '/../' . basename( $a ) );

		$this->assertCount( 1, Loader::copies() );
	}

	public function test_ineligible_copies_are_skipped(): void {
		$modern = $this->copy_dir();
		$old    = $this->copy_dir();

		Loader::register( '1.9.0', $modern, array( 'requires_php' => '99.0' ) ); // Newer, but needs a PHP we don't have.
		Loader::register( '1.3.0', $old, array( 'requires_php' => '7.4' ) );
		Loader::boot();

		$this->assertSame( '1.3.0', Loader::loaded_version() );
	}

	public function test_a_copy_that_needs_a_newer_wordpress_is_skipped(): void {
		$GLOBALS['wp_version'] = '6.5.0';
		try {
			Loader::register( '1.9.0', $this->copy_dir(), array( 'requires_wp' => '9.9' ) );
			Loader::register( '1.3.0', $this->copy_dir(), array( 'requires_wp' => '6.5' ) );
			Loader::boot();

			$this->assertSame( '1.3.0', Loader::loaded_version() );
		} finally {
			unset( $GLOBALS['wp_version'] );
		}
	}

	public function test_no_eligible_copy_means_nothing_is_loaded_and_callbacks_never_run(): void {
		$ran = false;
		Loader::on_ready(
			static function () use ( &$ran ) {
				$ran = true;
			}
		);
		Loader::register( '1.0.0', $this->copy_dir(), array( 'requires_php' => '99.0' ) );
		Loader::boot();

		$this->assertNull( Loader::loaded_version() );
		$this->assertNull( Loader::loaded_path() );
		$this->assertFalse( $ran );
	}

	public function test_boot_is_hooked_once_on_plugins_loaded_priority_zero(): void {
		Loader::register( '1.0.0', $this->copy_dir() );
		Loader::register( '1.1.0', $this->copy_dir() );

		$this->assertCount( 1, $GLOBALS['__fyldo_test_actions']['plugins_loaded'] );
		$this->assertSame( array( array( Loader::class, 'boot' ), 0 ), $GLOBALS['__fyldo_test_actions']['plugins_loaded'][0] );
	}

	public function test_registering_after_plugins_loaded_boots_immediately(): void {
		$GLOBALS['__fyldo_test_did']['plugins_loaded'] = 1;

		Loader::register( '1.0.0', $this->copy_dir() );

		$this->assertSame( '1.0.0', Loader::loaded_version() );
	}

	public function test_a_late_registration_cannot_change_the_winner_and_is_reported(): void {
		Loader::register( '1.0.0', $this->copy_dir() );
		Loader::boot();
		Loader::register( '1.9.0', $this->copy_dir() );

		$this->assertSame( '1.0.0', Loader::loaded_version() );
		$this->assertCount( 1, $GLOBALS['__fyldo_test_wrong'] );
		$this->assertStringContainsString( 'registered too late', $GLOBALS['__fyldo_test_wrong'][0] );
	}

	public function test_on_ready_callbacks_run_at_boot_in_order_and_immediately_afterwards(): void {
		$order = array();

		Loader::on_ready(
			static function () use ( &$order ) {
				$order[] = 'first';
			}
		);
		Loader::register( '1.0.0', $this->copy_dir() );
		Loader::on_ready(
			static function () use ( &$order ) {
				$order[] = 'second';
			}
		);
		$this->assertSame( array(), $order );

		Loader::boot();
		$this->assertSame( array( 'first', 'second' ), $order );

		Loader::on_ready(
			static function () use ( &$order ) {
				$order[] = 'late';
			}
		);
		$this->assertSame( array( 'first', 'second', 'late' ), $order );
	}

	public function test_the_winner_autoloader_loads_classes_from_the_winner_only(): void {
		$loser  = $this->copy_dir( 'loser' );
		$winner = $this->copy_dir( 'winner' );

		Loader::register( '1.0.0', $loser );
		Loader::register( '1.1.0', $winner );
		Loader::boot();

		$class = 'Fyldo\\V1\\ProbeFromCopy';
		$this->assertTrue( class_exists( $class ), 'Autoloader must find the winner class.' );
		$this->assertSame( 'winner', constant( $class . '::ORIGIN' ) );
	}

	/** @return string Absolute directory containing src/ProbeFromCopy.php that reports its own origin. */
	private function copy_dir( string $origin = 'copy' ): string {
		$dir = sys_get_temp_dir() . '/fyldo-loader-' . uniqid( '', true );
		mkdir( $dir . '/src', 0777, true );
		$this->dirs[] = $dir;

		file_put_contents(
			$dir . '/src/ProbeFromCopy.php',
			"<?php\nnamespace Fyldo\\V1;\nclass ProbeFromCopy { const ORIGIN = '" . $origin . "'; }\n"
		);

		return $dir;
	}

	private function reset_loader(): void {
		$reflection = new \ReflectionClass( Loader::class );
		$defaults   = array(
			'copies'    => array(),
			'hooked'    => false,
			'booted'    => false,
			'winner'    => null,
			'callbacks' => array(),
		);
		foreach ( $defaults as $name => $value ) {
			$property = $reflection->getProperty( $name );
			$property->setAccessible( true );
			$property->setValue( null, $value );
		}
	}

	private function remove_dir( string $dir ): void {
		if ( ! is_dir( $dir ) ) {
			return;
		}
		foreach ( scandir( $dir ) as $item ) {
			if ( '.' === $item || '..' === $item ) {
				continue;
			}
			$path = $dir . '/' . $item;
			is_dir( $path ) ? $this->remove_dir( $path ) : unlink( $path );
		}
		rmdir( $dir );
	}
}
