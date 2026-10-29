<?php
/**
 * Reads and writes one wp_option per page.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Storage;

use Fyldo\V1\Schema\Page;

/**
 * Flat associative array keyed by field id; autoload disabled. The read side (values, revision…) is AbstractStore's.
 *
 * @internal
 */
final class OptionStore extends AbstractStore {

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
}
