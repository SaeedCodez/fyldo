<?php
/**
 * What the post, term and user fields need to know about the site's posts, terms and users.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Support;

/**
 * The one place that queries WordPress for the relation fields (`post`, `term`, `user`). The fields call it through
 * protected methods, so the unit tests replace it.
 *
 * Every method returns items as `array( 'value' => ID, 'label' => title, 'hint' => '' or a short note )`. The hint tells
 * equal titles apart: the post type or taxonomy when the field allows several, a user's login when it differs from the
 * display name.
 */
final class Relations {

	/** Results per page of a search. */
	const PER_PAGE = 20;

	/**
	 * One page of posts: the most recent first, or the best matches of `$search`.
	 *
	 * @param array{post_type:string[],post_status:string[],query_args:array<string,mixed>} $source Field config.
	 * @param string                                                                        $search Words to look for ('' = none).
	 * @param int                                                                           $page   Page, from 1.
	 * @return array{items:array<int,array{value:int,label:string,hint:string}>,more:bool}
	 */
	public static function search_posts( array $source, string $search, int $page ): array {
		$query = new \WP_Query(
			array_merge(
				array(
					'orderby' => '' === $search ? 'date' : 'relevance',
					'order'   => 'DESC',
				),
				$source['query_args'],
				array(
					'post_type'           => $source['post_type'],
					'post_status'         => $source['post_status'],
					's'                   => $search,
					'posts_per_page'      => self::PER_PAGE,
					'paged'               => $page,
					'ignore_sticky_posts' => true,
				)
			)
		);

		$items = array();
		foreach ( $query->posts as $post ) {
			if ( $post instanceof \WP_Post && current_user_can( 'read_post', $post->ID ) ) {
				$items[] = self::post_item( $post, $source );
			}
		}

		return array(
			'items' => $items,
			'more'  => $page < (int) $query->max_num_pages,
		);
	}

	/**
	 * The posts behind `$ids` that belong to the field's post types and statuses, keyed by ID.
	 *
	 * @param array{post_type:string[],post_status:string[],query_args:array<string,mixed>} $source Field config.
	 * @param int[]                                                                         $ids    Post IDs.
	 * @param bool                                                                          $check  Leave out posts the current user may not read.
	 * @return array<int,array{value:int,label:string,hint:string}>
	 */
	public static function find_posts( array $source, array $ids, bool $check ): array {
		if ( array() === $ids ) {
			return array();
		}

		$posts = get_posts(
			array(
				'post_type'           => $source['post_type'],
				'post_status'         => $source['post_status'],
				'post__in'            => $ids,
				'orderby'             => 'post__in',
				'posts_per_page'      => count( $ids ),
				'ignore_sticky_posts' => true,
				'suppress_filters'    => false,
			)
		);

		$items = array();
		foreach ( $posts as $post ) {
			if ( $post instanceof \WP_Post && ( ! $check || current_user_can( 'read_post', $post->ID ) ) ) {
				$items[ $post->ID ] = self::post_item( $post, $source );
			}
		}

		return $items;
	}

	/**
	 * One page of terms, by name, or the ones whose name matches `$search`.
	 *
	 * @param array{taxonomy:string[],query_args:array<string,mixed>} $source Field config.
	 * @param string                                                  $search Words to look for ('' = none).
	 * @param int                                                     $page   Page, from 1.
	 * @return array{items:array<int,array{value:int,label:string,hint:string}>,more:bool}
	 */
	public static function search_terms( array $source, string $search, int $page ): array {
		$taxonomies = self::assignable_taxonomies( $source['taxonomy'] );
		if ( array() === $taxonomies ) {
			return array(
				'items' => array(),
				'more'  => false,
			);
		}

		// One more than a page tells whether there is a next one.
		$terms = get_terms(
			array_merge(
				array(
					'hide_empty' => false,
					'orderby'    => 'name',
					'order'      => 'ASC',
				),
				$source['query_args'],
				array(
					'taxonomy' => $taxonomies,
					'search'   => $search,
					'number'   => self::PER_PAGE + 1,
					'offset'   => ( $page - 1 ) * self::PER_PAGE,
					'fields'   => 'all',
				)
			)
		);
		$terms = is_array( $terms ) ? $terms : array();

		$items = array();
		foreach ( array_slice( $terms, 0, self::PER_PAGE ) as $term ) {
			if ( $term instanceof \WP_Term ) {
				$items[] = self::term_item( $term, $source );
			}
		}

		return array(
			'items' => $items,
			'more'  => count( $terms ) > self::PER_PAGE,
		);
	}

	/**
	 * The terms behind `$ids` that belong to the field's taxonomies, keyed by ID.
	 *
	 * @param array{taxonomy:string[],query_args:array<string,mixed>} $source Field config.
	 * @param int[]                                                   $ids    Term IDs.
	 * @param bool                                                    $check  Leave out terms the current user may not assign.
	 * @return array<int,array{value:int,label:string,hint:string}>
	 */
	public static function find_terms( array $source, array $ids, bool $check ): array {
		$taxonomies = $check ? self::assignable_taxonomies( $source['taxonomy'] ) : $source['taxonomy'];
		if ( array() === $ids || array() === $taxonomies ) {
			return array();
		}

		$terms = get_terms(
			array(
				'taxonomy'   => $taxonomies,
				'include'    => $ids,
				'hide_empty' => false,
				'number'     => 0,
			)
		);

		$items = array();
		foreach ( is_array( $terms ) ? $terms : array() as $term ) {
			if ( $term instanceof \WP_Term ) {
				$items[ $term->term_id ] = self::term_item( $term, $source );
			}
		}

		return self::in_order( $items, $ids );
	}

	/**
	 * One page of users, by name, or the ones whose login or name matches `$search`. Users who may not list users get none.
	 *
	 * @param array{role:string[],query_args:array<string,mixed>} $source Field config.
	 * @param string                                              $search Words to look for ('' = none).
	 * @param int                                                 $page   Page, from 1.
	 * @return array{items:array<int,array{value:int,label:string,hint:string}>,more:bool}
	 */
	public static function search_users( array $source, string $search, int $page ): array {
		if ( ! current_user_can( 'list_users' ) ) {
			return array(
				'items' => array(),
				'more'  => false,
			);
		}

		$args = array_merge(
			array(
				'orderby' => 'display_name',
				'order'   => 'ASC',
			),
			$source['query_args'],
			array(
				'number'      => self::PER_PAGE + 1,
				'offset'      => ( $page - 1 ) * self::PER_PAGE,
				'count_total' => false,
			)
		);
		if ( array() !== $source['role'] ) {
			$args['role__in'] = $source['role'];
		}
		if ( '' !== $search ) {
			$args['search']         = '*' . $search . '*';
			$args['search_columns'] = array( 'user_login', 'user_nicename', 'display_name' );
		}

		$users = get_users( $args );
		$items = array();
		foreach ( array_slice( $users, 0, self::PER_PAGE ) as $user ) {
			if ( $user instanceof \WP_User ) {
				$items[] = self::user_item( $user );
			}
		}

		return array(
			'items' => $items,
			'more'  => count( $users ) > self::PER_PAGE,
		);
	}

	/**
	 * The users behind `$ids` that have one of the field's roles, keyed by ID.
	 *
	 * @param array{role:string[],query_args:array<string,mixed>} $source Field config.
	 * @param int[]                                               $ids    User IDs.
	 * @param bool                                                $check  Return none when the current user may not list users.
	 * @return array<int,array{value:int,label:string,hint:string}>
	 */
	public static function find_users( array $source, array $ids, bool $check ): array {
		if ( array() === $ids || ( $check && ! current_user_can( 'list_users' ) ) ) {
			return array();
		}

		$args = array(
			'include' => $ids,
			'number'  => count( $ids ),
		);
		if ( array() !== $source['role'] ) {
			$args['role__in'] = $source['role'];
		}

		$items = array();
		foreach ( get_users( $args ) as $user ) {
			if ( $user instanceof \WP_User ) {
				$items[ $user->ID ] = self::user_item( $user );
			}
		}

		return self::in_order( $items, $ids );
	}

	/**
	 * @param array{post_type:string[]} $source Field config.
	 * @return array{value:int,label:string,hint:string}
	 */
	private static function post_item( \WP_Post $post, array $source ): array {
		$hint = '';
		if ( count( $source['post_type'] ) > 1 ) {
			$type = get_post_type_object( $post->post_type );
			$hint = $type ? (string) $type->labels->singular_name : $post->post_type;
		}

		return array(
			'value' => (int) $post->ID,
			'label' => self::text( get_the_title( $post ) ),
			'hint'  => $hint,
		);
	}

	/**
	 * @param array{taxonomy:string[]} $source Field config.
	 * @return array{value:int,label:string,hint:string}
	 */
	private static function term_item( \WP_Term $term, array $source ): array {
		$hint = '';
		if ( count( $source['taxonomy'] ) > 1 ) {
			$taxonomy = get_taxonomy( $term->taxonomy );
			$hint     = $taxonomy ? (string) $taxonomy->labels->singular_name : $term->taxonomy;
		}

		return array(
			'value' => (int) $term->term_id,
			'label' => self::text( $term->name ),
			'hint'  => $hint,
		);
	}

	/**
	 * @return array{value:int,label:string,hint:string}
	 */
	private static function user_item( \WP_User $user ): array {
		$name  = self::text( $user->display_name );
		$login = (string) $user->user_login;

		return array(
			'value' => (int) $user->ID,
			'label' => '' === $name ? $login : $name,
			'hint'  => '' === $name || $name === $login ? '' : $login,
		);
	}

	/**
	 * The taxonomies the current user may assign terms of (unknown ones left out).
	 *
	 * @param string[] $names Taxonomy names.
	 * @return string[]
	 */
	private static function assignable_taxonomies( array $names ): array {
		return array_values(
			array_filter(
				$names,
				static function ( string $name ): bool {
					$taxonomy = get_taxonomy( $name );

					return $taxonomy instanceof \WP_Taxonomy && current_user_can( $taxonomy->cap->assign_terms );
				}
			)
		);
	}

	/**
	 * Plain text of a title or name: no tags, entities decoded, never empty.
	 *
	 * @param mixed $raw Title from WordPress.
	 */
	private static function text( $raw ): string {
		$text = trim( html_entity_decode( wp_strip_all_tags( (string) $raw ), ENT_QUOTES, 'UTF-8' ) );

		return '' === $text ? __( '(no title)', 'fyldo' ) : $text;
	}

	/**
	 * @param array<int,array{value:int,label:string,hint:string}> $items Items keyed by ID.
	 * @param int[]                                                $ids   The order to keep.
	 * @return array<int,array{value:int,label:string,hint:string}>
	 */
	private static function in_order( array $items, array $ids ): array {
		$ordered = array();
		foreach ( $ids as $id ) {
			if ( isset( $items[ $id ] ) ) {
				$ordered[ $id ] = $items[ $id ];
			}
		}

		return $ordered;
	}
}
