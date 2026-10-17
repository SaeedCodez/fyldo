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
 * One save operation: of a settings page (its option) or of a form's record (the plugin's `save`).
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
			return $this->result( 'conflict', array(), $page, $store );
		}

		$stored  = $store->raw( $page );
		$checked = $this->check( $page, $incoming, $stored, 'sanitize/' . $page->id(), 'validate/' . $page->id() );

		if ( array() !== $checked['errors'] ) {
			return $this->result( 'invalid', $checked['errors'], $page, $store );
		}

		$merged = array_merge( $stored, $checked['clean'] );

		do_action( Naming::hook( $slug, 'before_save' ), $page->id(), $merged, $stored );

		$store->save( $page, $merged );

		do_action( Naming::hook( $slug, 'saved' ), $page->id(), $merged, $stored );

		return $this->result( 'ok', array(), $page, $store );
	}

	/**
	 * Saves a form's record. The plugin's `save` gets the COMPLETE record: every field, its current value (stored, or
	 * the default) with this request's changes on top, since a record has no option to merge into. Fires the form's
	 * hooks (`form/{form}/sanitize`, `form/{form}/validate`, `form/{form}/saved`), never a page's.
	 *
	 * @param RecordStore         $record   The record (key '' = a new one).
	 * @param array<string,mixed> $incoming Untrusted values keyed by field id (partial).
	 * @param string|null         $revision Revision the client last saw; null skips the check (so does a new record).
	 * @return array{status:string,errors:array<string,string>,values:array<string,mixed>,revision:string,media:array<string,mixed>|null,key:string,error:\WP_Error|null}
	 *         status: `ok` | `invalid` | `conflict` | `not_found` (no such record) | `error` (the plugin's `save` refused).
	 */
	public function save_record( RecordStore $record, array $incoming, ?string $revision ): array {
		$form = $record->form();
		$page = $form->schema();
		$hook = 'form/' . $form->id() . '/';

		if ( $record->missing() ) {
			return $this->record_result( 'not_found', array(), $record );
		}

		if ( ! $record->is_new() && null !== $revision && ! hash_equals( $record->revision( $page ), $revision ) ) {
			return $this->record_result( 'conflict', array(), $record );
		}

		$stored  = $record->raw( $page );
		$current = $record->values( $page );
		// A new record is checked whole (its defaults under what was sent): a required field nobody touched must fail.
		if ( $record->is_new() ) {
			$incoming += $current;
		}
		$checked = $this->check( $page, $incoming, $stored, $hook . 'sanitize', $hook . 'validate' );

		if ( array() !== $checked['errors'] ) {
			return $this->record_result( 'invalid', $checked['errors'], $record );
		}

		// Every field of the form, in its order; whatever else a filter added is not the form's.
		$values = array();
		foreach ( array_keys( $page->fields() ) as $id ) {
			$values[ $id ] = array_key_exists( $id, $checked['clean'] ) ? $checked['clean'][ $id ] : $current[ $id ];
		}

		$error = $record->write( $values );
		if ( null !== $error ) {
			return $this->record_result( 'error', array(), $record, $error );
		}

		/**
		 * Fires after a form's record was saved by the plugin's `save`.
		 *
		 * @param string              $key    Record key (for a new record, the key `save` returned).
		 * @param array<string,mixed> $values The complete record that was saved.
		 * @param array<string,mixed> $stored What `load` returned before (empty for a new record).
		 */
		do_action( Naming::hook( $this->instance->slug(), $hook . 'saved' ), $record->key(), $values, $stored );

		return $this->record_result( 'ok', array(), $record );
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

		return $this->result( 'ok', array(), $page, $store );
	}

	/**
	 * Sanitizes and validates the changed fields, then runs the two filters (`$sanitize_hook`, `$validate_hook`: a
	 * page's `sanitize/{page}` / `validate/{page}`, a form's `form/{form}/sanitize` / `form/{form}/validate`).
	 *
	 * @param Page                $page          Schema being saved.
	 * @param array<string,mixed> $incoming      Untrusted values keyed by field id (partial).
	 * @param array<string,mixed> $stored        What is stored right now (raw).
	 * @param string              $sanitize_hook Event of the sanitize filter.
	 * @param string              $validate_hook Event of the validate filter.
	 * @return array{clean:array<string,mixed>,errors:array<string,string>}
	 */
	private function check( Page $page, array $incoming, array $stored, string $sanitize_hook, string $validate_hook ): array {
		$slug   = $this->instance->slug();
		$clean  = array();
		$errors = array();

		foreach ( $page->fields() as $id => $field ) {
			// Unknown ids (and display-only fields, which are not in `fields()`) are ignored; disabled fields cannot be
			// changed; a write-only field sent as `null` keeps what is stored.
			if ( ! array_key_exists( $id, $incoming ) || $field->is_disabled() || $field->keeps_stored( $incoming[ $id ] ) ) {
				continue;
			}

			$value  = $field->sanitize( $incoming[ $id ] );
			$failed = $field->errors( $value );

			// A group reports each invalid sub-field under `<group>.<index>.<sub-field>`.
			if ( array() !== $failed ) {
				$errors += $failed; // Not array_merge: a numeric field id ("2024") would be renumbered.
				continue;
			}

			$clean[ $id ] = $value;
		}

		/**
		 * Filters the sanitized values of a page (or a form's record) before validation results are decided.
		 *
		 * @param array<string,mixed> $clean  Sanitized values (changed fields only).
		 * @param array<string,mixed> $stored Values currently stored.
		 */
		$clean = (array) apply_filters( Naming::hook( $slug, $sanitize_hook ), $clean, $stored );

		/**
		 * Filters validation errors (field id => message). Return a non-empty array to block the save.
		 *
		 * @param array<string,string> $errors Errors found so far.
		 * @param array<string,mixed>  $clean  Sanitized values.
		 * @param array<string,mixed>  $stored Values currently stored.
		 */
		$errors = (array) apply_filters( Naming::hook( $slug, $validate_hook ), $errors, $clean, $stored );

		return array(
			'clean'  => $clean,
			'errors' => $errors,
		);
	}

	/**
	 * @param string               $status Status.
	 * @param array<string,string> $errors Errors.
	 * @param Page                 $page   Page.
	 * @param AbstractStore        $store  Where the page's values live.
	 * @return array{status:string,errors:array<string,string>,values:array<string,mixed>,revision:string,media:array<string,mixed>|null}
	 */
	private function result( string $status, array $errors, Page $page, AbstractStore $store ): array {
		return array(
			'status'   => $status,
			'errors'   => $errors,
			'values'   => $store->client_values( $page ),
			'revision' => $store->revision( $page ),
			'media'    => $store->client_media( $page ),
		);
	}

	/**
	 * `result()` for a record, with its key (the new one after a create) and the plugin's error, if any.
	 *
	 * @param string               $status Status.
	 * @param array<string,string> $errors Errors.
	 * @param RecordStore          $record The record.
	 * @param \WP_Error|null       $error  What the plugin's `save` returned instead of a key.
	 * @return array{status:string,errors:array<string,string>,values:array<string,mixed>,revision:string,media:array<string,mixed>|null,key:string,error:\WP_Error|null}
	 */
	private function record_result( string $status, array $errors, RecordStore $record, ?\WP_Error $error = null ): array {
		return array_merge(
			$this->result( $status, $errors, $record->form()->schema(), $record ),
			array(
				'key'   => $record->key(),
				'error' => $error,
			)
		);
	}
}
