<?php
/**
 * Image: one picture from the media library.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

/**
 * Renders an Upload Image field (thumbnail, name, size, and "Select image" / "Replace" / remove). The value is the attachment ID.
 * Any image type WordPress allows is accepted; `types` may only narrow that to image extensions. Not final: the unit tests stub
 * the attachment lookup by overriding `attachment()`.
 */
class ImageField extends AbstractMediaField {

	public static function types(): array {
		return array( 'image' );
	}

	protected function kind(): string {
		return 'image';
	}
}
