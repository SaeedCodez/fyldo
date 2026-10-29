<?php
/**
 * Iconsax icons on the server: one icon's `<svg>` markup, and whether a name is an icon.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Support;

/**
 * Behind Fyldo::icon() and Fyldo::is_icon(). The browser loads one small module per icon
 * (`assets/dist/icons/<name without hyphens>.js`, `export default [["path",{…}],…]`); this class reads the same module, so a
 * page that draws an icon itself (a site's front end, an email) gets exactly the icons it uses and never the whole set.
 *
 * Only names from IconNames are read, so a name can never point at another file. The markup keeps a fixed set of
 * elements and attributes (no script, no event handlers), with attributes in kebab case and strokes in `currentColor`.
 *
 * @internal
 */
final class Icons {

	/**
	 * Elements an icon may use; anything else is dropped.
	 *
	 * @internal
	 */
	const ELEMENTS = array( 'path', 'g', 'circle', 'ellipse', 'line', 'polygon', 'polyline', 'rect' );

	/**
	 * Attributes an icon element may carry (kebab case); anything else is dropped.
	 *
	 * @internal
	 */
	const ATTRIBUTES = array( 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'opacity', 'fill-rule', 'clip-rule', 'transform' );

	/** @var array<string,true>|null Name → true, built once from IconNames. */
	private static $names = null;

	/** @var array<string,string> Inner markup by name ('' = unreadable). */
	private static $bodies = array();

	/** @var string|null Where the modules are read from; null = this copy's assets/dist/icons. */
	private static $dir = null;

	/**
	 * Whether `$name` is an Iconsax name Fyldo has (kebab case, e.g. `setting-2`).
	 *
	 * @internal
	 */
	public static function exists( string $name ): bool {
		if ( null === self::$names ) {
			self::$names = array_fill_keys( IconNames::ALL, true );
		}

		return isset( self::$names[ $name ] );
	}

	/**
	 * One icon as an `<svg>` element: 24×24 viewBox, `fill="none"`, drawn in `currentColor`, decorative (`aria-hidden`)
	 * unless it has a label. '' for a name that is not an icon.
	 *
	 * @param string              $name Iconsax name in kebab case (`setting-2`).
	 * @param array<string,mixed> $args `size` (px, sets width and height; none by default so CSS sizes it), `class`,
	 *                                  `label` (an accessible name: `role="img"` and `aria-label` instead of `aria-hidden`).
	 * @internal
	 */
	public static function svg( string $name, array $args = array() ): string {
		$body = self::body( $name );
		if ( '' === $body ) {
			return '';
		}

		$size  = isset( $args['size'] ) && is_numeric( $args['size'] ) && (int) $args['size'] > 0 ? (int) $args['size'] : 0;
		$class = isset( $args['class'] ) && is_string( $args['class'] ) ? trim( $args['class'] ) : '';
		$label = isset( $args['label'] ) && is_string( $args['label'] ) ? trim( $args['label'] ) : '';

		$attributes  = $size > 0 ? sprintf( ' width="%1$d" height="%1$d"', $size ) : '';
		$attributes .= ' viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"';
		$attributes .= '' !== $class ? ' class="' . esc_attr( $class ) . '"' : '';
		$attributes .= '' !== $label ? ' role="img" aria-label="' . esc_attr( $label ) . '"' : ' aria-hidden="true"';
		$attributes .= ' focusable="false"';

		return '<svg' . $attributes . '>' . $body . '</svg>';
	}

	/**
	 * Tests point the reader at fixture modules (assets/dist is built, not in git); null restores the default.
	 *
	 * @internal
	 * @param string|null $dir Directory holding `<key>.js` modules.
	 */
	public static function use_directory( ?string $dir ): void {
		self::$dir    = $dir;
		self::$bodies = array();
	}

	/** The icon's shapes as markup, read once per request; '' when the name is not an icon or its module is unreadable. */
	private static function body( string $name ): string {
		if ( ! self::exists( $name ) ) {
			return '';
		}
		if ( isset( self::$bodies[ $name ] ) ) {
			return self::$bodies[ $name ];
		}

		$dir  = self::$dir ?? dirname( __DIR__, 2 ) . '/assets/dist/icons';
		$file = $dir . '/' . str_replace( '-', '', $name ) . '.js';
		$code = is_readable( $file ) ? (string) file_get_contents( $file ) : ''; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- a local file of this copy, chosen from a fixed list.
		$json = trim( (string) preg_replace( '/^\s*export\s+default\s+|;\s*$/', '', $code ) );
		$tree = '' !== $json ? json_decode( $json, true ) : null;

		self::$bodies[ $name ] = is_array( $tree ) ? self::nodes( $tree ) : '';

		return self::$bodies[ $name ];
	}

	/**
	 * Markup of `[tag, attributes, children?]` nodes (the module's shape).
	 *
	 * @param array<int|string,mixed> $nodes Nodes.
	 */
	private static function nodes( array $nodes ): string {
		$out = '';
		foreach ( $nodes as $node ) {
			if ( ! is_array( $node ) || ! isset( $node[0] ) || ! is_string( $node[0] ) || ! in_array( $node[0], self::ELEMENTS, true ) ) {
				continue;
			}

			$attributes = '';
			foreach ( isset( $node[1] ) && is_array( $node[1] ) ? $node[1] : array() as $key => $value ) {
				$key = strtolower( (string) preg_replace( '/[A-Z]/', '-$0', (string) $key ) );
				if ( in_array( $key, self::ATTRIBUTES, true ) && is_scalar( $value ) ) {
					$attributes .= sprintf( ' %s="%s"', $key, esc_attr( (string) $value ) );
				}
			}

			$inner = isset( $node[2] ) && is_array( $node[2] ) ? self::nodes( $node[2] ) : '';
			$out  .= '<' . $node[0] . $attributes . ( '' === $inner ? '/>' : '>' . $inner . '</' . $node[0] . '>' );
		}

		return $out;
	}
}
