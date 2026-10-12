<?php
/**
 * Instance::delete_data(): what a consumer's uninstall.php calls.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Instance;
use PHPUnit\Framework\TestCase;

final class DeleteDataTest extends TestCase {

	protected function setUp(): void {
		$GLOBALS['__fyldo_test_options']  = array();
		$GLOBALS['__fyldo_test_autoload'] = array();
		$GLOBALS['__fyldo_test_fired']    = array();
		$GLOBALS['__fyldo_test_wrong']    = array();
	}

	/**
	 * @param string $id          Page id.
	 * @param string $option_name Option name override ('' = `{slug}_{page}`).
	 * @return array<string,mixed>
	 */
	private static function page( string $id, string $option_name = '' ): array {
		return array(
			'title'       => ucfirst( $id ),
			'option_name' => $option_name,
			'sections'    => array( array( 'id' => 'main', 'title' => 'Main', 'fields' => array( array( 'id' => 'a', 'type' => 'text', 'label' => 'A' ) ) ) ),
		);
	}

	public function test_it_deletes_every_page_option_and_the_state_option_and_nothing_else(): void {
		$GLOBALS['__fyldo_test_options']['other-plugin_general'] = array( 'a' => 'keep' );

		$instance = new Instance( 'my-blog', array( 'version' => '1.0.0' ) );
		$instance->add_page( 'general', self::page( 'general' ) )->add_page( 'legacy', self::page( 'legacy', 'my_blog_old_settings' ) );
		$instance->update( 'general', array( 'a' => 'x' ) );
		$instance->update( 'legacy', array( 'a' => 'y' ) );
		$GLOBALS['__fyldo_test_fired'] = array();

		$this->assertArrayHasKey( 'my-blog__fyldo', $GLOBALS['__fyldo_test_options'] );

		$instance->delete_data();

		$this->assertSame( array( 'other-plugin_general' => array( 'a' => 'keep' ) ), $GLOBALS['__fyldo_test_options'] );
		$this->assertSame( array(), $GLOBALS['__fyldo_test_fired'], 'No save or reset hooks.' );
		$this->assertSame( '', $instance->get( 'general', 'a' ), 'Every field reads its default again.' );
	}

	public function test_it_is_safe_when_nothing_was_stored(): void {
		$instance = new Instance( 'my-blog', array() );
		$instance->add_page( 'general', self::page( 'general' ) );

		$instance->delete_data();

		$this->assertSame( array(), $GLOBALS['__fyldo_test_options'] );
	}
}
