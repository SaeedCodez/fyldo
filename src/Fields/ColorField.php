<?php
/**
 * Color: one free colour, stored as `#rrggbb`.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;

/**
 * Renders a Color Picker (swatch + hex value, opening a panel with an area, a hue strip, a hex box and presets). The value
 * is `#rrggbb` in lower case, without alpha. Typed text is read leniently (`#abc`, `abc`, ` #AABBCC ` all work) and
 * normalised; text that is not a colour stays text (trimmed), so the implied `color` rule reports it instead of the value
 * being silently replaced. An empty value is allowed unless `required`.
 *
 * Config: `default` (a hex colour, optional) and `presets` (a list of hex colours; `false` hides the section).
 */
final class ColorField extends AbstractField {

	/** The colours of the Figma "Color Picker Panel" (layer names "Swatch #xxxxxx"), in reading order. Mirrors DEFAULT_PRESETS in app/lib/color.ts. */
	const DEFAULT_PRESETS = array(
		'#1d2327',
		'#50575e',
		'#8c8f94',
		'#c3c4c7',
		'#f0f0f1',
		'#ffffff',
		'#2271b1',
		'#135e96',
		'#00a32a',
		'#007017',
		'#dba617',
		'#996800',
		'#d63638',
		'#8a2424',
		'#8e44ad',
		'#e25c9a',
	);

	public static function types(): array {
		return array( 'color' );
	}

	protected function default_layout(): string {
		return 'field';
	}

	protected function extra_keys(): array {
		return array( 'presets' );
	}

	/**
	 * Reads text as a colour: `#abc`, `abc` and `#AABBCC` become `#aabbcc`. Anything else is kept (trimmed) so it can be reported;
	 * a value that is not text is nothing. Mirrors `sanitizeColor` in app/lib/color.ts.
	 *
	 * @param mixed $raw Raw value.
	 */
	public static function read( $raw ): string {
		if ( ! is_string( $raw ) ) {
			return '';
		}

		$text = trim( $raw );
		if ( 1 !== preg_match( '/^#?([0-9a-f]{3}|[0-9a-f]{6})$/Di', $text, $match ) ) {
			return $text;
		}

		$digits = strtolower( $match[1] );
		if ( 3 === strlen( $digits ) ) {
			$digits = $digits[0] . $digits[0] . $digits[1] . $digits[1] . $digits[2] . $digits[2];
		}

		return '#' . $digits;
	}

	/** Whether the text is a colour in its stored form. */
	private static function is_hex( string $text ): bool {
		return 1 === preg_match( '/^#[0-9a-f]{6}$/D', $text );
	}

	protected function normalize_type( array $config ): array {
		$id = (string) $config['id'];

		$rules          = $config['validate'];
		$rules['color'] = true;

		$config['validate'] = $rules;

		if ( array_key_exists( 'default', $config ) ) {
			$default = is_string( $config['default'] ) ? self::read( $config['default'] ) : null;
			if ( null === $default || ( '' !== $default && ! self::is_hex( $default ) ) ) {
				throw new ConfigException( sprintf( 'Color field "%s": `default` must be a hex color like #2271b1.', $id ) );
			}
			$config['default'] = $default;
		}

		$presets = array_key_exists( 'presets', $config ) ? $config['presets'] : self::DEFAULT_PRESETS;
		if ( false === $presets ) {
			$config['presets'] = false;
			return $config;
		}
		if ( ! is_array( $presets ) ) {
			throw new ConfigException( sprintf( 'Color field "%s": `presets` must be a list of hex colors, or false to hide them.', $id ) );
		}

		$list = array();
		foreach ( $presets as $preset ) {
			$hex = is_string( $preset ) ? self::read( $preset ) : '';
			if ( ! self::is_hex( $hex ) ) {
				throw new ConfigException( sprintf( 'Color field "%1$s": preset "%2$s" is not a hex color like #2271b1.', $id, is_scalar( $preset ) ? (string) $preset : gettype( $preset ) ) );
			}
			$list[ $hex ] = $hex;
		}

		// Nothing to offer is the same as hiding the section.
		$config['presets'] = array() === $list ? false : array_values( $list );

		return $config;
	}

	protected function sanitize_value( $raw ) {
		return self::read( $raw );
	}

	protected function client_extra(): array {
		return array(
			'presets' => $this->config['presets'],
		);
	}
}
