<?php
/**
 * The JSON PHP hands to the browser is a contract with app/types.ts. This test keeps the committed client fixture
 * (used by the static harness and the TS tests) identical to what PHP really produces for the M1 slice page.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

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
		$actual = json_decode( (string) wp_json_encode( $page->to_client( $instance->all( 'general' ), 'rev-1' ) ), true );

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
		$actual = json_decode( (string) wp_json_encode( $page->to_client( $instance->all( 'fields' ), 'rev-1' ) ), true );

		$expected = json_decode( (string) file_get_contents( dirname( __DIR__, 2 ) . '/fixtures/form-fields-page.client.json' ), true );

		$this->assertSame(
			$expected,
			$actual,
			'tests/fixtures/form-fields-page.client.json is stale: run `php tools/dev/dump-slice.php form-fields > tests/fixtures/form-fields-page.client.json`.'
		);
	}
}
