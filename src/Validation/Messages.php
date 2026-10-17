<?php
/**
 * Human-readable (translatable) messages for validation failures.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Validation;

use Fyldo\V1\Support\Dates;

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

			case 'number':
				return __( 'Enter a number.', 'fyldo' );

			case 'color':
				return __( 'Enter a valid color, like #rrggbb.', 'fyldo' );

			case 'code':
				return 'json' === ( $params['language'] ?? '' ) ? __( 'Enter valid JSON.', 'fyldo' ) : __( 'Markup is not allowed in CSS.', 'fyldo' );

			case 'date':
				return __( 'Enter a valid date.', 'fyldo' );

			case 'time':
				return __( 'Enter a valid time between 00:00 and 23:59.', 'fyldo' );

			case 'datetime':
				return __( 'Enter a valid date and time.', 'fyldo' );

			case 'too_early':
				/* translators: %s: the earliest date or time allowed. */
				return sprintf( __( 'Choose %s or later.', 'fyldo' ), Dates::display( (string) ( $params['kind'] ?? 'date' ), (string) ( $params['bound'] ?? '' ) ) );

			case 'too_late':
				/* translators: %s: the latest date or time allowed. */
				return sprintf( __( 'Choose %s or earlier.', 'fyldo' ), Dates::display( (string) ( $params['kind'] ?? 'date' ), (string) ( $params['bound'] ?? '' ) ) );

			case 'minute_step':
				$step = (int) ( $params['step'] ?? 1 );
				/* translators: %d: minutes between the times that can be chosen. */
				return sprintf( _n( 'Choose a time in steps of %d minute.', 'Choose a time in steps of %d minutes.', $step, 'fyldo' ), $step );

			case 'range_missing':
				if ( 'start' === ( $params['end'] ?? 'end' ) ) {
					return 'time' === ( $params['kind'] ?? 'date' ) ? __( 'Choose a start time.', 'fyldo' ) : __( 'Choose a start date.', 'fyldo' );
				}
				return 'time' === ( $params['kind'] ?? 'date' ) ? __( 'Choose an end time.', 'fyldo' ) : __( 'Choose an end date.', 'fyldo' );

			case 'range_order':
				return __( 'Choose an end after the start.', 'fyldo' );

			case 'range_equal':
				return __( 'Choose an end different from the start.', 'fyldo' );

			case 'allowed':
				return __( 'Choose one of the available options.', 'fyldo' );

			case 'items_min':
				$min = (int) ( $params['min'] ?? 0 );
				/* translators: %d: minimum number of items in a group. */
				return sprintf( _n( 'Add at least %d item.', 'Add at least %d items.', $min, 'fyldo' ), $min );

			case 'items_max':
				$max = (int) ( $params['max'] ?? 0 );
				/* translators: %d: maximum number of items in a group. */
				return sprintf( _n( 'Use no more than %d item.', 'Use no more than %d items.', $max, 'fyldo' ), $max );

			case 'media':
				return __( 'Choose a file from the media library.', 'fyldo' );

			case 'relation':
				return __( 'Choose an item from the list.', 'fyldo' );

			case 'attachment':
				return __( 'This file is no longer available. Choose another one.', 'fyldo' );

			case 'media_image':
				return __( 'Choose an image.', 'fyldo' );

			case 'media_type':
				return __( 'This file type is not allowed.', 'fyldo' );

			case 'media_size':
				/* translators: %s: the largest allowed file size, such as 2 MB. */
				return sprintf( __( 'Choose a file of %s or less.', 'fyldo' ), size_format( (int) ( $params['max'] ?? 0 ) ) );

			case 'min':
				if ( ! empty( $params['items'] ) ) {
					$min = (int) ( $params['min'] ?? 0 );
					/* translators: %d: minimum number of selected options. */
					return sprintf( _n( 'Select at least %d option.', 'Select at least %d options.', $min, 'fyldo' ), $min );
				}
				/* translators: %s: minimum allowed number. */
				return sprintf( __( 'Enter a value of at least %s.', 'fyldo' ), (string) ( $params['min'] ?? '' ) );

			case 'max':
				if ( ! empty( $params['items'] ) ) {
					$max = (int) ( $params['max'] ?? 0 );
					/* translators: %d: maximum number of selected options. */
					return sprintf( _n( 'Select no more than %d option.', 'Select no more than %d options.', $max, 'fyldo' ), $max );
				}
				/* translators: %s: maximum allowed number. */
				return sprintf( __( 'Enter a value of at most %s.', 'fyldo' ), (string) ( $params['max'] ?? '' ) );

			case 'step':
				/* translators: %s: the step, e.g. 5 (the value must be a multiple of it, counted from the minimum). */
				return sprintf( __( 'Enter a value in steps of %s.', 'fyldo' ), (string) ( $params['step'] ?? '' ) );

			default:
				return __( 'This value is not valid.', 'fyldo' );
		}
	}
}
