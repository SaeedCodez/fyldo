<?php
/**
 * A notice for the Fyldo screen (`Instance::admin_notice()`): validated here, drawn by the app's own Notice component.
 *
 * Never the core `.notice` markup: WordPress's admin JS moves every `.notice` under the first heading of `.wrap`, which
 * would tear it out of the Fyldo screen. These notices travel in the client config and are rendered in Fyldo's own
 * slot, under the Page Header.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Admin;

use Fyldo\V1\Schema\ConfigException;

/**
 * Normalised notice.
 */
final class Notice {

	const KEYS = array( 'id', 'tone', 'title', 'dismissible', 'page', 'action' );

	/** Tones of the design (Figma "Notice"), most severe first — the order they are shown in. */
	const TONES = array( 'red', 'amber', 'green', 'blue', 'gray' );

	/** WordPress's own words for the same tones. */
	const ALIASES = array(
		'error'   => 'red',
		'warning' => 'amber',
		'success' => 'green',
		'info'    => 'blue',
	);

	/**
	 * @param string              $message Plain text (no HTML): what happened and what to do next.
	 * @param array<string,mixed> $args    `tone` (gray default | blue | green | amber | red, or error | warning | success | info),
	 *                                     `title`, `dismissible` (default: errors and warnings stay until resolved),
	 *                                     `page` (a page id: show only there; default every page), `id`,
	 *                                     `action` (`label`, `url`, optional `external`: one link button).
	 * @return array{id:string,tone:string,title:string,message:string,dismissible:bool,page:string,action:array{label:string,url:string,external:bool}|null}
	 * @throws ConfigException On an invalid notice.
	 */
	public static function normalize( string $message, array $args ): array {
		$message = trim( $message );
		if ( '' === $message ) {
			throw new ConfigException( 'A notice needs a message.' );
		}

		$unknown = array_diff( array_keys( $args ), self::KEYS );
		if ( array() !== $unknown ) {
			throw new ConfigException( sprintf( 'Notice has unknown key(s): %s.', implode( ', ', $unknown ) ) );
		}

		$tone = isset( $args['tone'] ) ? (string) $args['tone'] : 'gray';
		$tone = self::ALIASES[ $tone ] ?? $tone;
		if ( ! in_array( $tone, self::TONES, true ) ) {
			throw new ConfigException( 'Notice tone must be one of: gray, blue, green, amber, red (or info, success, warning, error).' );
		}

		$action = null;
		if ( isset( $args['action'] ) ) {
			$given = (array) $args['action'];
			if ( ! isset( $given['label'], $given['url'] ) || '' === trim( (string) $given['label'] ) ) {
				throw new ConfigException( 'A notice action needs a `label` and a `url`.' );
			}
			$url = esc_url_raw( (string) $given['url'] );
			if ( '' === $url ) {
				throw new ConfigException( sprintf( 'The notice action URL "%s" is not valid.', (string) $given['url'] ) );
			}
			$action = array(
				'label'    => trim( (string) $given['label'] ),
				'url'      => $url,
				'external' => ! empty( $given['external'] ),
			);
		}

		$id = isset( $args['id'] ) ? (string) $args['id'] : md5( $tone . "\n" . $message );

		return array(
			'id'          => $id,
			'tone'        => $tone,
			'title'       => isset( $args['title'] ) ? trim( (string) $args['title'] ) : '',
			'message'     => $message,
			// Errors and warnings stay until the cause is fixed (design rule 6); the rest may be dismissed.
			'dismissible' => isset( $args['dismissible'] ) ? (bool) $args['dismissible'] : ! in_array( $tone, array( 'red', 'amber' ), true ),
			'page'        => isset( $args['page'] ) ? (string) $args['page'] : '',
			'action'      => $action,
		);
	}

	/**
	 * Most severe first; notices of one tone keep the order they were added in.
	 *
	 * @param array<int,array<string,mixed>> $notices Normalised notices.
	 * @return array<int,array<string,mixed>>
	 */
	public static function sort( array $notices ): array {
		$rank = array_flip( self::TONES );
		$keys = array_keys( $notices );
		usort(
			$keys,
			static function ( $a, $b ) use ( $notices, $rank ): int {
				$by_tone = $rank[ $notices[ $a ]['tone'] ] <=> $rank[ $notices[ $b ]['tone'] ];

				return 0 !== $by_tone ? $by_tone : $a <=> $b;
			}
		);

		return array_map(
			static function ( $key ) use ( $notices ) {
				return $notices[ $key ];
			},
			$keys
		);
	}
}
