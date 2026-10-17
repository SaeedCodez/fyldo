<?php
/**
 * A plugin's own colours for its Fyldo screen (docs/theming.md).
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Support;

use Fyldo\V1\Schema\ConfigException;

/**
 * The `theme` of an instance: colours for the steps of Figma's Theme collection (a brand ramp and a neutral ramp).
 * Every semantic colour of Fyldo (buttons, borders, text, focus, toggles, …) points at one of these steps, so changing a
 * step recolours everything that uses it; the status colours (info, success, warning, error) are not themeable.
 * The colours are set as custom properties on the instance's root element, so they reach no other instance.
 */
final class Theme {

	/**
	 * The steps a theme may set, by ramp: the variables of Figma's Theme collection (`brand/600` → `brand` `600`).
	 * ThemeTest checks this list against tokens/figma.tokens.json, so it follows Figma.
	 */
	const STEPS = array(
		'brand'   => array( '50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950' ),
		'neutral' => array( 'background-100', 'background-200', '100', '200', '300', '400', '500', '600', '700', '800', '850', '900', '1000', '1000-hover', 'overlay' ),
	);

	/**
	 * Validates a `theme` config value.
	 *
	 * @param string $slug  Instance slug (for messages).
	 * @param mixed  $theme `array( 'brand' => array( 600 => '#ff6b4a', … ), 'neutral' => array( … ) )`; any step may be left
	 *                      out (it keeps Fyldo's colour).
	 * @return array<string,string> Custom property name → lower-case hex colour, in the order of STEPS.
	 * @throws ConfigException On an unknown ramp or step, or a value that is not a hex colour.
	 */
	public static function normalize( string $slug, $theme ): array {
		if ( null === $theme || array() === $theme ) {
			return array();
		}
		if ( ! is_array( $theme ) ) {
			throw new ConfigException( sprintf( 'Fyldo "%s": theme must be an array of ramps (brand, neutral).', $slug ) );
		}

		$unknown = array_diff( array_map( 'strval', array_keys( $theme ) ), array_keys( self::STEPS ) );
		if ( array() !== $unknown ) {
			throw new ConfigException( sprintf( 'Fyldo "%1$s": unknown theme ramp(s): %2$s. Known: brand, neutral.', $slug, implode( ', ', $unknown ) ) );
		}

		$vars = array();
		foreach ( self::STEPS as $ramp => $steps ) {
			$colors = $theme[ $ramp ] ?? array();
			if ( ! is_array( $colors ) ) {
				throw new ConfigException( sprintf( 'Fyldo "%1$s": theme.%2$s must be an array of step => hex colour.', $slug, $ramp ) );
			}
			// PHP turns the key '600' into the integer 600: compare as strings.
			$given = array();
			foreach ( $colors as $step => $color ) {
				$given[ (string) $step ] = $color;
			}
			$unknown = array_diff( array_keys( $given ), $steps );
			if ( array() !== $unknown ) {
				throw new ConfigException(
					sprintf( 'Fyldo "%1$s": unknown theme.%2$s step(s): %3$s. Known: %4$s.', $slug, $ramp, implode( ', ', $unknown ), implode( ', ', $steps ) )
				);
			}

			foreach ( $steps as $step ) {
				if ( ! array_key_exists( $step, $given ) ) {
					continue;
				}
				$color = $given[ $step ];
				if ( ! is_string( $color ) || 1 !== preg_match( '/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i', $color ) ) {
					throw new ConfigException(
						sprintf( 'Fyldo "%1$s": theme.%2$s.%3$s must be a hex colour (#rgb, #rrggbb or #rrggbbaa).', $slug, $ramp, $step )
					);
				}
				$vars[ '--fyldo-theme-' . $ramp . '-' . $step ] = strtolower( $color );
			}
		}

		return $vars;
	}

	/**
	 * The theme as the root element's `style` attribute value ('' for none).
	 *
	 * @param array<string,string> $vars From normalize().
	 */
	public static function style( array $vars ): string {
		$style = '';
		foreach ( $vars as $name => $color ) {
			$style .= $name . ':' . $color . ';';
		}

		return $style;
	}
}
