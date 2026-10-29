<?php
/**
 * Pick one or more posts (pages, products, any post type) by searching for them.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Support\Relations;

/**
 * Config: `post_type` (a name or a list, default `post`) and `post_status` (a name or a list, default `publish`), plus the
 * keys of every relation field (see AbstractRelationField). When several post types are allowed, each result names its type.
 *
 * @internal
 */
final class PostField extends AbstractRelationField {

	public static function types(): array {
		return array( 'post' );
	}

	protected function noun(): string {
		return 'Post field';
	}

	protected function source_keys(): array {
		return array( 'post_type', 'post_status' );
	}

	protected function normalize_source( array $config ): array {
		$config['post_type']   = $this->names( $config, 'post_type', array( 'post' ) );
		$config['post_status'] = $this->names( $config, 'post_status', array( 'publish' ) );

		return $config;
	}

	/** @return array{post_type:string[],post_status:string[],query_args:array<string,mixed>} */
	private function source(): array {
		return array(
			'post_type'   => $this->config['post_type'],
			'post_status' => $this->config['post_status'],
			'query_args'  => $this->config['query_args'],
		);
	}

	protected function query( string $search, int $page ): array {
		return Relations::search_posts( $this->source(), $search, $page );
	}

	protected function lookup( array $ids, bool $check ): array {
		return Relations::find_posts( $this->source(), $ids, $check );
	}
}
