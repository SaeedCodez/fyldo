<?php
/**
 * Human-readable (translatable) messages for validation failures.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Validation;

/**
 * Rule id → message. Literal strings so `wp i18n make-pot` can extract them.
 */
final class Messages {

	/**
	 * @param string              $rule   Rule id from Rules::check().
	 * @param array<string,mixed> $params Rule parameters.
	 */
	public static function for( string $rule, array $params = array() ): string {
		switch ( $rule ) {
			case 'required':
				return __( 'This field is required.', 'fyldo' );

			case 'min_length':
				$min = (int) ( $params['min'] ?? 0 );
				/* translators: %d: minimum number of characters. */
				return sprintf( _n( 'Use at least %d character.', 'Use at least %d characters.', $min, 'fyldo' ), $min );

			case 'max_length':
				$max = (int) ( $params['max'] ?? 0 );
				/* translators: %d: maximum number of characters. */
				return sprintf( _n( 'Use no more than %d character.', 'Use no more than %d characters.', $max, 'fyldo' ), $max );

			case 'pattern':
				return __( 'This value is not in the expected format.', 'fyldo' );

			case 'schemes':
			case 'url':
				return __( 'Enter a valid URL.', 'fyldo' );

			case 'email':
				return __( 'Enter a valid email address.', 'fyldo' );

			case 'allowed':
				return __( 'Choose one of the available options.', 'fyldo' );

			case 'min':
				/* translators: %s: minimum allowed number. */
				return sprintf( __( 'Enter a value of at least %s.', 'fyldo' ), (string) ( $params['min'] ?? '' ) );

			case 'max':
				/* translators: %s: maximum allowed number. */
				return sprintf( __( 'Enter a value of at most %s.', 'fyldo' ), (string) ( $params['max'] ?? '' ) );

			default:
				return __( 'This value is not valid.', 'fyldo' );
		}
	}
}
