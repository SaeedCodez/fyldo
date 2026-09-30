<?php
/**
 * The demo loads only when this folder sits directly in the plugins folder (the standalone plugin), never for a
 * drop-in copy or a Composer package. Runs the real fyldo.php in a child PHP, with a stub demo that records the call.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use PHPUnit\Framework\TestCase;

final class DemoLocationTest extends TestCase {

	/** @var string */
	private $tmp;

	protected function setUp(): void {
		$this->tmp = sys_get_temp_dir() . '/fyldo-demo-' . uniqid();
		mkdir( $this->tmp . '/plugins', 0777, true );
	}

	protected function tearDown(): void {
		exec( 'rm -rf ' . escapeshellarg( $this->tmp ) );
	}

	/** @return array<string,array{0:string,1:bool}> */
	public function locations(): array {
		return array(
			'standalone plugin'       => array( 'fyldo', true ),
			'plugin under a new name' => array( 'fyldo-1.0', true ),
			'drop-in folder'          => array( 'acme-seo/fyldo', false ),
			'composer package'        => array( 'acme-seo/vendor/fyldo/fyldo', false ),
		);
	}

	/**
	 * @dataProvider locations
	 */
	public function test_it_loads_the_demo_only_as_a_plugin( string $folder, bool $loads ): void {
		$root = dirname( __DIR__, 3 );
		$dir  = $this->tmp . '/plugins/' . $folder;
		mkdir( $dir . '/src/Bootstrap', 0777, true );
		mkdir( $dir . '/demo', 0777, true );
		copy( $root . '/fyldo.php', $dir . '/fyldo.php' );
		copy( $root . '/src/Bootstrap/Loader.php', $dir . '/src/Bootstrap/Loader.php' );
		file_put_contents(
			$dir . '/demo/demo.php',
			"<?php\nnamespace Fyldo\\V1\\Demo;\nfinal class Demo { public static function boot( string \$file ): void { echo 'DEMO_BOOTED'; } }\n"
		);

		$runner = $this->tmp . '/run.php';
		file_put_contents(
			$runner,
			"<?php\n"
			. "define( 'ABSPATH', '/' );\n"
			. "define( 'WP_PLUGIN_DIR', " . var_export( $this->tmp . '/plugins', true ) . " );\n"
			. "function add_action() {}\n"
			. "function did_action() { return 0; }\n"
			. "function wp_normalize_path( \$p ) { return str_replace( '\\\\', '/', \$p ); }\n"
			. "function get_file_data() { return array( 'Version' => '1.0.0' ); }\n"
			. 'require ' . var_export( $dir . '/fyldo.php', true ) . ";\n"
		);

		$output = (string) shell_exec( escapeshellarg( PHP_BINARY ) . ' -d display_errors=1 ' . escapeshellarg( $runner ) . ' 2>&1' );

		$this->assertSame( $loads, false !== strpos( $output, 'DEMO_BOOTED' ), $output );
		$this->assertStringNotContainsString( 'Fatal', $output );
	}
}
