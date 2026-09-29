<?php
/**
 * Public facade + Instance configuration.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Fyldo;
use Fyldo\V1\Instance;
use Fyldo\V1\Schema\ConfigException;
use PHPUnit\Framework\TestCase;

final class FyldoTest extends TestCase {

	protected function setUp(): void {
		$this->reset_facade();
		$GLOBALS['__fyldo_test_wrong']   = array();
		$GLOBALS['__fyldo_test_actions'] = array();
	}

	protected function tearDown(): void {
		$this->reset_facade();
	}

	public function test_create_returns_and_registers_an_instance(): void {
		$instance = Fyldo::create( 'acme-seo', array( 'title' => 'Acme SEO' ) );

		$this->assertInstanceOf( Instance::class, $instance );
		$this->assertSame( $instance, Fyldo::instance( 'acme-seo' ) );
		$this->assertSame( array( 'acme-seo' ), array_keys( Fyldo::instances() ) );
	}

	public function test_a_duplicate_slug_returns_the_existing_instance_and_reports_it(): void {
		$first  = Fyldo::create( 'acme-seo', array( 'title' => 'One' ) );
		$second = Fyldo::create( 'acme-seo', array( 'title' => 'Two' ) );

		$this->assertSame( $first, $second );
		$this->assertCount( 1, $GLOBALS['__fyldo_test_wrong'] );
	}

	public function test_an_invalid_slug_throws(): void {
		$this->expectException( ConfigException::class );

		Fyldo::create( 'Bad Slug', array( 'title' => 'x' ) );
	}

	public function test_looking_up_an_unknown_instance_throws(): void {
		$this->expectException( \OutOfBoundsException::class );

		Fyldo::instance( 'missing' );
	}

	public function test_init_hooks_wordpress_once(): void {
		Fyldo::init();
		Fyldo::init();

		foreach ( array( 'init', 'admin_menu', 'rest_api_init', 'admin_enqueue_scripts', 'admin_body_class' ) as $hook ) {
			$this->assertCount( 1, $GLOBALS['__fyldo_test_actions'][ $hook ], $hook );
		}
	}

	public function test_instance_defaults(): void {
		$config = ( new Instance( 'acme-seo', array( 'title' => 'Acme SEO' ) ) )->config();

		$this->assertSame( 'manage_options', $config['capability'] );
		$this->assertSame( 'sidebar', $config['navigation'] );
		$this->assertSame( 'submenu', $config['menu']['type'] );
		$this->assertSame( 'options-general.php', $config['menu']['parent'] );
		$this->assertSame( 'Acme SEO', $config['menu']['title'] );
	}

	/**
	 * @dataProvider invalid_instance_configs
	 */
	public function test_instance_config_errors( array $config, string $needle ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessageMatches( '/' . preg_quote( $needle, '/' ) . '/i' );

		new Instance( 'acme-seo', $config );
	}

	public function invalid_instance_configs(): array {
		return array(
			'no title'        => array( array(), 'needs a title' ),
			'unknown key'     => array( array( 'title' => 'x', 'theme' => 'dark' ), 'unknown config key' ),
			'bad navigation'  => array( array( 'title' => 'x', 'navigation' => 'left' ), 'navigation' ),
			'bad menu type'   => array( array( 'title' => 'x', 'menu' => array( 'type' => 'floating' ) ), 'menu.type' ),
			'link w/o url'    => array( array( 'title' => 'x', 'links' => array( array( 'label' => 'Docs' ) ) ), 'label` and `url' ),
		);
	}

	public function test_a_broken_page_is_reported_and_skipped_without_taking_the_site_down(): void {
		$instance = new Instance( 'acme-seo', array( 'title' => 'Acme SEO' ) );
		$instance->add_page( 'broken', array( 'title' => 'Broken', 'sections' => array() ) );

		$this->assertNull( $instance->page( 'broken' ) );
		$this->assertCount( 1, $GLOBALS['__fyldo_test_wrong'] );
		$this->assertStringContainsString( 'at least one section', $GLOBALS['__fyldo_test_wrong'][0] );
	}

	public function test_capability_can_be_overridden_per_page(): void {
		$instance = new Instance( 'acme-seo', array( 'title' => 'Acme SEO', 'capability' => 'manage_options' ) );
		$section  = array( array( 'id' => 's', 'title' => 'S', 'fields' => array() ) );
		$instance->add_page( 'a', array( 'title' => 'A', 'sections' => $section ) );
		$instance->add_page( 'b', array( 'title' => 'B', 'capability' => 'edit_posts', 'sections' => $section ) );

		$this->assertSame( 'manage_options', $instance->capability_for( $instance->page( 'a' ) ) );
		$this->assertSame( 'edit_posts', $instance->capability_for( $instance->page( 'b' ) ) );
	}

	private function reset_facade(): void {
		$reflection = new \ReflectionClass( Fyldo::class );
		foreach ( array( 'instances' => array(), 'initialized' => false ) as $name => $value ) {
			$property = $reflection->getProperty( $name );
			$property->setAccessible( true );
			$property->setValue( null, $value );
		}
	}
}
