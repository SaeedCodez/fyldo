<?php
/**
 * Translations for Fyldo's own strings, loaded from the WINNING copy's `languages/` directory.
 * Bundled copies do not get translate.wordpress.org files, so they carry their own.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\I18n;

use Fyldo\V1\Bootstrap\Loader;

/**
 * PHP `.mo` loading and UI (JED) data for the browser.
 */
final class Textdomain {

	const DOMAIN = 'fyldo';

	public static function load(): void {
		$path = Loader::loaded_path();
		if ( null === $path ) {
			return;
		}

		$mo = $path . '/languages/' . self::DOMAIN . '-' . determine_locale() . '.mo';
		if ( is_readable( $mo ) ) {
			load_textdomain( self::DOMAIN, $mo );
		}
	}

	/**
	 * JED locale data for the UI strings of the current locale, or null (English source strings).
	 *
	 * @return array<string,mixed>|null
	 */
	public static function jed(): ?array {
		$path = Loader::loaded_path();
		if ( null === $path ) {
			return null;
		}

		$file = $path . '/languages/' . self::DOMAIN . '-' . determine_locale() . '.json';
		if ( ! is_readable( $file ) ) {
			return null;
		}

		$data = json_decode( (string) file_get_contents( $file ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- local file.

		return is_array( $data ) ? $data : null;
	}
}
