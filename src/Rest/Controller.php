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

use Fyldo\V1\Instance;
use Fyldo\V1\Schema\Page;
use Fyldo\V1\Storage\Saver;
use Fyldo\V1\Support\Naming;

/**
 * Routes: GET/PATCH `/pages/{page}`; POST `/pages/{page}/actions/{action}` (a Danger Section Card's action).
 */
final class Controller {

	/** Maximum accepted request body, in bytes. */
	const MAX_BODY = 524288;

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
					'args'                => array(
						'values'   => array(
							'type'     => 'object',
							'required' => true,
						),
						'revision' => array(
							'type'     => 'string',
							'required' => false,
						),
					),
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
	}

	/**
	 * Permission callback: page exists, instance nonce valid, capability held.
	 *
	 * @return true|\WP_Error
	 */
	public function authorize( \WP_REST_Request $request ) {
		if ( ! is_user_logged_in() ) {
			return new \WP_Error( 'fyldo_unauthenticated', __( 'You must be logged in.', 'fyldo' ), array( 'status' => 401 ) );
		}

		$page = $this->instance->page( (string) $request['page'] );
		if ( null === $page ) {
			return new \WP_Error( 'fyldo_not_found', __( 'This settings page does not exist.', 'fyldo' ), array( 'status' => 404 ) );
		}

		$nonce = (string) $request->get_header( Naming::nonce_header() );
		if ( ! wp_verify_nonce( $nonce, Naming::nonce_action( $this->instance->slug() ) ) ) {
			return new \WP_Error( 'fyldo_bad_nonce', __( 'Your session has expired. Reload the page and try again.', 'fyldo' ), array( 'status' => 403 ) );
		}

		if ( ! current_user_can( $this->instance->capability_for( $page ) ) ) {
			return new \WP_Error( 'fyldo_forbidden', __( 'You are not allowed to change these settings.', 'fyldo' ), array( 'status' => 403 ) );
		}

		if ( $request->get_method() !== 'GET' && strlen( (string) $request->get_body() ) > self::MAX_BODY ) {
			return new \WP_Error( 'fyldo_too_large', __( 'The request is too large.', 'fyldo' ), array( 'status' => 413 ) );
		}

		return true;
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
				array(
					'status'   => 409,
					'values'   => (object) $result['values'],
					'revision' => $result['revision'],
				)
			);
		}

		return new \WP_REST_Response(
			array(
				'values'   => (object) $result['values'],
				'revision' => $result['revision'],
			)
		);
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

		return new \WP_REST_Response(
			array(
				'values'   => (object) $result['values'],
				'revision' => $result['revision'],
			)
		);
	}

	private function page( \WP_REST_Request $request ): Page {
		$page = $this->instance->page( (string) $request['page'] );
		if ( null === $page ) {
			// authorize() already proved the page exists; reaching this means a route was registered without it.
			throw new \LogicException( 'Fyldo: REST callback ran without an authorised page.' );
		}

		return $page;
	}

	/**
	 * @return array{values:object,revision:string}
	 */
	private function payload( Page $page ): array {
		$store = $this->instance->store();

		return array(
			'values'   => (object) $store->client_values( $page ),
			'revision' => $store->revision( $page ),
		);
	}
}
