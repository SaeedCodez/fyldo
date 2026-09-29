<?php
/**
 * A single checkbox: agreeing to one statement.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

/**
 * Renders a Checkbox (inline row). For an instant on/off setting use `toggle`; for several options use `checkbox_group`.
 */
final class CheckboxField extends AbstractBooleanField {

	public static function types(): array {
		return array( 'checkbox' );
	}

	protected function default_layout(): string {
		return 'inline';
	}
}
