<?php
/**
 * Version numbers as plugins write them ("2.0.0", "1.4", "3.0.0-beta.1"), compared with version_compare().
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Support;

/**
 * The one place that says what a version number is.
 */
final class Version {

	/** One to four dot-separated numbers, optionally followed by a pre-release part (`-beta.1`, `-rc.2`). */
	const PATTERN = '/^\d+(\.\d+){0,3}(-[0-9A-Za-z.-]+)?$/';

	public static function is_valid( string $version ): bool {
		return 1 === preg_match( self::PATTERN, $version );
	}
}
