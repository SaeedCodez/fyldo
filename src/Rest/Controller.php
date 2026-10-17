<?php
/**
 * REST API of one instance: namespace `fyldo-{slug}/v1`.
 *
 * Security stack per request (docs/ARCHITECTURE.md §4): core cookie nonce (`X-WP-Nonce`, action wp_rest,
 * validated by WordPress), a per-instance nonce (`X-Fyldo-Nonce`), and a capability check.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Rest;

use Fyldo\V1\Fields\AbstractRelationField;
use Fyldo\V1\Fields\GroupField;
use Fyldo\V1\Instance;
use Fyldo\V1\Schema\Form;
use Fyldo\V1\Schema\Guarded;
use Fyldo\V1\Schema\Page;
use Fyldo\V1\Storage\RecordStore;
use Fyldo\V1\Storage\Saver;
use Fyldo\V1\Support\Naming;

/**
 * Routes: GET/PATCH `/pages/{page}`; POST `/pages/{page}/actions/{action}` (a Danger Section Card's action); GET
 * `/pages/{page}/fields/{field}/items` (search results of a post, term or user field; `{field}` is `<group>.<sub-field>`
 * for one inside a group). A form's: GET/PATCH `/forms/{form}/records/{key}` (`new` = a record not stored yet) and GET
 * `/forms/{form}/fields/{field}/items`.
 */
final class Controller {

	/** Maximum accepted request body, in bytes. */
	const MAX_BODY = 524288;

	/** Most IDs one `include` lookup may ask for. */
	const MAX_INCLUDE = 100;

	/** @var Instance */
	private $instance;

	public function __construct( Instance $instance ) {
		$this->instance = $instance;
	}

	public function register_routes(): void {
		$namespace = Naming::rest_namespace( $this->instance->slug() );
		$route     = '/pages/(?P<page>' . Naming::PAGE_REGEX . ')';

		register_rest_route(
			$namespace,
			$route,
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'read' ),
					'permission_callback' => array( $this, 'authorize' ),
				),
				array(
					'methods'             => \WP_REST_Server::EDITABLE,
					'callback'            => array( $this, 'write' ),
					'permission_callback' => array( $this, 'authorize' ),
					'args'                => self::write_args(),
				),
			)
		);

		register_rest_route(
			$namespace,
			$route . '/actions/(?P<action>[a-z0-9_-]+)',
			array(
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'run_action' ),
					'permission_callback' => array( $this, 'authorize' ),
					'args'                => array(
						'keyword' => array(
							'type'     => 'string',
							'required' => false,
						),
					),
				),
			)
		);

		$this->register_items_route( $namespace, $route, 'items', 'authorize' );
		$this->register_form_routes( $namespace );
	}

	/**
	 * Registered by register_routes(): a form's record (read, save, create) and its relation fields' search.
	 *
	 * @param non-falsy-string $rest_namespace The instance's REST namespace.
	 */
	private function register_form_routes( string $rest_namespace ): void {
		$route = '/forms/(?P<form>' . Naming::PAGE_REGEX . ')';

		register_rest_route(
			$rest_namespace,
			$route . '/records/(?P<key>' . Form::KEY_REGEX . ')',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'read_record' ),
					'permission_callback' => array( $this, 'authorize_form' ),
				),
				array(
					'methods'             => \WP_REST_Server::EDITABLE,
					'callback'            => array( $this, 'write_record' ),
					'permission_callback' => array( $this, 'authorize_form' ),
					'args'                => self::write_args(),
				),
			)
		);

		$this->register_items_route( $rest_namespace, $route, 'form_items', 'authorize_form' );
	}

	/**
	 * The body of a write, to a page or to a record: `values` (the changed fields) and `revision` (what the browser saw).
	 *
	 * @return array<string,array{type:string,required:bool}>
	 */
	private static function write_args(): array {
		return array(
			'values'   => array(
				'type'     => 'object',
				'required' => true,
			),
			'revision' => array(
				'type'     => 'string',
				'required' => false,
			),
		);
	}

	/**
	 * Registered by register_routes(): search results of a relation field, of a page or of a form.
	 *
	 * @param non-falsy-string $rest_namespace The instance's REST namespace.
	 * @param string           $route          The page or form route.
	 * @param string           $callback       Method that answers.
	 * @param string           $permission     Method that authorizes.
	 */
	private function register_items_route( string $rest_namespace, string $route, string $callback, string $permission ): void {
		register_rest_route(
			$rest_namespace,
			$route . '/fields/(?P<field>[a-z0-9][a-z0-9_-]{0,63}(?:\.[a-z0-9][a-z0-9_-]{0,63})?)/items',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, $callback ),
					'permission_callback' => array( $this, $permission ),
					'args'                => array(
						'search'  => array(
							'type'     => 'string',
							'required' => false,
						),
						// Not `page`: that is the settings page in a page's route.
						'paged'   => array(
							'type'     => 'integer',
							'required' => false,
							'minimum'  => 1,
						),
						'include' => array(
							'type'     => 'string',
							'required' => false,
						),
					),
				),
			)
		);
	}

	/**
	 * Permission callback of the page routes: page exists, instance nonce valid, capability held.
	 *
	 * @return true|\WP_Error
	 */
	public function authorize( \WP_REST_Request $request ) {
		return $this->guard(
			$request,
			$this->instance->page( (string) $request['page'] ),
			__( 'This settings page does not exist.', 'fyldo' ),
			__( 'You are not allowed to change these settings.', 'fyldo' )
		);
	}

	/**
	 * Permission callback of the form routes: the same checks, for the form (its capability, else the instance's).
	 *
	 * @return true|\WP_Error
	 */
	public function authorize_form( \WP_REST_Request $request ) {
		return $this->guard(
			$request,
			$this->instance->form( (string) $request['form'] ),
			__( 'This form does not exist.', 'fyldo' ),
			__( 'You are not allowed to change these records.', 'fyldo' )
		);
	}

	/**
	 * The security stack, in order: logged in (401), `$target` exists (404), instance nonce (403), capability (403),
	 * body size (413).
	 *
	 * @param \WP_REST_Request $request   Request.
	 * @param Guarded|null     $target    The page or form the route names; null when there is none.
	 * @param string           $missing   Message when there is none.
	 * @param string           $forbidden Message when the capability is missing.
	 * @return true|\WP_Error
	 */
	private function guard( \WP_REST_Request $request, ?Guarded $target, string $missing, string $forbidden ) {
		if ( ! is_user_logged_in() ) {
			return new \WP_Error( 'fyldo_unauthenticated', __( 'You must be logged in.', 'fyldo' ), array( 'status' => 401 ) );
		}

		if ( null === $target ) {
			return new \WP_Error( 'fyldo_not_found', $missing, array( 'status' => 404 ) );
		}

		$nonce = (string) $request->get_header( Naming::nonce_header() );
		if ( ! wp_verify_nonce( $nonce, Naming::nonce_action( $this->instance->slug() ) ) ) {
			return new \WP_Error( 'fyldo_bad_nonce', __( 'Your session has expired. Reload the page and try again.', 'fyldo' ), array( 'status' => 403 ) );
		}

		if ( ! current_user_can( $this->instance->capability_for( $target ) ) ) {
			return new \WP_Error( 'fyldo_forbidden', $forbidden, array( 'status' => 403 ) );
		}

		if ( $request->get_method() !== 'GET' && strlen( (string) $request->get_body() ) > self::MAX_BODY ) {
			return new \WP_Error( 'fyldo_too_large', __( 'The request is too large.', 'fyldo' ), array( 'status' => 413 ) );
		}

		return true;
	}

	/**
	 * One page of a post, term or user field's options: `search` (words), `paged` (from 1), or `include` (comma-separated
	 * IDs: the titles of a value the browser has none for). Only items the current user may read are returned.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function items( \WP_REST_Request $request ) {
		return $this->search( $this->page( $request ), $request );
	}

	/**
	 * items(), for a relation field of a form.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function form_items( \WP_REST_Request $request ) {
		return $this->search( $this->form( $request )->schema(), $request );
	}

	/**
	 * What items() and form_items() answer.
	 *
	 * @param Page             $page    The page, or a form's schema.
	 * @param \WP_REST_Request $request Request (`field`, `search`, `paged`, `include`).
	 * @return \WP_REST_Response|\WP_Error
	 */
	private function search( Page $page, \WP_REST_Request $request ) {
		$field = $this->relation_field( $page, (string) $request['field'] );
		if ( null === $field ) {
			return new \WP_Error( 'fyldo_not_found', __( 'This field does not exist.', 'fyldo' ), array( 'status' => 404 ) );
		}

		$include = array();
		foreach ( explode( ',', (string) $request['include'] ) as $id ) {
			if ( 1 === preg_match( '/^\d+$/', trim( $id ) ) && (int) $id > 0 ) {
				$include[ (int) $id ] = (int) $id;
			}
		}

		$search = function_exists( 'mb_substr' ) ? mb_substr( (string) $request['search'], 0, 100 ) : substr( (string) $request['search'], 0, 100 );
		$result = $field->search( sanitize_text_field( $search ), max( 1, (int) $request['paged'] ), array_slice( array_values( $include ), 0, self::MAX_INCLUDE ) );

		return new \WP_REST_Response( $result );
	}

	/**
	 * A post, term or user field of the page by its id, or `<group>.<sub-field>` for one inside a group.
	 */
	private function relation_field( Page $page, string $path ): ?AbstractRelationField {
		$parts = explode( '.', $path, 2 );
		$field = $page->field( $parts[0] );

		if ( isset( $parts[1] ) ) {
			$field = $field instanceof GroupField ? ( $field->sub_fields()[ $parts[1] ] ?? null ) : null;
		}

		return $field instanceof AbstractRelationField ? $field : null;
	}

	/**
	 * Fresh nonces for the current user: both expire after a day, and a new login invalidates them. The browser asks for
	 * them when a request fails on a nonce, then sends it again. Like core's `rest-nonce` action, it is cookie-authenticated
	 * (logged-in users only) and grants nothing: every REST request still checks the capability.
	 *
	 * @return array{nonce:string,instanceNonce:string}
	 */
	public function nonces(): array {
		return array(
			'nonce'         => wp_create_nonce( 'wp_rest' ),
			'instanceNonce' => wp_create_nonce( Naming::nonce_action( $this->instance->slug() ) ),
		);
	}

	/** admin-ajax handler of nonces(). */
	public function send_nonces(): void {
		nocache_headers();
		wp_send_json_success( $this->nonces() );
	}

	public function read( \WP_REST_Request $request ): \WP_REST_Response {
		$page = $this->page( $request );

		return new \WP_REST_Response( $this->payload( $page ) );
	}

	/**
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function write( \WP_REST_Request $request ) {
		$page     = $this->page( $request );
		$incoming = $request['values'];

		if ( ! is_array( $incoming ) ) {
			return new \WP_Error( 'fyldo_bad_request', __( 'The values must be an object.', 'fyldo' ), array( 'status' => 400 ) );
		}

		$revision = $request['revision'];
		$result   = ( new Saver( $this->instance ) )->save( $page, $incoming, is_string( $revision ) && '' !== $revision ? $revision : null );

		if ( 'invalid' === $result['status'] ) {
			return new \WP_Error(
				'fyldo_invalid',
				__( 'Some values are not valid.', 'fyldo' ),
				array(
					'status' => 422,
					'errors' => $result['errors'],
				)
			);
		}

		if ( 'conflict' === $result['status'] ) {
			return new \WP_Error(
				'fyldo_conflict',
				__( 'These settings were changed somewhere else. Reload to see the latest values.', 'fyldo' ),
				array_merge(
					array(
						'status'   => 409,
						'values'   => (object) $result['values'],
						'revision' => $result['revision'],
					),
					self::media_part( $result['media'] )
				)
			);
		}

		return new \WP_REST_Response( self::saved( $result ) );
	}

	/**
	 * A Danger Section Card's action. Only actions the page declares exist (404 otherwise); when the action asks for a
	 * typed confirmation, the keyword is checked HERE too — the browser's disabled button is not a security control.
	 * The only built-in action is `reset`: forget the page's stored values, so every field reads its default again.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function run_action( \WP_REST_Request $request ) {
		$page    = $this->page( $request );
		$section = $page->danger_action( (string) $request['action'] );
		$action  = null === $section ? null : $section->action();

		if ( null === $action ) {
			return new \WP_Error( 'fyldo_not_found', __( 'This action does not exist.', 'fyldo' ), array( 'status' => 404 ) );
		}

		$keyword = $action['confirm']['keyword'];
		if ( '' !== $keyword && trim( (string) $request['keyword'] ) !== $keyword ) {
			return new \WP_Error( 'fyldo_confirmation', __( 'The confirmation text does not match.', 'fyldo' ), array( 'status' => 400 ) );
		}

		$result = ( new Saver( $this->instance ) )->reset( $page );

		return new \WP_REST_Response( self::saved( $result ) );
	}

	/**
	 * A record of a form: its values (as the browser may see them), revision and key. `new` reads an empty record: the
	 * defaults, no `load` call, key and revision ''. A key `load` finds nothing for is a 404.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function read_record( \WP_REST_Request $request ) {
		$record = $this->record( $request );
		if ( $record->missing() ) {
			return self::record_not_found();
		}

		$page = $record->form()->schema();

		return new \WP_REST_Response(
			array_merge(
				array(
					'key'      => $record->key(),
					'values'   => (object) $record->client_values( $page ),
					'revision' => $record->revision( $page ),
				),
				self::media_part( $record->client_media( $page ) )
			)
		);
	}

	/**
	 * Saves a record (`new`: creates one; the response carries its key). Errors as on a page (422, 409), plus 404 for a
	 * key `load` finds nothing for and the plugin's own WP_Error from `save`, passed on as it is (its status, else 500).
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function write_record( \WP_REST_Request $request ) {
		$record   = $this->record( $request );
		$incoming = $request['values'];

		if ( ! is_array( $incoming ) ) {
			return new \WP_Error( 'fyldo_bad_request', __( 'The values must be an object.', 'fyldo' ), array( 'status' => 400 ) );
		}

		$revision = $request['revision'];
		$result   = ( new Saver( $this->instance ) )->save_record( $record, $incoming, is_string( $revision ) && '' !== $revision ? $revision : null );

		if ( 'not_found' === $result['status'] ) {
			return self::record_not_found();
		}

		if ( null !== $result['error'] ) {
			return $result['error'];
		}

		if ( 'invalid' === $result['status'] ) {
			return new \WP_Error(
				'fyldo_invalid',
				__( 'Some values are not valid.', 'fyldo' ),
				array(
					'status' => 422,
					'errors' => $result['errors'],
				)
			);
		}

		if ( 'conflict' === $result['status'] ) {
			return new \WP_Error(
				'fyldo_conflict',
				__( 'This record was changed somewhere else. Reload to see the latest values.', 'fyldo' ),
				array_merge(
					array(
						'status'   => 409,
						'values'   => (object) $result['values'],
						'revision' => $result['revision'],
					),
					self::media_part( $result['media'] )
				)
			);
		}

		return new \WP_REST_Response( array_merge( array( 'key' => $result['key'] ), self::saved( $result ) ) );
	}

	private function page( \WP_REST_Request $request ): Page {
		$page = $this->instance->page( (string) $request['page'] );
		if ( null === $page ) {
			// authorize() already proved the page exists; reaching this means a route was registered without it.
			throw new \LogicException( 'Fyldo: REST callback ran without an authorised page.' );
		}

		return $page;
	}

	private function form( \WP_REST_Request $request ): Form {
		$form = $this->instance->form( (string) $request['form'] );
		if ( null === $form ) {
			// authorize_form() already proved the form exists.
			throw new \LogicException( 'Fyldo: REST callback ran without an authorised form.' );
		}

		return $form;
	}

	/** The record the route names; the key `new` is a record not stored yet. */
	private function record( \WP_REST_Request $request ): RecordStore {
		$key = (string) $request['key'];

		return new RecordStore( $this->form( $request ), Form::NEW_KEY === $key ? '' : $key );
	}

	private static function record_not_found(): \WP_Error {
		return new \WP_Error( 'fyldo_not_found', __( 'This record does not exist.', 'fyldo' ), array( 'status' => 404 ) );
	}

	/**
	 * @return array<string,mixed>
	 */
	private function payload( Page $page ): array {
		$store = $this->instance->store();

		return array_merge(
			array(
				'values'   => (object) $store->client_values( $page ),
				'revision' => $store->revision( $page ),
			),
			self::media_part( $store->client_media( $page ) )
		);
	}

	/**
	 * The body of a successful write: the values, the revision and (when the page has media fields) the saved attachments.
	 *
	 * @param array{values:array<string,mixed>,revision:string,media:array<string,mixed>|null} $result Saver result.
	 * @return array<string,mixed>
	 */
	private static function saved( array $result ): array {
		return array_merge(
			array(
				'values'   => (object) $result['values'],
				'revision' => $result['revision'],
			),
			self::media_part( $result['media'] )
		);
	}

	/**
	 * @param array<string,mixed>|null $media Saved attachments, or null when the page has no media field.
	 * @return array<string,object>
	 */
	private static function media_part( ?array $media ): array {
		return null === $media ? array() : array( 'media' => (object) $media );
	}
}
