<?php
/**
 * File: one file from the media library.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

/**
 * Renders a Select File field (file tile, name, type and size, and "Select file" / "Replace" / remove). The value is the
 * attachment ID. Every type WordPress allows is accepted unless `types` narrows it. Not final: the unit tests stub the
 * attachment lookup by overriding `attachment()`.
 */
class FileField extends AbstractMediaField {

	public static function types(): array {
		return array( 'file' );
	}

	protected function kind(): string {
		return 'file';
	}
}
