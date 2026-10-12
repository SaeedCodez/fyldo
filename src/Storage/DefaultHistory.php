<?php
/**
 * Keeps the defaults a site already had when a plugin update changes them (`default_before` on a field).
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Storage;

use Fyldo\V1\Instance;
use Fyldo\V1\Schema\Page;
use Fyldo\V1\Support\Naming;
use Fyldo\V1\Support\Version;

/**
 * Fyldo remembers, per page, the plugin version (the instance `version`) it last ran on this site, in one autoloaded
 * option `{slug}__fyldo`. When a page is registered with a later version, every field of that page with nothing
 * stored gets the default it had in the version the site came from, so updating the plugin does not change what an
 * untouched setting does. A first run (a new site, a new page) only records the version. See docs/default-history.md.
 */
final class DefaultHistory {

	/** @var Instance */
	private $instance;

	public function __construct( Instance $instance ) {
		$this->instance = $instance;
	}

	/**
	 * Called once per request for each registered page. Costs one autoloaded `get_option` unless the version moved.
	 */
	public function apply( Page $page ): void {
		$version = (string) $this->instance->config()['version'];
		if ( ! Version::is_valid( $version ) ) {
			return; // No version, no history: nothing to compare with.
		}

		$name  = Naming::state_option( $this->instance->slug() );
		$state = get_option( $name, array() );
		$state = is_array( $state ) ? $state : array();
		$pages = isset( $state['pages'] ) && is_array( $state['pages'] ) ? $state['pages'] : array();
		$seen  = isset( $pages[ $page->id() ] ) ? (string) $pages[ $page->id() ] : null;

		if ( $seen === $version ) {
			return;
		}

		// A downgrade only records the version: the defaults of the older code apply again.
		$upgraded = null !== $seen && version_compare( $seen, $version, '<' );
		if ( $upgraded ) {
			$this->restore( $page, (string) $seen );
		}

		$pages[ $page->id() ] = $version;
		$state['pages']       = $pages;
		update_option( $name, $state, true );

		if ( $upgraded ) {
			/**
			 * Fires once per page when the plugin version it last ran moves forward, after the earlier defaults were kept.
			 * The place for a plugin's own migrations of that page (renamed fields, changed formats).
			 *
			 * @param string $page_id Page id.
			 * @param string $from    Version the page last ran.
			 * @param string $to      Current version.
			 */
			do_action( Naming::hook( $this->instance->slug(), 'upgraded' ), $page->id(), $seen, $version );
		}
	}

	/**
	 * Store, for every field with nothing stored, the default it had in `$from` when that differs from today's.
	 * What someone saved is never touched. Not a save: no `before_save` / `saved`, since nothing a page reads changes.
	 */
	private function restore( Page $page, string $from ): void {
		$store  = $this->instance->store();
		$stored = $store->raw( $page );
		$kept   = array();

		foreach ( $page->fields() as $id => $field ) {
			if ( array_key_exists( $id, $stored ) ) {
				continue;
			}

			$old = $field->default_at( $from );
			if ( $old === $field->default_value() ) {
				continue; // No change since then (or no history at all).
			}

			// An earlier default that no longer validates (a removed select option) would read as today's default anyway.
			$value = $field->sanitize( $old );
			if ( $value === $field->default_value() || null !== $field->validate( $value ) ) {
				continue;
			}

			$kept[ $id ] = $value;
		}

		if ( array() !== $kept ) {
			$store->save( $page, array_merge( $stored, $kept ) );
		}
	}
}
