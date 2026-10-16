<?php
/**
 * Date: one day, stored as `Y-m-d` (Gregorian), picked in the Jalali or the Gregorian calendar.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

/**
 * See AbstractDateTimeField for the config (`calendar`, `min`, `max`) and what is stored.
 */
final class DateField extends AbstractDateTimeField {

	public static function types(): array {
		return array( 'date' );
	}

	protected function kind(): string {
		return 'date';
	}

	protected function example(): string {
		return 'a date like 2026-10-20';
	}
}
