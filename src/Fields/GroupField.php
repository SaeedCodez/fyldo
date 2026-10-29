<?php
/**
 * Group field: a list of items that share the same sub-fields (header buttons with a label, an icon and a link).
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Schema\Dependency;

/**
 * The value is a list of items; each item is an array keyed by the sub-field ids. A fixed group (`addable` off) keeps
 * exactly the items of its `default`; `sortable` lets people reorder them, `addable` lets them add, duplicate and remove.
 * Sub-fields are ordinary fields, validated on their own; their errors are keyed `<group>.<index>.<sub-field>`.
 * A sub-field's `dependency` reads the other sub-fields of its item, or the fields of the page. A custom sub-field's
 * `watch` names other sub-fields of its item only.
 *
 * @internal
 */
final class GroupField extends AbstractField {

	/** Sub-field types a group cannot hold: another group, media (attachment lookups), write-only and display-only types. */
	const EXCLUDED_TYPES = array( 'group', 'image', 'file', 'password', 'notice' );

	/** @var array<string,AbstractField> Sub-fields keyed by id, in display order. */
	private $subs = array();

	/**
	 * True while a stored value is read: each sub-field is then read through its own stored_value(), so the checks that
	 * depend on who is reading (a post sub-field's `read_post`) stay out of it, as for a field on its own.
	 *
	 * @var bool
	 */
	private $reading = false;

	public static function types(): array {
		return array( 'group' );
	}

	protected function default_layout(): string {
		return 'stacked';
	}

	protected function fallback_default() {
		return array();
	}

	protected function extra_keys(): array {
		return array( 'fields', 'item_title', 'item_icon', 'sortable', 'addable', 'min', 'max', 'add_label' );
	}

	/**
	 * @return array<string,AbstractField>
	 */
	public function sub_fields(): array {
		return $this->subs;
	}

	/**
	 * The ids the sub-fields' conditions read that are not sub-fields: fields of the page.
	 *
	 * @return string[]
	 */
	public function outside_references(): array {
		$refs = array();
		foreach ( $this->subs as $sub ) {
			$dependency = $sub->dependency();
			foreach ( null === $dependency ? array() : Dependency::fields( $dependency ) as $ref ) {
				if ( ! isset( $this->subs[ $ref ] ) ) {
					$refs[] = $ref;
				}
			}
		}

		return array_values( array_unique( $refs ) );
	}

	/**
	 * The sub-fields of one item that are hidden, as keys. `$outside` resolves a field of the page (Schema\Visibility).
	 *
	 * @param array<string,mixed> $item    Sanitized item.
	 * @param callable            $outside `fn( string $id ): array{visible:bool,value:mixed}`.
	 * @return array<string,true>
	 */
	public function hidden_subs( array $item, callable $outside ): array {
		$known   = array();
		$visible = function ( string $sub_id ) use ( &$visible, &$known, $item, $outside ): bool {
			if ( ! array_key_exists( $sub_id, $known ) ) {
				$known[ $sub_id ] = false; // Cycles are ruled out at config time.
				$dependency       = $this->subs[ $sub_id ]->dependency();
				$known[ $sub_id ] = null === $dependency || Dependency::matches(
					$dependency,
					function ( string $ref ) use ( $visible, $item, $outside ): array {
						$sub = $this->subs[ $ref ] ?? null;
						if ( null === $sub ) {
							return $outside( $ref );
						}
						return array(
							'visible' => $visible( $ref ),
							'value'   => Dependency::subject( $sub, array_key_exists( $ref, $item ) ? $item[ $ref ] : $sub->default_value() ),
						);
					}
				);
			}
			return $known[ $sub_id ];
		};

		$hidden = array();
		foreach ( array_keys( $this->subs ) as $sub_id ) {
			if ( ! $visible( (string) $sub_id ) ) {
				$hidden[ (string) $sub_id ] = true;
			}
		}

		return $hidden;
	}

	public function is_addable(): bool {
		return true === $this->config['addable'];
	}

	protected function normalize_type( array $config ): array {
		$id = (string) $config['id'];

		$fields = $config['fields'] ?? null;
		if ( ! is_array( $fields ) || array() === $fields ) {
			throw new ConfigException( sprintf( 'Group field "%s": `fields` must be a non-empty list of sub-field configs.', $id ) );
		}

		$this->subs = array();
		foreach ( $fields as $sub_config ) {
			$type = is_array( $sub_config ) && isset( $sub_config['type'] ) ? (string) $sub_config['type'] : '';
			if ( in_array( $type, self::EXCLUDED_TYPES, true ) ) {
				throw new ConfigException( sprintf( 'Group field "%1$s": a sub-field cannot be of type "%2$s".', $id, $type ) );
			}
			if ( is_array( $sub_config ) && array_key_exists( 'default_before', $sub_config ) ) {
				throw new ConfigException( sprintf( 'Group field "%s": a sub-field cannot have `default_before`; put the earlier default items on the group itself.', $id ) );
			}
			$sub = FieldFactory::create( (array) $sub_config );
			if ( isset( $this->subs[ $sub->id() ] ) ) {
				throw new ConfigException( sprintf( 'Group field "%1$s": duplicate sub-field id "%2$s".', $id, $sub->id() ) );
			}
			$this->subs[ $sub->id() ] = $sub;
		}

		// A sub-field's condition reads a sibling of the same item first; any other id is a field of the page (Page checks it).
		$graph = array();
		foreach ( $this->subs as $sub_id => $sub ) {
			$dependency = $sub->dependency();
			foreach ( null === $dependency ? array() : Dependency::fields( $dependency ) as $ref ) {
				if ( $ref === $sub_id ) {
					throw new ConfigException( sprintf( 'Field "%s" cannot depend on itself.', $sub_id ) );
				}
				if ( isset( $this->subs[ $ref ] ) ) {
					$graph[ 'field:' . $sub_id ][] = 'field:' . $ref;
				}
			}
		}
		Dependency::assert_acyclic( $graph, sprintf( 'Group field "%s"', $id ) );

		// A custom sub-field watches the other sub-fields of its own item, never the page's fields.
		foreach ( $this->subs as $sub_id => $sub ) {
			foreach ( $sub instanceof CustomField ? $sub->watch() : array() as $watched ) {
				if ( $watched === $sub_id ) {
					throw new ConfigException( sprintf( 'Custom field "%s" cannot watch itself: its own value is `value`.', $sub_id ) );
				}
				if ( ! isset( $this->subs[ $watched ] ) ) {
					throw new ConfigException( sprintf( 'Custom field "%1$s" watches "%2$s", which is not a sub-field of group "%3$s" (inside a group, `watch` names the other sub-fields of the same item).', $sub_id, $watched, $id ) );
				}
				if ( 'password' === $this->subs[ $watched ]->type() ) {
					throw new ConfigException( sprintf( 'Custom field "%1$s" cannot watch password field "%2$s": its value never reaches the browser.', $sub_id, $watched ) );
				}
			}
		}

		foreach ( array( 'sortable', 'addable' ) as $key ) {
			$config[ $key ] = $config[ $key ] ?? false;
			if ( ! is_bool( $config[ $key ] ) ) {
				throw new ConfigException( sprintf( 'Group field "%1$s": `%2$s` must be true or false.', $id, $key ) );
			}
		}

		foreach ( array( 'item_title', 'item_icon' ) as $key ) {
			$ref = $config[ $key ] ?? '';
			if ( ! is_string( $ref ) || ( '' !== $ref && ! isset( $this->subs[ $ref ] ) ) ) {
				throw new ConfigException( sprintf( 'Group field "%1$s": `%2$s` must be the id of one of its sub-fields.', $id, $key ) );
			}
			if ( 'item_icon' === $key && '' !== $ref && 'icon' !== $this->subs[ $ref ]->type() ) {
				throw new ConfigException( sprintf( 'Group field "%1$s": `item_icon` must be the id of an `icon` sub-field.', $id ) );
			}
			$config[ $key ] = $ref;
		}

		$config['add_label'] = isset( $config['add_label'] ) ? (string) $config['add_label'] : '';

		$rules = (array) $config['validate'];
		$extra = array_diff( array_keys( $rules ), array( 'required' ) );
		if ( array() !== $extra ) {
			throw new ConfigException( sprintf( 'Group field "%1$s": the only validation rule a group takes is `required`; limit the number of items with `min` and `max` (got: %2$s).', $id, implode( ', ', $extra ) ) );
		}

		foreach ( array( 'min', 'max' ) as $key ) {
			if ( ! isset( $config[ $key ] ) ) {
				$config[ $key ] = null;
				continue;
			}
			if ( ! is_int( $config[ $key ] ) || $config[ $key ] < 0 ) {
				throw new ConfigException( sprintf( 'Group field "%1$s": `%2$s` must be a whole number, 0 or more.', $id, $key ) );
			}
			if ( ! $config['addable'] ) {
				throw new ConfigException( sprintf( 'Group field "%1$s": `%2$s` only applies when `addable` is true (a fixed group keeps the items of its `default`).', $id, $key ) );
			}
		}
		if ( null !== $config['min'] && null !== $config['max'] && $config['min'] > $config['max'] ) {
			throw new ConfigException( sprintf( 'Group field "%s": `min` is greater than `max`.', $id ) );
		}

		$default = $config['default'] ?? array();
		if ( ! is_array( $default ) || array_values( $default ) !== $default ) {
			throw new ConfigException( sprintf( 'Group field "%s": `default` must be a list of items (arrays keyed by sub-field id).', $id ) );
		}
		foreach ( $default as $index => $item ) {
			if ( ! is_array( $item ) ) {
				throw new ConfigException( sprintf( 'Group field "%1$s": default item %2$d must be an array keyed by sub-field id.', $id, $index + 1 ) );
			}
			$unknown = array_diff( array_keys( $item ), array_keys( $this->subs ) );
			if ( array() !== $unknown ) {
				throw new ConfigException( sprintf( 'Group field "%1$s": default item %2$d has unknown key(s): %3$s.', $id, $index + 1, implode( ', ', $unknown ) ) );
			}
		}
		if ( ! $config['addable'] && array() === $default ) {
			throw new ConfigException( sprintf( 'Group field "%s": a fixed group (`addable` false) needs its items in `default`.', $id ) );
		}
		if ( null !== $config['max'] && count( $default ) > $config['max'] ) {
			throw new ConfigException( sprintf( 'Group field "%s": `default` has more items than `max`.', $id ) );
		}

		// Every default item is complete and sanitized, so the browser and the store see the same shape.
		$config['default'] = array_map( array( $this, 'clean_item' ), $default );

		return $config;
	}

	/**
	 * An item with every sub-field: sanitized values (read values while reading), the sub-field default where a key is missing.
	 *
	 * @param array<string,mixed> $raw Raw item.
	 * @return array<string,mixed>
	 */
	private function clean_item( array $raw ): array {
		$item = array();
		foreach ( $this->subs as $sub_id => $sub ) {
			if ( ! array_key_exists( $sub_id, $raw ) ) {
				$item[ $sub_id ] = $sub->default_value();
				continue;
			}
			$item[ $sub_id ] = $this->reading ? $sub->stored_value( $raw[ $sub_id ] ) : $sub->sanitize( $raw[ $sub_id ] );
		}

		return $item;
	}

	protected function sanitize_value( $raw ) {
		$items = array();
		foreach ( is_array( $raw ) ? array_values( $raw ) : array() as $item ) {
			if ( is_array( $item ) ) {
				$items[] = $this->clean_item( $item );
			}
		}

		// A fixed group always holds the items of its default: no more, and a missing one comes back as declared.
		if ( ! $this->is_addable() ) {
			$default = (array) $this->default_value();
			$items   = array_slice( $items, 0, count( $default ) );
			for ( $i = count( $items ), $n = count( $default ); $i < $n; $i++ ) {
				$items[] = $default[ $i ];
			}
		}

		return $items;
	}

	/**
	 * The first failure of the item count (`required`, `min`, `max`), or null.
	 *
	 * @param mixed $value Sanitized value.
	 * @return array{rule:string,params:array<string,mixed>}|null
	 */
	public function failure( $value ): ?array {
		$count = is_array( $value ) ? count( $value ) : 0;

		if ( ! empty( $this->config['validate']['required'] ) && 0 === $count ) {
			return array(
				'rule'   => 'required',
				'params' => array(),
			);
		}
		if ( null !== $this->config['min'] && $count < $this->config['min'] ) {
			return array(
				'rule'   => 'items_min',
				'params' => array( 'min' => $this->config['min'] ),
			);
		}
		if ( null !== $this->config['max'] && $count > $this->config['max'] ) {
			return array(
				'rule'   => 'items_max',
				'params' => array( 'max' => $this->config['max'] ),
			);
		}

		return null;
	}

	/**
	 * Every message of the value: the group's own (keyed by its id) and each invalid sub-field's
	 * (keyed `<group>.<index>.<sub-field>`, the index counted from 0).
	 *
	 * @param mixed $value Sanitized value.
	 * @return array<string,string>
	 */
	public function errors( $value ): array {
		return $this->item_errors( $value, null );
	}

	/**
	 * errors(), without the messages of the sub-fields an item hides.
	 *
	 * @param mixed    $value   Sanitized value.
	 * @param callable $outside `fn( string $id ): array{visible:bool,value:mixed}`: a field of the page.
	 * @return array<string,string>
	 */
	public function page_errors( $value, callable $outside ): array {
		return $this->item_errors( $value, $outside );
	}

	/**
	 * @param mixed         $value   Sanitized value.
	 * @param callable|null $outside Resolves a field of the page; null: every sub-field shows.
	 * @return array<string,string>
	 */
	private function item_errors( $value, ?callable $outside ): array {
		$errors = array();
		foreach ( is_array( $value ) ? array_values( $value ) : array() as $index => $item ) {
			$hidden = null !== $outside && is_array( $item ) ? $this->hidden_subs( $item, $outside ) : array();
			foreach ( $this->subs as $sub_id => $sub ) {
				if ( isset( $hidden[ $sub_id ] ) ) {
					continue;
				}
				$message = $sub->validate( is_array( $item ) && array_key_exists( $sub_id, $item ) ? $item[ $sub_id ] : $sub->default_value() );
				if ( null !== $message ) {
					$errors[ $this->id() . '.' . $index . '.' . $sub_id ] = $message;
				}
			}
		}

		// The group's own checks (count, `validate_cb`) run once the items themselves are valid.
		if ( array() === $errors ) {
			$own = parent::validate( $value );
			if ( null !== $own ) {
				$errors[ $this->id() ] = $own;
			}
		}

		return $errors;
	}

	/**
	 * @param mixed $value Sanitized value.
	 */
	public function validate( $value ): ?string {
		$errors = $this->errors( $value );

		return array() === $errors ? null : (string) reset( $errors );
	}

	/**
	 * A stored group is read item by item, each sub-field through its own stored_value(): a sub-field value that no longer
	 * validates (a removed select option) falls back to that sub-field's default, instead of the whole group falling back
	 * to its default, and who is reading does not matter (a logged-out visitor keeps the posts of a non-public type).
	 *
	 * @param mixed $raw Stored value.
	 * @return mixed
	 */
	public function stored_value( $raw ) {
		$this->reading = true;
		try {
			$value = $this->sanitize( $raw );
		} finally {
			$this->reading = false;
		}

		// The sub-fields read their own values; this catches what the group's `sanitize_cb` changed afterwards.
		$items = array();
		foreach ( (array) $value as $item ) {
			foreach ( $this->subs as $sub_id => $sub ) {
				if ( null !== $sub->validate( $item[ $sub_id ] ) ) {
					$item[ $sub_id ] = $sub->default_value();
				}
			}
			$items[] = $item;
		}

		return $items;
	}

	protected function client_extra(): array {
		return array(
			'fields'     => array_values(
				array_map(
					static function ( AbstractField $sub ): array {
						return $sub->to_client();
					},
					$this->subs
				)
			),
			'item_title' => $this->config['item_title'],
			'item_icon'  => $this->config['item_icon'],
			'sortable'   => $this->config['sortable'],
			'addable'    => $this->config['addable'],
			'min'        => $this->config['min'],
			'max'        => $this->config['max'],
			'add_label'  => $this->config['add_label'],
		);
	}

	/** The count rules are the group's own (`min` / `max`), not the declarative ones: nothing to export in `validate` but `required`. */
	public function rules(): array {
		return array_intersect_key( parent::rules(), array( 'required' => true ) );
	}

	/**
	 * Sanitized, then filtered by the developer callback; never an associative array (the list is re-indexed).
	 *
	 * @param mixed $raw Raw value.
	 * @return mixed
	 */
	public function sanitize( $raw ) {
		$value = parent::sanitize( $raw );

		return is_array( $value ) ? array_values( $value ) : array();
	}
}
