<?php
/**
 * What a capability guards: a settings page, a custom page, a form.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Schema;

/**
 * Instance::capability_for() reads the override; '' falls back to the instance's `capability`.
 */
interface Guarded {

	/** Capability override, or '' to use the instance default. */
	public function capability(): string;
}
