<?php
/**
 * On/off switch.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

/**
 * Renders a Toggle (inline row).
 */
final class ToggleField extends AbstractBooleanField {

	public static function types(): array {
		return array( 'toggle' );
	}

	protected function default_layout(): string {
		return 'inline';
	}
}
