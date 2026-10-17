<?php
/**
 * A form's REST routes: GET/PATCH …/forms/{form}/records/{key} (`new` = a record not stored yet) and the relation
 * search …/forms/{form}/fields/{field}/items, behind the same security stack as the page routes (real WordPress: e2e/wp).
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Instance;
use Fyldo\V1\Rest\Controller;
use PHPUnit\Framework\TestCase;

final class FormRestTest extends TestCase {

	/** @var BookTable */
	private $table;

	/** @var Instance */
	private $instance;

	/** @var Controller */
	private $controller;

	protected function setUp(): void {
		$GLOBALS['__fyldo_test_options']   = array();
		$GLOBALS['__fyldo_test_fired']     = array();
		$GLOBALS['__fyldo_test_wrong']     = array();
		$GLOBALS['__fyldo_test_routes']    = array();
		$GLOBALS['__fyldo_test_logged_in'] = true;
		$GLOBALS['__fyldo_test_nonces']    = array( 'fyldo_acme-shop_rest' => 'good-nonce' );
		$GLOBALS['__fyldo_test_caps']      = array( 'manage_options' );

		$this->table    = new BookTable();
		$this->instance = new Instance( 'acme-shop', array( 'title' => 'Acme Shop' ) );
		$this->instance->add_form( 'book', $this->table->form() );
		$this->instance->add_form( 'author', $this->table->form( array( 'capability' => 'edit_posts' ) ) );
		$this->controller = new Controller( $this->instance );

		$this->table->rows['b7'] = array(
			'title'   => 'Dune',
			'licence' => 'secret-key',
		);
	}

	/** @param array<string,mixed> $params Route and body params. */
	private function request( array $params, string $method = 'GET', string $body = '' ): \WP_REST_Request {
		return new \WP_REST_Request( array_merge( array( 'form' => 'book' ), $params ), array( 'X-Fyldo-Nonce' => 'good-nonce' ), $method, $body );
	}

	/** @return \WP_REST_Response|\WP_Error */
	private function read( string $key ) {
		return $this->controller->read_record( $this->request( array( 'key' => $key ) ) );
	}

	/**
	 * @param array<string,mixed> $body `values`, `revision`.
	 * @return \WP_REST_Response|\WP_Error
	 */
	private function write( string $key, array $body ) {
		return $this->controller->write_record( $this->request( array_merge( array( 'key' => $key ), $body ), 'POST' ) );
	}

	private function revision(): string {
		$raw = $this->table->rows['b7'];
		ksort( $raw );

		return md5( (string) wp_json_encode( $raw ) );
	}

	public function test_the_routes_are_registered_under_the_form_permission_callback(): void {
		$this->controller->register_routes();

		$routes = array();
		foreach ( $GLOBALS['__fyldo_test_routes'] as $route ) {
			$routes[ $route[1] ] = $route;
		}

		$record = $routes['/forms/(?P<form>[a-z0-9][a-z0-9_-]{0,39})/records/(?P<key>[A-Za-z0-9_-]{1,64})'];
		$this->assertSame( 'fyldo-acme-shop/v1', $record[0] );
		$this->assertSame( array( 'GET', 'POST, PUT, PATCH' ), array_column( $record[2], 'methods' ) );
		$this->assertSame( array( array( $this->controller, 'read_record' ), array( $this->controller, 'write_record' ) ), array_column( $record[2], 'callback' ) );
		$this->assertSame( array( $this->controller, 'authorize_form' ), $record[2][0]['permission_callback'] );
		$this->assertSame( array( $this->controller, 'authorize_form' ), $record[2][1]['permission_callback'] );
		$this->assertTrue( $record[2][1]['args']['values']['required'] );

		$items = $routes['/forms/(?P<form>[a-z0-9][a-z0-9_-]{0,39})/fields/(?P<field>[a-z0-9][a-z0-9_-]{0,63}(?:\.[a-z0-9][a-z0-9_-]{0,63})?)/items'];
		$this->assertSame( 'GET', $items[2][0]['methods'] );
		$this->assertSame( array( $this->controller, 'form_items' ), $items[2][0]['callback'] );
		$this->assertSame( array( $this->controller, 'authorize_form' ), $items[2][0]['permission_callback'] );
		$this->assertSame( array( 'search', 'paged', 'include' ), array_keys( $items[2][0]['args'] ) );
	}

	public function test_reading_a_record_gives_its_key_values_revision_and_media(): void {
		$response = $this->read( 'b7' );

		$this->assertInstanceOf( \WP_REST_Response::class, $response );
		$this->assertSame(
			'{"key":"b7","values":{"title":"Dune","status":"draft","licence":null,"source":"manual","chapters":[],"cover":0},"revision":"' . $this->revision() . '","media":{"cover":null}}',
			wp_json_encode( $response->get_data() ),
			'a write-only value is masked'
		);
	}

	public function test_reading_new_gives_the_defaults_without_asking_load(): void {
		$response = $this->read( 'new' );

		$this->assertSame(
			'{"key":"","values":{"title":"","status":"draft","licence":"","source":"manual","chapters":[],"cover":0},"revision":"","media":{"cover":null}}',
			wp_json_encode( $response->get_data() )
		);
		$this->assertSame( array(), $this->table->loads );
	}

	public function test_a_key_load_finds_nothing_for_is_a_404_for_reading_and_writing(): void {
		foreach ( array( $this->read( 'b404' ), $this->write( 'b404', array( 'values' => array( 'title' => 'X' ) ) ) ) as $missing ) {
			$this->assertInstanceOf( \WP_Error::class, $missing );
			$this->assertSame( 'fyldo_not_found', $missing->get_error_code() );
			$this->assertSame( 404, $missing->get_error_data()['status'] );
		}
		$this->assertSame( array(), $this->table->saves );
	}

	public function test_saving_a_record_returns_its_new_state(): void {
		$response = $this->write( 'b7', array( 'values' => array( 'title' => 'Dune Messiah' ), 'revision' => $this->revision() ) );

		$this->assertInstanceOf( \WP_REST_Response::class, $response );
		$data = $response->get_data();
		$this->assertSame( array( 'key', 'values', 'revision', 'media' ), array_keys( $data ) );
		$this->assertSame( 'b7', $data['key'] );
		$this->assertSame( 'Dune Messiah', $data['values']->title );
		$this->assertSame( $this->revision(), $data['revision'] );
		$this->assertSame( 'Dune Messiah', $this->table->rows['b7']['title'] );
		$this->assertSame( 'secret-key', $this->table->rows['b7']['licence'], 'not sent: kept' );
	}

	public function test_saving_new_creates_a_record_and_answers_with_its_key(): void {
		$response = $this->write( 'new', array( 'values' => array( 'title' => 'Hyperion' ), 'revision' => 'ignored' ) );

		$this->assertInstanceOf( \WP_REST_Response::class, $response );
		$this->assertSame( 'b1', $response->get_data()['key'] );
		$this->assertSame( 'Hyperion', $this->table->rows['b1']['title'] );
		$this->assertSame( '', $this->table->saves[0][1], '`save` gets "" for a new record, never "new"' );
	}

	public function test_a_new_record_is_validated_whole_even_its_untouched_fields(): void {
		// Only `licence` sent: the required `title` keeps its empty default and must fail, or the plugin gets a record
		// without one.
		$invalid = $this->write( 'new', array( 'values' => array( 'licence' => 'abc' ) ) );

		$this->assertSame( 'fyldo_invalid', $invalid->get_error_code() );
		$this->assertSame( array( 'title' ), array_keys( $invalid->get_error_data()['errors'] ) );
		$this->assertSame( array(), $this->table->saves );
	}

	public function test_invalid_values_are_a_422_keyed_like_a_page(): void {
		$invalid = $this->write( 'b7', array( 'values' => array( 'title' => '', 'chapters' => array( array( 'name' => '' ) ) ) ) );

		$this->assertSame( 'fyldo_invalid', $invalid->get_error_code() );
		$this->assertSame( 422, $invalid->get_error_data()['status'] );
		$this->assertSame( array( 'title', 'chapters.0.name' ), array_keys( $invalid->get_error_data()['errors'] ) );
		$this->assertSame( array(), $this->table->saves );
	}

	public function test_a_stale_revision_is_a_409_with_the_current_record(): void {
		$conflict = $this->write( 'b7', array( 'values' => array( 'title' => 'Mine' ), 'revision' => 'stale' ) );

		$this->assertSame( 'fyldo_conflict', $conflict->get_error_code() );
		$data = $conflict->get_error_data();
		$this->assertSame( 409, $data['status'] );
		$this->assertSame( 'Dune', $data['values']->title );
		$this->assertSame( $this->revision(), $data['revision'] );
		$this->assertEquals( (object) array( 'cover' => null ), $data['media'] );
		$this->assertSame( array(), $this->table->saves );
	}

	public function test_a_wp_error_from_save_is_returned_as_it_is(): void {
		$error = new \WP_Error( 'acme_locked', 'This book is locked.', array( 'status' => 423 ) );
		$this->table->answer( $error );

		$this->assertSame( $error, $this->write( 'b7', array( 'values' => array( 'title' => 'X' ) ) ) );
	}

	public function test_values_must_be_an_object(): void {
		$bad = $this->write( 'b7', array( 'values' => 'title=X' ) );

		$this->assertSame( 'fyldo_bad_request', $bad->get_error_code() );
		$this->assertSame( 400, $bad->get_error_data()['status'] );
	}

	public function test_the_items_route_knows_only_the_form_s_relation_fields(): void {
		foreach ( array( 'nope', 'title', 'chapters.name', 'chapters.nope' ) as $field ) {
			$missing = $this->controller->form_items( $this->request( array( 'field' => $field ) ) );
			$this->assertSame( 'fyldo_not_found', $missing->get_error_code(), $field );
			$this->assertSame( 404, $missing->get_error_data()['status'] );
		}
	}

	public function test_authorize_form_runs_the_page_security_stack_for_the_form(): void {
		$request = function ( string $form, ?string $nonce = 'good-nonce', string $method = 'GET', string $body = '' ): \WP_REST_Request {
			return new \WP_REST_Request( array( 'form' => $form, 'key' => 'b7' ), null === $nonce ? array() : array( 'X-Fyldo-Nonce' => $nonce ), $method, $body );
		};
		$status  = function ( $result ): array {
			$this->assertInstanceOf( \WP_Error::class, $result );

			return array( $result->get_error_code(), $result->get_error_data()['status'] );
		};

		$this->assertTrue( $this->controller->authorize_form( $request( 'book' ) ) );

		$GLOBALS['__fyldo_test_logged_in'] = false;
		$this->assertSame( array( 'fyldo_unauthenticated', 401 ), $status( $this->controller->authorize_form( $request( 'book' ) ) ) );
		$GLOBALS['__fyldo_test_logged_in'] = true;

		$this->assertSame( array( 'fyldo_not_found', 404 ), $status( $this->controller->authorize_form( $request( 'nope' ) ) ) );
		$this->assertSame( array( 'fyldo_bad_nonce', 403 ), $status( $this->controller->authorize_form( $request( 'book', null ) ) ) );
		$this->assertSame( array( 'fyldo_bad_nonce', 403 ), $status( $this->controller->authorize_form( $request( 'book', 'stale' ) ) ) );
		$this->assertSame( array( 'fyldo_too_large', 413 ), $status( $this->controller->authorize_form( $request( 'book', 'good-nonce', 'POST', str_repeat( 'x', Controller::MAX_BODY + 1 ) ) ) ) );

		// The form's capability, else the instance's.
		$this->assertSame( array( 'fyldo_forbidden', 403 ), $status( $this->controller->authorize_form( $request( 'author' ) ) ) );
		$GLOBALS['__fyldo_test_caps'] = array( 'edit_posts' );
		$this->assertTrue( $this->controller->authorize_form( $request( 'author' ) ) );
		$this->assertSame( array( 'fyldo_forbidden', 403 ), $status( $this->controller->authorize_form( $request( 'book' ) ) ) );
	}
}
