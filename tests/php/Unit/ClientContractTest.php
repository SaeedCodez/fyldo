<?php
/**
 * The JSON PHP hands to the browser is a contract with app/types.ts. This test keeps the committed client fixture
 * (used by the static harness and the TS tests) identical to what PHP really produces for the M1 slice page.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Assets\ClientConfig;
use Fyldo\V1\Instance;
use PHPUnit\Framework\TestCase;

final class ClientContractTest extends TestCase {

	protected function setUp(): void {
		$GLOBALS['__fyldo_test_options'] = array();
	}

	public function test_committed_client_fixture_matches_what_php_builds(): void {
		$instance = new Instance( 'acme-slice', array( 'title' => 'Acme Slice' ) );
		$instance->add_page( 'general', require dirname( __DIR__, 2 ) . '/fixtures/slice-page.php' );

		$page   = $instance->page( 'general' );
		$actual = json_decode( (string) wp_json_encode( $page->to_client( $instance->store()->client_values( $page ), 'rev-1' ) ), true );

		$expected = json_decode( (string) file_get_contents( dirname( __DIR__, 2 ) . '/fixtures/slice-page.client.json' ), true );

		$this->assertSame(
			$expected,
			$actual,
			'tests/fixtures/slice-page.client.json is stale: run `php tools/dev/dump-slice.php > tests/fixtures/slice-page.client.json`.'
		);
	}

	public function test_committed_form_fields_fixture_matches_what_php_builds(): void {
		$instance = new Instance( 'acme-slice', array( 'title' => 'Acme Slice' ) );
		$instance->add_page( 'fields', require dirname( __DIR__, 2 ) . '/fixtures/form-fields-page.php' );

		$page   = $instance->page( 'fields' );
		$actual = json_decode( (string) wp_json_encode( $page->to_client( $instance->store()->client_values( $page ), 'rev-1' ) ), true );

		$expected = json_decode( (string) file_get_contents( dirname( __DIR__, 2 ) . '/fixtures/form-fields-page.client.json' ), true );

		$this->assertSame(
			$expected,
			$actual,
			'tests/fixtures/form-fields-page.client.json is stale: run `php tools/dev/dump-slice.php form-fields > tests/fixtures/form-fields-page.client.json`.'
		);
	}

	public function test_committed_tabs_fixture_matches_what_php_builds(): void {
		$instance = new Instance( 'acme-slice', array( 'title' => 'Acme Slice' ) );
		$instance->add_page( 'advanced', require dirname( __DIR__, 2 ) . '/fixtures/tabs-page.php' );

		$page   = $instance->page( 'advanced' );
		$actual = json_decode( (string) wp_json_encode( $page->to_client( $instance->store()->client_values( $page ), 'rev-1' ) ), true );

		$expected = json_decode( (string) file_get_contents( dirname( __DIR__, 2 ) . '/fixtures/tabs-page.client.json' ), true );

		$this->assertSame(
			$expected,
			$actual,
			'tests/fixtures/tabs-page.client.json is stale: run `php tools/dev/dump-slice.php tabs > tests/fixtures/tabs-page.client.json`.'
		);
	}

	public function test_the_config_carries_both_kinds_of_page_the_forms_and_the_rest_roots(): void {
		$GLOBALS['__fyldo_test_caps'] = array( 'manage_options' );

		$instance = new Instance( 'acme-slice', array( 'title' => 'Acme Slice' ) );
		$instance->add_page( 'general', require dirname( __DIR__, 2 ) . '/fixtures/slice-page.php' );
		$instance->add_page( 'books', array( 'type' => 'custom', 'title' => 'Books', 'module' => '/wp-content/plugins/acme/books.js' ) );
		$instance->add_form( 'book', ( new BookTable() )->form() );

		$client = json_decode( (string) wp_json_encode( ClientConfig::build( $instance ) ), true );

		$this->assertSame( array( 'type', 'id', 'title', 'description', 'icon', 'group', 'badge', 'links', 'save', 'tabs', 'sections', 'values', 'revision' ), array_keys( $client['pages'][0] ) );
		$this->assertSame(
			array( 'type' => 'custom', 'id' => 'books', 'title' => 'Books', 'description' => '', 'icon' => '', 'group' => '', 'badge' => '', 'links' => array(), 'module' => '/wp-content/plugins/acme/books.js', 'props' => array() ),
			$client['pages'][1]
		);
		$this->assertSame( '{}', wp_json_encode( ClientConfig::build( $instance )['pages'][1]['props'] ) );
		$this->assertSame( array( 'id', 'sections' ), array_keys( $client['forms'][0] ) );
		$this->assertSame( array( 'id', 'tab', 'title', 'description', 'tone', 'fields' ), array_keys( $client['forms'][0]['sections'][0] ) );
		$this->assertSame( array( 'root', 'base', 'nonce', 'instanceNonce', 'nonceHeader', 'refresh' ), array_keys( $client['rest'] ) );
		$this->assertSame( 'https://example.com/wp-json/', $client['rest']['base'] );
	}
}
