<?php
/**
 * Datetime range: two moments, start → end, each stored in UTC as `Y-m-d H:i:s` and shown in the site's time zone.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

/**
 * See AbstractDateRangeField for the config and what is stored. The end comes strictly after the start;
 * `Dates::range_to_site()` reads both ends in the site's time zone.
 *
 * @internal
 */
final class DateTimeRangeField extends AbstractDateRangeField {

	public static function types(): array {
		return array( 'datetime_range' );
	}

	protected function kind(): string {
		return 'datetime';
	}

	protected function example(): string {
		return 'a UTC datetime like 2026-10-20 11:00:00';
	}
}
