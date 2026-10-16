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
use Fyldo\V1\Support\Dates;
use Fyldo\V1\Support\Naming;

/**
 * Builds the inline config for one instance.
 */
final class ClientConfig {

	/**
	 * @return array<string,mixed>
	 */
	public static function build( Instance $instance ): array {
		$slug   = $instance->slug();
		$config = $instance->config();
		$store  = $instance->store();

		$pages = array();
		foreach ( $instance->pages() as $page ) {
			// Only pages the current user may change are sent.
			if ( ! current_user_can( $instance->capability_for( $page ) ) ) {
				continue;
			}
			$pages[] = $page->to_client( $store->client_values( $page ), $store->revision( $page ), $store->client_media( $page ) );
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
			'dir'          => is_rtl() ? 'rtl' : 'ltr',
			'locale'       => str_replace( '_', '-', determine_locale() ),
			'rootId'       => Naming::dom_id( $slug ),
			'rest'         => array(
				'root'          => rest_url( Naming::rest_namespace( $slug ) . '/' ),
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
		 * @param array<string,mixed> $client Client config.
		 */
		return (array) apply_filters( Naming::hook( $slug, 'config' ), $client );
	}
}
