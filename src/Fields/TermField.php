<?php
/**
 * Pick one or more terms (categories, tags, any taxonomy) by searching for them.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Support\Relations;

/**
 * Config: `taxonomy` (a name or a list, default `category`), plus the keys of every relation field (see
 * AbstractRelationField). Only taxonomies whose terms the current user may assign are searched. When several taxonomies
 * are allowed, each result names its taxonomy.
 *
 * @internal
 */
final class TermField extends AbstractRelationField {

	public static function types(): array {
		return array( 'term' );
	}

	protected function noun(): string {
		return 'Term field';
	}

	protected function source_keys(): array {
		return array( 'taxonomy' );
	}

	protected function normalize_source( array $config ): array {
		$config['taxonomy'] = $this->names( $config, 'taxonomy', array( 'category' ) );

		return $config;
	}

	/** @return array{taxonomy:string[],query_args:array<string,mixed>} */
	private function source(): array {
		return array(
			'taxonomy'   => $this->config['taxonomy'],
			'query_args' => $this->config['query_args'],
		);
	}

	protected function query( string $search, int $page ): array {
		return Relations::search_terms( $this->source(), $search, $page );
	}

	protected function lookup( array $ids, bool $check ): array {
		return Relations::find_terms( $this->source(), $ids, $check );
	}
}
