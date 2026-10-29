<?php
/**
 * Conditional display (`dependency`): when a field, a notice, a group's sub-field or a section shows.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Schema;

use Fyldo\V1\Fields\AbstractField;
use Fyldo\V1\Validation\Rules;

/**
 * A dependency is one condition or a list of them, Codestar style: `array( 'cache', '==', true )`, or
 * `array( array( 'cache', '==', true ), array( 'mode', 'any', array( 'redis', 'memcached' ) ) )`. The conditions of a
 * list must all hold; `'relation' => 'or'` in the list makes one enough. A condition on a field that is itself hidden
 * never holds, so hiding a field hides what depends on it. Mirror of app/lib/dependency.ts: the shared cases in
 * tests/fixtures/dependency-cases.json run on both sides.
 *
 * A hidden field is not part of the form: the browser neither checks nor sends it, and the server neither checks nor
 * saves it (what is stored stays). Inside a group item, a hidden sub-field is not checked; its value is saved as it is.
 *
 * @internal
 */
final class Dependency {

	const OPERATORS = array( '==', '!=', '>', '>=', '<', '<=', 'any', 'not-any', 'contains', 'not-contains', 'empty', 'not-empty' );

	/** Operators without a value: `array( 'logo', 'not-empty' )`. */
	const UNARY = array( 'empty', 'not-empty' );

	/** A number written as text, as both sides read it ("12", "-1.5"; not "1e3" or " 1"). */
	const NUMERIC = '/^-?\d+(\.\d+)?$/';

	/**
	 * The normalised dependency of `$owner` (a field or section id, for messages).
	 *
	 * @param mixed  $raw   Developer config.
	 * @param string $owner Field or section id.
	 * @return array{relation:string,conditions:array<int,array{field:string,operator:string,value:mixed}>}
	 * @throws ConfigException On an invalid dependency.
	 */
	public static function normalize( $raw, string $owner ): array {
		$usage = sprintf( '"%s": `dependency` must be a condition, array( \'field\', \'==\', \'value\' ), or a list of them.', $owner );
		if ( ! is_array( $raw ) || array() === $raw ) {
			throw new ConfigException( $usage );
		}

		$relation = 'and';
		if ( array_key_exists( 'relation', $raw ) ) {
			$relation = is_string( $raw['relation'] ) ? strtolower( $raw['relation'] ) : '';
			if ( ! in_array( $relation, array( 'and', 'or' ), true ) ) {
				throw new ConfigException( sprintf( '"%s": the `relation` of a dependency must be "and" or "or".', $owner ) );
			}
			unset( $raw['relation'] );
		}

		if ( array() === $raw || array_values( $raw ) !== $raw ) {
			throw new ConfigException( $usage );
		}

		// One condition starts with its field id; a list holds conditions.
		$conditions = is_string( $raw[0] ) ? array( $raw ) : $raw;
		$out        = array();
		foreach ( $conditions as $condition ) {
			$out[] = self::condition( $condition, $owner, $usage );
		}

		return array(
			'relation'   => $relation,
			'conditions' => $out,
		);
	}

	/**
	 * The field ids a dependency reads, without repeats.
	 *
	 * @param array{relation:string,conditions:array<int,array{field:string,operator:string,value:mixed}>} $dependency Normalised dependency.
	 * @return string[]
	 */
	public static function fields( array $dependency ): array {
		return array_values( array_unique( array_column( $dependency['conditions'], 'field' ) ) );
	}

	/**
	 * Throws when the dependencies go round in a circle (`a` shows when `b` does, `b` when `a` does).
	 *
	 * @param array<string,string[]> $graph Node => the nodes it depends on (`field:<id>`, `section:<id>`).
	 * @param string                 $where What the nodes belong to (for the message).
	 * @throws ConfigException On a cycle.
	 */
	public static function assert_acyclic( array $graph, string $where ): void {
		$state = array(); // node => 1 (being visited) | 2 (done)
		$path  = array();
		$visit = static function ( string $node ) use ( &$visit, &$state, &$path, $graph, $where ): void {
			if ( 2 === ( $state[ $node ] ?? 0 ) ) {
				return;
			}
			if ( 1 === ( $state[ $node ] ?? 0 ) ) {
				$loop   = array_slice( $path, (int) array_search( $node, $path, true ) );
				$loop[] = $node;
				throw new ConfigException( sprintf( '%1$s: the dependencies go round in a circle: %2$s.', $where, implode( ' → ', $loop ) ) );
			}
			$state[ $node ] = 1;
			$path[]         = $node;
			foreach ( $graph[ $node ] ?? array() as $next ) {
				$visit( $next );
			}
			array_pop( $path );
			$state[ $node ] = 2;
		};
		foreach ( array_keys( $graph ) as $node ) {
			$visit( (string) $node );
		}
	}

	/**
	 * Whether a dependency holds. `$resolve( $field_id )` says whether that field shows and what it holds (subject()).
	 *
	 * @param array{relation:string,conditions:array<int,array{field:string,operator:string,value:mixed}>} $dependency Normalised dependency.
	 * @param callable                                                                                       $resolve    `fn( string $id ): array{visible:bool,value:mixed}`.
	 */
	public static function matches( array $dependency, callable $resolve ): bool {
		$any = 'or' === $dependency['relation'];
		foreach ( $dependency['conditions'] as $condition ) {
			$field = $resolve( $condition['field'] );
			$holds = $field['visible'] && self::holds( $condition['operator'], $field['value'], $condition['value'] );
			if ( $holds === $any ) {
				return $any;
			}
		}

		return ! $any;
	}

	/**
	 * A field's value as conditions read it: "nothing chosen" (an image or post ID of 0, a range with both ends empty) is empty.
	 *
	 * @param AbstractField $field The field.
	 * @param mixed         $value Its value.
	 * @return mixed
	 */
	public static function subject( AbstractField $field, $value ) {
		$rules = $field->rules();
		if ( 0 === $value && ( ! empty( $rules['media'] ) || ! empty( $rules['relation'] ) ) ) {
			return null;
		}
		if ( Rules::is_range( $rules ) && is_array( $value ) && Rules::is_empty( $value['start'] ?? '' ) && Rules::is_empty( $value['end'] ?? '' ) ) {
			return '';
		}

		return $value;
	}

	/**
	 * Whether one condition holds for a value.
	 *
	 * @param string $operator One of OPERATORS.
	 * @param mixed  $value    The field's value (subject()).
	 * @param mixed  $target   The condition's value.
	 */
	public static function holds( string $operator, $value, $target ): bool {
		switch ( $operator ) {
			case '==':
				return self::is( $value, $target );
			case '!=':
				return ! self::is( $value, $target );
			case '>':
			case '>=':
			case '<':
			case '<=':
				$order = self::order( $value, $target );
				if ( null === $order ) {
					return false;
				}
				return '>' === $operator ? $order > 0 : ( '>=' === $operator ? $order >= 0 : ( '<' === $operator ? $order < 0 : $order <= 0 ) );
			case 'any':
				return self::any( $value, (array) $target );
			case 'not-any':
				return ! self::any( $value, (array) $target );
			case 'contains':
				return self::contains( $value, $target );
			case 'not-contains':
				return ! self::contains( $value, $target );
			case 'empty':
				return Rules::is_empty( $value );
			case 'not-empty':
				return ! Rules::is_empty( $value );
		}

		return false;
	}

	/**
	 * Equality: a list equals a value it holds (or a list with the same values, in any order); a boolean on either side
	 * compares truthiness (a toggle `== 'true'`, `== 1`); a number and a numeric text compare as numbers; the rest as text.
	 *
	 * @param mixed $value  Field value.
	 * @param mixed $target Condition value.
	 */
	private static function is( $value, $target ): bool {
		if ( is_array( $value ) ) {
			if ( ! is_array( $target ) ) {
				return self::any( $value, array( $target ) );
			}
			$value  = array_values( $value );
			$target = array_values( $target );
			if ( count( $value ) !== count( $target ) ) {
				return false;
			}
			foreach ( $value as $one ) {
				if ( ! self::any( $one, $target ) ) {
					return false;
				}
			}
			return true;
		}

		return self::equal( $value, $target );
	}

	/**
	 * Equality of two scalars (or null).
	 *
	 * @param mixed $a One.
	 * @param mixed $b The other.
	 */
	private static function equal( $a, $b ): bool {
		if ( is_array( $a ) || is_array( $b ) ) {
			return false;
		}
		if ( is_bool( $a ) || is_bool( $b ) ) {
			return self::truthy( $a ) === self::truthy( $b );
		}
		if ( ( is_int( $a ) || is_float( $a ) || is_int( $b ) || is_float( $b ) ) && self::is_number( $a ) && self::is_number( $b ) ) {
			return (float) $a === (float) $b;
		}

		return self::text( $a ) === self::text( $b );
	}

	/**
	 * Order of two values: numbers (and numeric texts) by size, two texts by their characters (dates and times in their
	 * stored format sort right); null when they cannot be ordered.
	 *
	 * @param mixed $a One.
	 * @param mixed $b The other.
	 */
	private static function order( $a, $b ): ?int {
		if ( self::is_number( $a ) && self::is_number( $b ) ) {
			return (float) $a <=> (float) $b;
		}
		if ( is_string( $a ) && is_string( $b ) && '' !== $a ) {
			return strcmp( $a, $b ) <=> 0;
		}

		return null;
	}

	/**
	 * Whether the value (or, for a list, one of its values) equals one of the targets.
	 *
	 * @param mixed             $value   Field value.
	 * @param array<int, mixed> $targets Condition values.
	 */
	private static function any( $value, array $targets ): bool {
		foreach ( is_array( $value ) ? $value : array( $value ) as $one ) {
			foreach ( $targets as $target ) {
				if ( self::equal( $one, $target ) ) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * A list holds the target; a text has it inside; anything else equals it.
	 *
	 * @param mixed $value  Field value.
	 * @param mixed $target Condition value.
	 */
	private static function contains( $value, $target ): bool {
		if ( is_array( $value ) ) {
			return self::any( $value, array( $target ) );
		}
		if ( is_string( $value ) ) {
			$needle = self::text( $target );
			return '' === $needle || false !== strpos( $value, $needle );
		}

		return self::equal( $value, $target );
	}

	/**
	 * @param mixed $value Value.
	 */
	private static function is_number( $value ): bool {
		return is_int( $value ) || is_float( $value ) || ( is_string( $value ) && 1 === preg_match( self::NUMERIC, $value ) );
	}

	/**
	 * @param mixed $value Value.
	 */
	private static function truthy( $value ): bool {
		if ( is_string( $value ) ) {
			return ! in_array( strtolower( $value ), array( '', '0', 'false' ), true );
		}
		if ( is_int( $value ) || is_float( $value ) ) {
			return 0.0 !== (float) $value;
		}

		return is_array( $value ) ? array() !== $value : (bool) $value;
	}

	/**
	 * A scalar as text, the same in PHP and in the browser (a float with no fraction has none: "2", not "2.0").
	 *
	 * @param mixed $value Value.
	 */
	private static function text( $value ): string {
		if ( null === $value ) {
			return '';
		}
		if ( is_bool( $value ) ) {
			return $value ? 'true' : 'false';
		}

		return is_float( $value ) && floor( $value ) === $value && abs( $value ) < 1e15 ? (string) (int) $value : (string) $value;
	}

	/**
	 * One condition: `array( 'field', 'operator', value )`, or `array( 'field', 'empty' )`.
	 *
	 * @param mixed  $condition Raw condition.
	 * @param string $owner     Field or section id (for messages).
	 * @param string $usage     The usage message.
	 * @return array{field:string,operator:string,value:mixed}
	 * @throws ConfigException On an invalid condition.
	 */
	private static function condition( $condition, string $owner, string $usage ): array {
		if ( ! is_array( $condition ) || array_values( $condition ) !== $condition || ! isset( $condition[0], $condition[1] ) || ! is_string( $condition[0] ) || '' === $condition[0] ) {
			throw new ConfigException( $usage );
		}

		$operator = is_string( $condition[1] ) ? $condition[1] : '';
		if ( ! in_array( $operator, self::OPERATORS, true ) ) {
			throw new ConfigException( sprintf( '"%1$s": unknown dependency operator "%2$s"; use one of: %3$s.', $owner, is_scalar( $condition[1] ) ? (string) $condition[1] : gettype( $condition[1] ), implode( ' ', self::OPERATORS ) ) );
		}

		$unary = in_array( $operator, self::UNARY, true );
		if ( count( $condition ) > 3 ) {
			throw new ConfigException( sprintf( '"%s": a condition is array( \'field\', \'operator\', value ). There is no 4th element: conditions see every field of the page.', $owner ) );
		}
		if ( $unary && 3 === count( $condition ) ) {
			throw new ConfigException( sprintf( '"%1$s": "%2$s" takes no value: array( \'%3$s\', \'%2$s\' ).', $owner, $operator, $condition[0] ) );
		}
		if ( ! $unary && 3 !== count( $condition ) ) {
			throw new ConfigException( sprintf( '"%1$s": the condition on "%2$s" needs a value: array( \'%2$s\', \'%3$s\', value ).', $owner, $condition[0], $operator ) );
		}

		$value = $unary ? null : $condition[2];
		if ( in_array( $operator, array( 'any', 'not-any' ), true ) ) {
			$value = is_array( $value ) ? array_values( $value ) : array( $value );
			if ( array() === $value || array() !== array_filter( $value, static fn( $one ) => ! is_scalar( $one ) ) ) {
				throw new ConfigException( sprintf( '"%1$s": "%2$s" takes a list of values, such as array( \'a\', \'b\' ).', $owner, $operator ) );
			}
		} elseif ( null !== $value && ! is_scalar( $value ) && ! ( '==' === $operator || '!=' === $operator ) ) {
			throw new ConfigException( sprintf( '"%1$s": the value of "%2$s" must be text, a number or a boolean.', $owner, $operator ) );
		} elseif ( is_array( $value ) && array() !== array_filter( $value, static fn( $one ) => ! is_scalar( $one ) ) ) {
			throw new ConfigException( sprintf( '"%s": a list value holds text, numbers or booleans.', $owner ) );
		}

		return array(
			'field'    => $condition[0],
			'operator' => $operator,
			'value'    => is_array( $value ) ? array_values( $value ) : $value,
		);
	}
}
