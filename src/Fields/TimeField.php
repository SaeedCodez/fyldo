<?php
/**
 * Time: a time of day, stored as `H:i` (24-hour), typed or picked from an Hour and a Minute column.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

/**
 * See AbstractDateTimeField for the config (`min`, `max`, `step`) and what is stored.
 *
 * @internal
 */
final class TimeField extends AbstractDateTimeField {

	public static function types(): array {
		return array( 'time' );
	}

	protected function kind(): string {
		return 'time';
	}

	protected function example(): string {
		return 'a time like 09:30 (24-hour)';
	}
}
