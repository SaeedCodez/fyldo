<?php
/**
 * Datetime: one moment, stored in UTC as `Y-m-d H:i:s` (like `post_date_gmt`) and shown in the site's time zone.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

/**
 * See AbstractDateTimeField for the config (`calendar`, `min`, `max`, `step`) and what is stored.
 */
final class DateTimeField extends AbstractDateTimeField {

	public static function types(): array {
		return array( 'datetime' );
	}

	protected function kind(): string {
		return 'datetime';
	}

	protected function example(): string {
		return 'a UTC datetime like 2026-10-20 11:00:00';
	}
}
