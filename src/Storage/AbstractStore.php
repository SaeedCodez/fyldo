<?php
/**
 * The read side every store shares: values, what the browser sees of them, and the revision, all derived from raw().
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Storage;

use Fyldo\V1\Fields\AbstractMediaField;
use Fyldo\V1\Fields\AbstractRelationField;
use Fyldo\V1\Schema\Page;

/**
 * A store says where the raw array lives (an option, a plugin's record); the rest is the same for every store. Writing
 * is each store's own: an option is written in place, a record goes through the plugin's callback, which may refuse.
 *
 * @internal
 */
abstract class AbstractStore {

	/**
	 * Raw stored array (never null).
	 *
	 * @return array<string,mixed>
	 */
	abstract public function raw( Page $page ): array;

	/**
	 * Values for every field of the page: stored value if valid, otherwise the default.
	 * Unknown stored keys are dropped.
	 *
	 * @return array<string,mixed>
	 */
	public function values( Page $page ): array {
		$stored = $this->raw( $page );
		$values = array();

		foreach ( $page->fields() as $id => $field ) {
			if ( ! array_key_exists( $id, $stored ) ) {
				$values[ $id ] = $field->default_value();
				continue;
			}

			// A stored value that no longer validates (e.g. a removed select option) falls back to the default.
			$values[ $id ] = $field->stored_value( $stored[ $id ] );
		}

		return $values;
	}

	/**
	 * `values()` as the browser may see it: write-only fields (password) say whether a value is set, never what it is.
	 *
	 * @return array<string,mixed>
	 */
	public function client_values( Page $page ): array {
		$values = $this->values( $page );

		foreach ( $page->fields() as $id => $field ) {
			$values[ $id ] = $field->client_value( $values[ $id ] );
		}

		return $values;
	}

	/**
	 * What the browser draws for the IDs a page stores: for a media field (`image`, `file`) the saved attachment's name,
	 * size, type, dimensions and thumbnail, or null when nothing is chosen; for a post, term or user field the titles of
	 * the saved items (a list, empty when nothing is chosen). Keyed by field id; null when the page has no such field.
	 *
	 * @return array<string,mixed>|null
	 */
	public function client_media( Page $page ): ?array {
		$media  = null;
		$values = null;

		foreach ( $page->fields() as $id => $field ) {
			if ( ! $field instanceof AbstractMediaField && ! $field instanceof AbstractRelationField ) {
				continue;
			}
			$values = $values ?? $this->values( $page );
			$media  = $media ?? array();

			$media[ $id ] = $field instanceof AbstractMediaField ? $field->media( $values[ $id ] ) : $field->items( $values[ $id ] );
		}

		return $media;
	}

	/**
	 * Optimistic-concurrency token of what is stored right now. Keyed with a site secret: a plain hash of the stored
	 * values (passwords included) would let anyone who sees the revision test guesses offline.
	 */
	public function revision( Page $page ): string {
		$stored = $this->raw( $page );
		ksort( $stored );

		return hash_hmac( 'sha256', (string) wp_json_encode( $stored ), wp_salt( 'nonce' ) );
	}
}
