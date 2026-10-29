<?php
/**
 * The object handed to the browser (schema + current values + REST credentials + i18n).
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Assets;

use Fyldo\V1\Bootstrap\Loader;
use Fyldo\V1\I18n\Textdomain;
use Fyldo\V1\Instance;
use Fyldo\V1\Schema\Page;
use Fyldo\V1\Support\Dates;
use Fyldo\V1\Support\Naming;

/**
 * Builds the inline config for one instance.
 *
 * @internal
 */
final class ClientConfig {

	/**
	 * @return array<string,mixed>
	 */
	public static function build( Instance $instance ): array {
		$slug   = $instance->slug();
		$config = $instance->config();
		$store  = $instance->store();

		// Both kinds of page, in registration order (the navigation's). Only pages the current user may open are sent.
		$pages  = array();
		$groups = array_column( $instance->groups(), 'id' );
		foreach ( $instance->all_pages() as $page ) {
			if ( ! current_user_can( $instance->capability_for( $page ) ) ) {
				continue;
			}
			$entry = $page instanceof Page
				? $page->to_client( $store->client_values( $page ), $store->revision( $page ), $store->client_media( $page ) )
				: $page->to_client();
			// A group nobody registered (Instance::check_groups() reported it): the page shows ungrouped.
			if ( ! in_array( $entry['group'], $groups, true ) ) {
				$entry['group'] = '';
			}
			$pages[] = $entry;
		}

		// A form's schema only: a custom page reads a record over REST when it opens one.
		$forms = array();
		foreach ( $instance->forms() as $form ) {
			if ( current_user_can( $instance->capability_for( $form ) ) ) {
				$forms[] = $form->to_client();
			}
		}

		$client = array(
			'slug'         => $slug,
			'title'        => $instance->title(),
			'logo'         => $instance->logo(),
			'version'      => (string) $config['version'],
			'fyldoVersion' => (string) Loader::loaded_version(),
			'navigation'   => (string) $config['navigation'],
			'groups'       => $instance->groups(),
			'links'        => $config['links'],
			'notices'      => $instance->notices(),
			'pages'        => $pages,
			'forms'        => $forms,
			'dir'          => is_rtl() ? 'rtl' : 'ltr',
			'locale'       => str_replace( '_', '-', determine_locale() ),
			'rootId'       => Naming::dom_id( $slug ),
			'rest'         => array(
				'root'          => rest_url( Naming::rest_namespace( $slug ) . '/' ),
				// The site's REST root, so a custom page can call the plugin's own routes.
				'base'          => rest_url(),
				'nonce'         => wp_create_nonce( 'wp_rest' ),
				'instanceNonce' => wp_create_nonce( Naming::nonce_action( $slug ) ),
				'nonceHeader'   => Naming::nonce_header(),
				'refresh'       => admin_url( 'admin-ajax.php?action=' . Naming::nonce_refresh_action( $slug ) ),
			),
			'i18n'         => Textdomain::jed(),
			// The date and time fields: the zone comes from WordPress (never from a request); `auto` shows Jalali on a Persian site.
			'dates'        => array(
				'timezone'    => Dates::timezone_name(),
				'startOfWeek' => (int) get_option( 'start_of_week', 1 ),
				'calendar'    => 0 === strpos( (string) get_locale(), 'fa' ) ? 'jalali' : 'gregorian',
			),
		);

		/**
		 * Filters the final client config (schema, values, links…) for this instance.
		 *
		 * @internal The shape of the client config is not part of the public API; it may change in any release.
		 * @param array<string,mixed> $client Client config.
		 */
		return (array) apply_filters( Naming::hook( $slug, 'config' ), $client );
	}
}
