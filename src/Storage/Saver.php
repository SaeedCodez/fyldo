<?php
/**
 * sanitize → validate → merge → store, shared by the REST controller and Instance::update().
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Storage;

use Fyldo\V1\Instance;
use Fyldo\V1\Schema\Page;
use Fyldo\V1\Support\Naming;

/**
 * One save operation.
 */
final class Saver {

	/** @var Instance */
	private $instance;

	public function __construct( Instance $instance ) {
		$this->instance = $instance;
	}

	/**
	 * @param Page                $page     Page being saved.
	 * @param array<string,mixed> $incoming Untrusted values keyed by field id (partial).
	 * @param string|null         $revision Revision the client last saw; null skips the concurrency check.
	 * @return array{status:string,errors:array<string,string>,values:array<string,mixed>,revision:string,media:array<string,mixed>|null}
	 *         status: `ok` | `invalid` | `conflict`.
	 */
	public function save( Page $page, array $incoming, ?string $revision ): array {
		$store = $this->instance->store();
		$slug  = $this->instance->slug();

		if ( null !== $revision && ! hash_equals( $store->revision( $page ), $revision ) ) {
			return $this->result( 'conflict', array(), $page );
		}

		$stored = $store->raw( $page );
		$clean  = array();
		$errors = array();

		foreach ( $page->fields() as $id => $field ) {
			// Unknown ids (and display-only fields, which are not in `fields()`) are ignored; disabled fields cannot be
			// changed; a write-only field sent as `null` keeps what is stored.
			if ( ! array_key_exists( $id, $incoming ) || $field->is_disabled() || $field->keeps_stored( $incoming[ $id ] ) ) {
				continue;
			}

			$value = $field->sanitize( $incoming[ $id ] );
			$error = $field->validate( $value );

			if ( null !== $error ) {
				$errors[ $id ] = $error;
				continue;
			}

			$clean[ $id ] = $value;
		}

		/**
		 * Filters the sanitized values of a page before validation results are decided.
		 *
		 * @param array<string,mixed> $clean  Sanitized values (changed fields only).
		 * @param array<string,mixed> $stored Values currently stored.
		 */
		$clean = (array) apply_filters( Naming::hook( $slug, 'sanitize/' . $page->id() ), $clean, $stored );

		/**
		 * Filters validation errors (field id => message). Return a non-empty array to block the save.
		 *
		 * @param array<string,string> $errors Errors found so far.
		 * @param array<string,mixed>  $clean  Sanitized values.
		 * @param array<string,mixed>  $stored Values currently stored.
		 */
		$errors = (array) apply_filters( Naming::hook( $slug, 'validate/' . $page->id() ), $errors, $clean, $stored );

		if ( array() !== $errors ) {
			return $this->result( 'invalid', $errors, $page );
		}

		$merged = array_merge( $stored, $clean );

		do_action( Naming::hook( $slug, 'before_save' ), $page->id(), $merged, $stored );

		$store->save( $page, $merged );

		do_action( Naming::hook( $slug, 'saved' ), $page->id(), $merged, $stored );

		return $this->result( 'ok', array(), $page );
	}

	/**
	 * Restore the defaults of a page (the built-in `reset` danger action): the stored value is forgotten, so every
	 * field reads its default again. A disabled field keeps what is stored — it cannot be changed from the UI, and a
	 * reset is a change. Fires `before_save` / `saved` with what is now stored (an empty array when nothing is kept),
	 * like any other write, then `reset`.
	 *
	 * @return array{status:string,errors:array<string,string>,values:array<string,mixed>,revision:string,media:array<string,mixed>|null}
	 */
	public function reset( Page $page ): array {
		$store  = $this->instance->store();
		$slug   = $this->instance->slug();
		$stored = $store->raw( $page );
		$kept   = array();

		foreach ( $page->fields() as $id => $field ) {
			if ( $field->is_disabled() && array_key_exists( $id, $stored ) ) {
				$kept[ $id ] = $stored[ $id ];
			}
		}

		do_action( Naming::hook( $slug, 'before_save' ), $page->id(), $kept, $stored );

		if ( array() === $kept ) {
			$store->delete( $page );
		} else {
			$store->save( $page, $kept );
		}

		do_action( Naming::hook( $slug, 'saved' ), $page->id(), $kept, $stored );

		/**
		 * Fires after a page was reset to its defaults.
		 *
		 * @param string              $page_id Page id.
		 * @param array<string,mixed> $stored  What was stored before the reset.
		 */
		do_action( Naming::hook( $slug, 'reset' ), $page->id(), $stored );

		return $this->result( 'ok', array(), $page );
	}

	/**
	 * @param array<string,string> $errors Errors.
	 * @return array{status:string,errors:array<string,string>,values:array<string,mixed>,revision:string,media:array<string,mixed>|null}
	 */
	private function result( string $status, array $errors, Page $page ): array {
		$store = $this->instance->store();

		return array(
			'status'   => $status,
			'errors'   => $errors,
			'values'   => $store->client_values( $page ),
			'revision' => $store->revision( $page ),
			'media'    => $store->client_media( $page ),
		);
	}
}
