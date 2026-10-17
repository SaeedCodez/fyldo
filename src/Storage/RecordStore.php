<?php
/**
 * One record of a form, read and written through the plugin's `load` and `save`.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Storage;

use Fyldo\V1\Schema\Form;
use Fyldo\V1\Schema\Page;

/**
 * Bound to a form and a key ('' = a new record, not stored yet). `load` runs at most once per store (a request reads
 * the record several times: values, revision, media); after a successful write the store is the saved record, under
 * the key `save` returned, read again so the revision is what the next request will see.
 */
final class RecordStore extends AbstractStore {

	/** @var Form */
	private $form;

	/** @var string */
	private $key;

	/** @var array<string,mixed>|null|false What `load` returned; false = not asked yet. */
	private $loaded = false;

	public function __construct( Form $form, string $key ) {
		$this->form = $form;
		$this->key  = $key;
	}

	public function form(): Form {
		return $this->form;
	}

	/** The record key; '' for a new record. */
	public function key(): string {
		return $this->key;
	}

	public function is_new(): bool {
		return '' === $this->key;
	}

	/** Whether `load` found no record for the key. A new record is never missing: there is nothing to find. */
	public function missing(): bool {
		return ! $this->is_new() && null === $this->load();
	}

	/**
	 * The record as `load` returned it; empty for a new or missing record. `$page` is the form's schema.
	 *
	 * @return array<string,mixed>
	 */
	public function raw( Page $page ): array { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found -- the record is the form's; the schema only matters to the read side.
		return $this->load() ?? array();
	}

	/** A new record has no revision: nothing stored can have changed under it. */
	public function revision( Page $page ): string {
		return $this->is_new() ? '' : parent::revision( $page );
	}

	/**
	 * Hands the complete record to the form's `save`. On success the store follows the returned key.
	 *
	 * @param array<string,mixed> $values Every field of the form.
	 * @return \WP_Error|null The plugin's error, or null when the record was saved.
	 */
	public function write( array $values ): ?\WP_Error {
		$key = $this->form->save( $values, $this->key );
		if ( $key instanceof \WP_Error ) {
			return $key;
		}

		$this->key    = $key;
		$this->loaded = false;

		return null;
	}

	/** @return array<string,mixed>|null */
	private function load(): ?array {
		if ( false === $this->loaded ) {
			$this->loaded = $this->is_new() ? null : $this->form->load( $this->key );
		}

		return $this->loaded;
	}
}
