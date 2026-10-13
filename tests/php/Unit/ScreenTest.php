<?php
/**
 * The admin screen: body class and no WordPress admin notices on a Fyldo screen.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Admin\Screen;
use Fyldo\V1\Instance;
use PHPUnit\Framework\TestCase;

final class ScreenTest extends TestCase {

	/** @var Instance */
	private $instance;

	protected function setUp(): void {
		$this->instance = new Instance( 'acme-seo', array( 'title' => 'Acme SEO' ) );
		$this->instance->set_hook_suffix( 'settings_page_acme-seo' );

		$GLOBALS['__fyldo_test_actions'] = array();
		foreach ( Screen::NOTICE_HOOKS as $hook ) {
			add_action( $hook, 'other_plugin_notice' );
		}
		add_action( 'admin_notices', 'update_nag', 3 );
		add_action( 'in_admin_header', 'wp_admin_bar_render', 0 );
	}

	protected function tearDown(): void {
		unset( $GLOBALS['__fyldo_test_screen'] );
		$GLOBALS['__fyldo_test_actions'] = array();
	}

	public function test_a_fyldo_screen_prints_no_admin_notice(): void {
		$GLOBALS['__fyldo_test_screen'] = (object) array( 'id' => 'settings_page_acme-seo' );

		Screen::clear_admin_notices( array( $this->instance ) );

		foreach ( array( 'admin_notices', 'network_admin_notices', 'user_admin_notices', 'all_admin_notices' ) as $hook ) {
			$this->assertArrayNotHasKey( $hook, $GLOBALS['__fyldo_test_actions'], $hook );
		}
		$this->assertCount( 1, $GLOBALS['__fyldo_test_actions']['in_admin_header'], 'the admin bar stays' );
	}

	public function test_other_screens_keep_their_notices(): void {
		$GLOBALS['__fyldo_test_screen'] = (object) array( 'id' => 'dashboard' );

		Screen::clear_admin_notices( array( $this->instance ) );

		$this->assertCount( 2, $GLOBALS['__fyldo_test_actions']['admin_notices'] );
		$this->assertCount( 1, $GLOBALS['__fyldo_test_actions']['all_admin_notices'] );
	}

	public function test_nothing_is_cleared_before_the_screen_is_known(): void {
		Screen::clear_admin_notices( array( $this->instance ) );

		$this->assertCount( 2, $GLOBALS['__fyldo_test_actions']['admin_notices'] );
	}

	public function test_an_instance_without_a_screen_matches_nothing(): void {
		$GLOBALS['__fyldo_test_screen'] = (object) array( 'id' => '' );

		Screen::clear_admin_notices( array( new Instance( 'acme-shop', array( 'title' => 'Acme Shop' ) ) ) );

		$this->assertCount( 2, $GLOBALS['__fyldo_test_actions']['admin_notices'] );
	}

	public function test_the_body_class_marks_only_a_fyldo_screen(): void {
		$GLOBALS['__fyldo_test_screen'] = (object) array( 'id' => 'settings_page_acme-seo' );
		$this->assertSame( 'wp-admin fyldo-screen', Screen::body_class( 'wp-admin', array( $this->instance ) ) );

		$GLOBALS['__fyldo_test_screen'] = (object) array( 'id' => 'dashboard' );
		$this->assertSame( 'wp-admin', Screen::body_class( 'wp-admin', array( $this->instance ) ) );
	}
}
