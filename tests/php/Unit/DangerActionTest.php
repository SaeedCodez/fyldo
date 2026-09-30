<?php
/**
 * The Danger Section Card's action over REST: POST …/pages/{page}/actions/reset (typed confirmation checked here too).
 * Nonce and capability are the same `authorize()` as the other routes (real WordPress: e2e/wp).
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Instance;
use Fyldo\V1\Rest\Controller;
use PHPUnit\Framework\TestCase;

final class DangerActionTest extends TestCase {

	/** @var Instance */
	private $instance;

	protected function setUp(): void {
		$GLOBALS['__fyldo_test_options'] = array();
		$GLOBALS['__fyldo_test_fired']   = array();
		$GLOBALS['__fyldo_test_wrong']   = array();

		$this->instance = new Instance( 'acme-seo', array( 'title' => 'Acme SEO' ) );
		$this->instance->add_page(
			'general',
			array(
				'title'    => 'General',
				'sections' => array(
					array( 'id' => 'identity', 'title' => 'Identity', 'fields' => array( array( 'id' => 'site_title', 'type' => 'text', 'label' => 'Title', 'default' => 'My site' ) ) ),
					array( 'id' => 'reset', 'title' => 'Reset settings', 'tone' => 'danger', 'action' => array( 'id' => 'reset', 'label' => 'Reset settings', 'confirm' => array( 'keyword' => 'RESET' ) ) ),
				),
			)
		);
		$this->instance->add_page(
			'plain',
			array(
				'title'    => 'Plain',
				'sections' => array(
					array( 'id' => 'a', 'title' => 'A', 'fields' => array( array( 'id' => 'x', 'type' => 'toggle', 'label' => 'X' ) ) ),
					array( 'id' => 'reset', 'title' => 'Reset', 'tone' => 'danger', 'action' => array( 'id' => 'reset', 'label' => 'Reset' ) ),
				),
			)
		);
		$this->instance->update( 'general', array( 'site_title' => 'Changed' ) );
		$this->instance->update( 'plain', array( 'x' => true ) );
	}

	private function run_action( string $page, string $action, array $body = array() ) {
		return ( new Controller( $this->instance ) )->run_action( new \WP_REST_Request( array_merge( array( 'page' => $page, 'action' => $action ), $body ) ) );
	}

	public function test_the_typed_keyword_resets_the_page_and_returns_the_new_values_and_revision(): void {
		$response = $this->run_action( 'general', 'reset', array( 'keyword' => 'RESET' ) );

		$this->assertInstanceOf( \WP_REST_Response::class, $response );
		$this->assertEquals( (object) array( 'site_title' => 'My site' ), $response->get_data()['values'] );
		$this->assertSame( $this->instance->store()->revision( $this->instance->page( 'general' ) ), $response->get_data()['revision'] );
		$this->assertSame( 'My site', $this->instance->get( 'general', 'site_title' ) );
	}

	public function test_the_keyword_is_trimmed_but_case_sensitive(): void {
		$this->assertInstanceOf( \WP_REST_Response::class, $this->run_action( 'general', 'reset', array( 'keyword' => '  RESET ' ) ) );

		$this->instance->update( 'general', array( 'site_title' => 'Again' ) );
		$wrong = $this->run_action( 'general', 'reset', array( 'keyword' => 'reset' ) );

		$this->assertInstanceOf( \WP_Error::class, $wrong );
		$this->assertSame( 'fyldo_confirmation', $wrong->get_error_code() );
		$this->assertSame( 400, $wrong->get_error_data()['status'] );
		$this->assertSame( 'Again', $this->instance->get( 'general', 'site_title' ), 'A wrong keyword changes nothing.' );
	}

	public function test_a_missing_keyword_is_refused_when_the_action_asks_for_one(): void {
		$this->assertSame( 'fyldo_confirmation', $this->run_action( 'general', 'reset' )->get_error_code() );
		$this->assertSame( 'Changed', $this->instance->get( 'general', 'site_title' ) );
	}

	public function test_an_action_without_a_keyword_needs_none(): void {
		$this->assertInstanceOf( \WP_REST_Response::class, $this->run_action( 'plain', 'reset' ) );
		$this->assertFalse( $this->instance->get( 'plain', 'x' ) );
	}

	public function test_only_declared_actions_exist(): void {
		$unknown = $this->run_action( 'general', 'wipe', array( 'keyword' => 'RESET' ) );

		$this->assertSame( 'fyldo_not_found', $unknown->get_error_code() );
		$this->assertSame( 404, $unknown->get_error_data()['status'] );
	}

	public function test_a_page_without_a_danger_section_has_no_reset(): void {
		$this->instance->add_page( 'bare', array( 'title' => 'Bare', 'sections' => array( array( 'id' => 'a', 'title' => 'A', 'fields' => array( array( 'id' => 'x', 'type' => 'toggle', 'label' => 'X' ) ) ) ) ) );

		$this->assertSame( 'fyldo_not_found', $this->run_action( 'bare', 'reset' )->get_error_code() );
	}
}
