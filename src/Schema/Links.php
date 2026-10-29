<?php
/**
 * The `links` of an instance or a page: buttons that lead elsewhere (Documentation, Help, Changelog).
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Schema;

/**
 * Checks and normalises a `links` list. An instance's links also have a `placement`; a page's links are always in its
 * own Page Header.
 *
 * @internal
 */
final class Links {

	/**
	 * @param mixed  $raw       The config's `links`.
	 * @param string $owner     Who the messages name: `Fyldo "acme"`, `Page "general"`…
	 * @param bool   $placement Whether a link may say where it goes (instance links only).
	 * @return array<int,array<string,mixed>> label, url, icon, external (and placement).
	 * @throws ConfigException On a link without label or url, a URL `esc_url_raw()` rejects, a bad placement or an unknown key.
	 */
	public static function parse( $raw, string $owner, bool $placement ): array {
		$keys  = $placement ? array( 'label', 'url', 'icon', 'external', 'placement' ) : array( 'label', 'url', 'icon', 'external' );
		$links = array();
		foreach ( (array) $raw as $link ) {
			$link = (array) $link;
			if ( ! isset( $link['label'], $link['url'] ) ) {
				throw new ConfigException( sprintf( '%s: every link needs `label` and `url`.', $owner ) );
			}
			if ( ! $placement && isset( $link['placement'] ) ) {
				throw new ConfigException( sprintf( '%s: a page\'s links are always in its Page Header; remove `placement`.', $owner ) );
			}
			if ( array() !== array_diff( array_keys( $link ), $keys ) ) {
				throw new ConfigException( sprintf( '%1$s: a link has unknown key(s): %2$s.', $owner, implode( ', ', array_diff( array_keys( $link ), $keys ) ) ) );
			}
			if ( $placement ) {
				// `footer`: the sidebar footer (top navigation: its utility buttons). `header`: the Page Header actions.
				$where = isset( $link['placement'] ) ? (string) $link['placement'] : 'footer';
				if ( ! in_array( $where, array( 'footer', 'header' ), true ) ) {
					throw new ConfigException( sprintf( '%s: link placement must be "footer" or "header".', $owner ) );
				}
			}

			$url = esc_url_raw( (string) $link['url'] );
			if ( '' === $url ) {
				throw new ConfigException( sprintf( '%1$s: the link URL "%2$s" is not valid.', $owner, (string) $link['url'] ) );
			}

			$one = array(
				'label'    => (string) $link['label'],
				'url'      => $url,
				'icon'     => isset( $link['icon'] ) ? (string) $link['icon'] : '',
				'external' => ! empty( $link['external'] ),
			);
			if ( $placement ) {
				$one['placement'] = $where;
			}
			$links[] = $one;
		}

		return $links;
	}
}
