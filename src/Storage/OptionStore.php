<?php
/**
 * Reads and writes one wp_option per page.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Storage;

use Fyldo\V1\Fields\AbstractMediaField;
use Fyldo\V1\Schema\Page;

/**
 * Flat associative array keyed by field id; autoload disabled.
 */
final class OptionStore {

	/**
	 * Raw stored array (never null).
	 *
	 * @return array<string,mixed>
	 */
	public function raw( Page $page ): array {
		$stored = get_option( $page->option_name(), array() );

		return is_array( $stored ) ? $stored : array();
	}

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

			$value = $field->sanitize( $stored[ $id ] );
			// A stored value that no longer validates (e.g. a removed select option) falls back to the default.
			$values[ $id ] = null === $field->validate( $value ) ? $value : $field->default_value();
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
	 * What the browser draws for the media fields (`image`, `file`) of a page: field id → the saved attachment's name, size,
	 * type, dimensions and thumbnail, or null when nothing is chosen. Null when the page has no media field at all.
	 *
	 * @return array<string,array<string,mixed>|null>|null
	 */
	public function client_media( Page $page ): ?array {
		$media  = null;
		$values = null;

		foreach ( $page->fields() as $id => $field ) {
			if ( ! $field instanceof AbstractMediaField ) {
				continue;
			}
			$values = $values ?? $this->values( $page );
			$media  = $media ?? array();

			$media[ $id ] = $field->media( $values[ $id ] );
		}

		return $media;
	}

	/**
	 * Persist values (only known field ids are kept).
	 *
	 * @param array<string,mixed> $values Sanitized values keyed by field id.
	 */
	public function save( Page $page, array $values ): void {
		$clean = array();
		foreach ( $page->fields() as $id => $field ) {
			if ( array_key_exists( $id, $values ) ) {
				$clean[ $id ] = $values[ $id ];
			}
		}

		$name = $page->option_name();
		if ( false === get_option( $name, false ) ) {
			add_option( $name, $clean, '', false );
		} else {
			update_option( $name, $clean, false );
		}
	}

	/**
	 * Forget the stored value: every field is back to its default. Nothing is left behind (the option row goes).
	 */
	public function delete( Page $page ): void {
		delete_option( $page->option_name() );
	}

	/** Optimistic-concurrency token of what is stored right now. */
	public function revision( Page $page ): string {
		$stored = $this->raw( $page );
		ksort( $stored );

		return md5( (string) wp_json_encode( $stored ) );
	}
}
