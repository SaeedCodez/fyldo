<?php
/**
 * Shared base of the fields that pick posts, terms or users of the site (`post`, `term`, `user`).
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;

/**
 * Renders a searchable Select (or, with `multiple`, a Multi Select) whose options come from the server while the user
 * types: the field's REST route `…/pages/{page}/fields/{field}/items` returns 20 at a time.
 *
 * The value is the item's ID (an int, 0 = nothing chosen), or with `multiple` a list of IDs in the order they were picked.
 * IDs that no longer exist or no longer fit the field (a deleted post, a term moved to another taxonomy, a user who lost
 * the role) drop out when the value is read, so a page never shows a bare ID. When a value is saved, only items the current
 * user may read count. `validate` takes `required`, and with `multiple` also `min` / `max` (the number of items).
 *
 * Config: `multiple`, `placeholder`, `query_args` (extra arguments for the search query, e.g. `array( 'author' => 3 )`;
 * the search, paging and the field's own source cannot be overridden) and the source keys of the concrete type.
 */
abstract class AbstractRelationField extends AbstractField {

	/**
	 * True while a stored value is read: an item then only has to exist and fit the field, whoever is reading (a logged-out
	 * visitor on the front end may read none of them).
	 *
	 * @var bool
	 */
	private $reading = false;

	/** Name used in developer messages ("Post field"). */
	abstract protected function noun(): string;

	/** Keys that name where the items come from (`post_type`, `taxonomy`, `role`). */
	abstract protected function source_keys(): array;

	/**
	 * Normalises the source keys into lists of names.
	 *
	 * @param array<string,mixed> $config Config being normalised.
	 * @return array<string,mixed>
	 * @throws ConfigException On an invalid source.
	 */
	abstract protected function normalize_source( array $config ): array;

	/**
	 * One page of search results. A seam to WordPress: unit tests override it.
	 *
	 * @param string $search Words to look for ('' = the first items).
	 * @param int    $page   Page, from 1.
	 * @return array{items:array<int,array{value:int,label:string,hint:string}>,more:bool}
	 */
	abstract protected function query( string $search, int $page ): array;

	/**
	 * The items behind IDs that fit the field, keyed by ID. A seam to WordPress: unit tests override it.
	 *
	 * @param int[] $ids   IDs.
	 * @param bool  $check Leave out the items the current user may not read.
	 * @return array<int,array{value:int,label:string,hint:string}>
	 */
	abstract protected function lookup( array $ids, bool $check ): array;

	protected function default_layout(): string {
		return 'field';
	}

	/**
	 * @return int|array<int,int>
	 */
	protected function fallback_default() {
		return $this->is_multiple() ? array() : 0;
	}

	protected function extra_keys(): array {
		return array_merge( array( 'multiple', 'placeholder', 'query_args' ), $this->source_keys() );
	}

	public function is_multiple(): bool {
		return ! empty( $this->config['multiple'] );
	}

	/**
	 * A list of names from a string or a list of strings; `$fallback` when the key is missing.
	 *
	 * @param array<string,mixed> $config   Config.
	 * @param string              $key      Key.
	 * @param string[]            $fallback Default.
	 * @return string[]
	 * @throws ConfigException When the value is not a name or a list of names.
	 */
	protected function names( array $config, string $key, array $fallback ): array {
		if ( ! array_key_exists( $key, $config ) ) {
			return $fallback;
		}

		$raw   = is_array( $config[ $key ] ) ? $config[ $key ] : array( $config[ $key ] );
		$names = array();
		foreach ( $raw as $name ) {
			if ( ! is_string( $name ) || 1 !== preg_match( '/^[a-z0-9_-]{1,32}$/', $name ) ) {
				throw new ConfigException( sprintf( '%1$s "%2$s": `%3$s` must be a name (lower-case letters, digits, "_" or "-") or a list of names.', $this->noun(), $config['id'], $key ) );
			}
			$names[ $name ] = $name;
		}
		if ( array() === $names && array() !== $fallback ) {
			throw new ConfigException( sprintf( '%1$s "%2$s": `%3$s` cannot be empty.', $this->noun(), $config['id'], $key ) );
		}

		return array_values( $names );
	}

	protected function normalize_type( array $config ): array {
		$id = (string) $config['id'];

		if ( array_key_exists( 'multiple', $config ) && ! is_bool( $config['multiple'] ) ) {
			throw new ConfigException( sprintf( '%1$s "%2$s": `multiple` must be true or false.', $this->noun(), $id ) );
		}
		$multiple = ! empty( $config['multiple'] );

		if ( array_key_exists( 'query_args', $config ) && ! is_array( $config['query_args'] ) ) {
			throw new ConfigException( sprintf( '%1$s "%2$s": `query_args` must be an array of query arguments.', $this->noun(), $id ) );
		}

		$rules = (array) $config['validate'];
		foreach ( array( 'min', 'max' ) as $limit ) {
			if ( ! isset( $rules[ $limit ] ) ) {
				continue;
			}
			if ( ! $multiple ) {
				throw new ConfigException( sprintf( '%1$s "%2$s": `%3$s` only applies with `multiple` (it counts the chosen items).', $this->noun(), $id, $limit ) );
			}
			if ( ! is_int( $rules[ $limit ] ) || $rules[ $limit ] < 0 ) {
				throw new ConfigException( sprintf( '%1$s "%2$s": `%3$s` must be a whole number of items, 0 or more.', $this->noun(), $id, $limit ) );
			}
		}
		$extra = array_diff( array_keys( $rules ), array( 'required', 'min', 'max' ) );
		if ( array() !== $extra ) {
			throw new ConfigException( sprintf( '%1$s "%2$s": the validation rules it takes are `required`, `min` and `max` (got: %3$s).', $this->noun(), $id, implode( ', ', $extra ) ) );
		}

		if ( array_key_exists( 'default', $config ) ) {
			$default = $config['default'];
			$valid   = $multiple
				? is_array( $default ) && array_values( $default ) === $default && array() === array_filter( $default, static fn( $item ): bool => ! is_int( $item ) || $item <= 0 )
				: is_int( $default ) && $default >= 0;
			if ( ! $valid ) {
				throw new ConfigException(
					$multiple
						? sprintf( '%1$s "%2$s": `default` must be a list of IDs (whole numbers above 0).', $this->noun(), $id )
						: sprintf( '%1$s "%2$s": `default` must be an ID (a whole number, 0 for none).', $this->noun(), $id )
				);
			}
		}

		$rules['relation'] = true;

		$config['multiple']    = $multiple;
		$config['placeholder'] = isset( $config['placeholder'] ) ? (string) $config['placeholder'] : '';
		$config['query_args']  = $config['query_args'] ?? array();
		$config['validate']    = $rules;

		return $this->normalize_source( $config );
	}

	/**
	 * A stored value as the page reads it: the items only have to exist and fit the field.
	 *
	 * @param mixed $raw Stored value.
	 * @return mixed
	 */
	public function stored_value( $raw ) {
		$this->reading = true;
		try {
			return parent::stored_value( $raw );
		} finally {
			$this->reading = false;
		}
	}

	/**
	 * The IDs of a raw value: whole numbers above 0, without repeats, in their order.
	 *
	 * @param mixed $raw Raw value.
	 * @return int[]
	 */
	private static function ids( $raw ): array {
		$ids = array();
		foreach ( is_array( $raw ) ? $raw : array( $raw ) as $item ) {
			if ( is_int( $item ) || ( is_string( $item ) && 1 === preg_match( '/^\d+$/', $item ) ) || ( is_float( $item ) && floor( $item ) === $item ) ) {
				$id = (int) $item;
				if ( $id > 0 ) {
					$ids[ $id ] = $id;
				}
			}
		}

		return array_values( $ids );
	}

	/**
	 * Only IDs of items that exist and fit the field (and, when saving, that the current user may read).
	 *
	 * @param mixed $raw Raw value.
	 * @return int|array<int,int>
	 */
	protected function sanitize_value( $raw ) {
		$ids = self::ids( $raw );
		if ( ! $this->is_multiple() ) {
			$ids = array_slice( $ids, 0, 1 );
		}

		$found = array() === $ids ? array() : $this->lookup( $ids, ! $this->reading );
		$kept  = array_values( array_filter( $ids, static fn( int $id ): bool => isset( $found[ $id ] ) ) );

		return $this->is_multiple() ? $kept : (int) ( $kept[0] ?? 0 );
	}

	/**
	 * What the browser draws for the saved value: the items' titles, in the value's order. Items the current user may not
	 * read are left out.
	 *
	 * @param mixed $value Stored value.
	 * @return array<int,array{value:int,label:string,hint:string}>
	 */
	public function items( $value ): array {
		$ids = self::ids( $value );

		return array() === $ids ? array() : array_values( array_intersect_key( $this->lookup( $ids, true ), array_flip( $ids ) ) );
	}

	/**
	 * Search results for the field's REST route.
	 *
	 * @param string $search  Words to look for.
	 * @param int    $page    Page, from 1.
	 * @param int[]  $only    When not empty: only these IDs (the titles of a value the page has no labels for).
	 * @return array{items:array<int,array{value:int,label:string,hint:string}>,more:bool}
	 */
	public function search( string $search, int $page, array $only = array() ): array {
		if ( array() !== $only ) {
			return array(
				'items' => $this->items( $only ),
				'more'  => false,
			);
		}

		$result = $this->query( trim( $search ), max( 1, $page ) );

		return array(
			'items' => array_values( $result['items'] ),
			'more'  => (bool) $result['more'],
		);
	}

	protected function client_extra(): array {
		return array(
			'multiple'    => $this->is_multiple(),
			'placeholder' => (string) $this->config['placeholder'],
		);
	}
}
