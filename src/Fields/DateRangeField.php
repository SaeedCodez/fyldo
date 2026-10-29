<?php
/**
 * Date range: two days, start → end, each stored as `Y-m-d` (Gregorian).
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

/**
 * See AbstractDateRangeField for the config and what is stored. The end may be the start's day (both days count).
 *
 * @internal
 */
final class DateRangeField extends AbstractDateRangeField {

	public static function types(): array {
		return array( 'date_range' );
	}

	protected function kind(): string {
		return 'date';
	}

	protected function example(): string {
		return 'a date like 2026-10-20';
	}
}
