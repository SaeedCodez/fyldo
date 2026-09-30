<?php
/**
 * The demo dashboard (demo/demo.php): it must be a valid Fyldo schema, behave like a real consumer, and load only
 * when Fyldo is installed as a plugin.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Demo\Demo;
use Fyldo\V1\Fyldo;
use PHPUnit\Framework\TestCase;

final class DemoTest extends TestCase {

	public static function setUpBeforeClass(): void {
		// Not autoloaded: fyldo.php requires it only for a standalone plugin.
		require_once dirname( __DIR__, 3 ) . '/demo/demo.php';
	}

	protected function setUp(): void {
		$this->reset_facade();
		$GLOBALS['__fyldo_test_wrong']   = array();
		$GLOBALS['__fyldo_test_options'] = array();
		$GLOBALS['__fyldo_test_actions'] = array();
	}

	protected function tearDown(): void {
		$this->reset_facade();
	}

	public function test_boot_hooks_init_and_the_plugin_action_link(): void {
		Demo::boot( dirname( __DIR__, 3 ) . '/fyldo.php' );

		$this->assertCount( 1, $GLOBALS['__fyldo_test_actions']['init'] );
		$this->assertCount( 1, $GLOBALS['__fyldo_test_actions']['plugin_action_links'] );
	}

	public function test_the_demo_is_a_valid_schema_with_the_four_pages(): void {
		Demo::register();

		$this->assertSame( array(), $GLOBALS['__fyldo_test_wrong'], 'a bad page is reported with _doing_it_wrong and skipped' );
		$instance = Fyldo::instance( Demo::SLUG );
		$this->assertSame( array( 'overview', 'general', 'content', 'security' ), array_keys( $instance->pages() ) );
		$this->assertSame( array( 'settings', 'tools' ), array_column( $instance->groups(), 'id' ) );
		$this->assertSame( 'fyldo-demo_general', $instance->page( 'general' )->option_name() );
		$this->assertSame( 'global', $instance->page( 'general' )->save_mode() );
		$this->assertSame( 'section', $instance->page( 'content' )->save_mode() );
		$this->assertCount( 1, $instance->notices() );
	}

	public function test_the_demo_uses_every_field_type_of_v1(): void {
		Demo::register();

		$types = array();
		foreach ( Fyldo::instance( Demo::SLUG )->pages() as $page ) {
			foreach ( $page->sections() as $section ) {
				foreach ( $section->fields() as $field ) {
					$types[ $field->type() ] = true;
				}
			}
		}

		$expected = array( 'text', 'url', 'email', 'password', 'number', 'textarea', 'toggle', 'checkbox', 'checkbox_group', 'radio', 'select', 'multi_select', 'notice' );
		$this->assertSame( array(), array_diff( $expected, array_keys( $types ) ) );
	}

	public function test_saving_and_the_server_side_rule_work_like_in_a_real_plugin(): void {
		Demo::register();
		$instance = Fyldo::instance( Demo::SLUG );

		$ok = $instance->update( 'general', array( 'site_title' => 'Acme' ) );
		$this->assertSame( 'ok', $ok['status'] );
		$this->assertSame( 'Acme', $instance->get( 'general', 'site_title' ) );

		$this->assertSame( 'invalid', $instance->update( 'general', array( 'site_title' => '' ) )['status'], 'declarative rule: required' );

		$reserved = $instance->update( 'security', array( 'account_name' => 'Admin' ) );
		$this->assertSame( 'invalid', $reserved['status'], 'validate_cb runs on the server only' );
		$this->assertArrayHasKey( 'account_name', $reserved['errors'] );
	}

	private function reset_facade(): void {
		$reflection = new \ReflectionClass( Fyldo::class );
		foreach ( array(
			'instances'   => array(),
			'initialized' => false,
		) as $name => $value ) {
			$property = $reflection->getProperty( $name );
			$property->setAccessible( true );
			$property->setValue( null, $value );
		}
	}
}
