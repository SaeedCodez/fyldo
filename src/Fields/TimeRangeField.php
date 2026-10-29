<?php
/**
 * Time range: two times of day, start → end, each stored as `H:i`. An end earlier than the start is the next day.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

/**
 * See AbstractDateRangeField for the config and what is stored. A range may cross midnight (22:00 → 06:00); the end
 * cannot equal the start. `Dates::time_in_range()` tells whether a time is inside one.
 *
 * @internal
 */
final class TimeRangeField extends AbstractDateRangeField {

	public static function types(): array {
		return array( 'time_range' );
	}

	protected function kind(): string {
		return 'time';
	}

	protected function example(): string {
		return 'a time like 09:30 (24-hour)';
	}
}
