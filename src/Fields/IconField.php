<?php
/**
 * Icon: one Iconsax icon, stored by its kebab-case name.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;

/**
 * Renders an Icon Picker (a preview tile and the icon name that open a modal with a searchable icon grid). The value is the
 * icon's name, such as `setting-2`: the same convention as the `icon` option of a field or a page.
 *
 * The icon names live in the browser (the picker's modal chunk), not here: the server checks the shape of the name
 * (`^[a-z0-9]+(-[a-z0-9]+)*$`) and, when `icons` is given, that the name is one of them. A well-formed name the browser does
 * not know is accepted and simply draws nothing (the same as an unknown `icon` anywhere else).
 *
 * Config: `default` (an icon name, optional) and `icons` (a list of icon names the picker offers and the server accepts).
 */
final class IconField extends AbstractField {

	/** What an icon name looks like: lower-case words and numbers joined by single hyphens. Mirrors the browser's rule. */
	const PATTERN = '^[a-z0-9]+(-[a-z0-9]+)*$';

	public static function types(): array {
		return array( 'icon' );
	}

	protected function default_layout(): string {
		return 'field';
	}

	protected function extra_keys(): array {
		return array( 'icons' );
	}

	/** Whether the text has the shape of an icon name. */
	private static function is_name( string $text ): bool {
		return 1 === preg_match( '/' . self::PATTERN . '/D', $text );
	}

	protected function normalize_type( array $config ): array {
		$id = (string) $config['id'];

		$rules            = $config['validate'];
		$rules['pattern'] = self::PATTERN;

		$icons = null;
		if ( array_key_exists( 'icons', $config ) ) {
			if ( ! is_array( $config['icons'] ) || array() === $config['icons'] ) {
				throw new ConfigException( sprintf( 'Icon field "%s": `icons` must be a non-empty list of icon names like "setting-2".', $id ) );
			}

			$icons = array();
			foreach ( $config['icons'] as $name ) {
				if ( ! is_string( $name ) || ! self::is_name( $name ) ) {
					throw new ConfigException( sprintf( 'Icon field "%1$s": "%2$s" in `icons` is not an icon name like "setting-2" (lower case, words joined by "-").', $id, is_scalar( $name ) ? (string) $name : gettype( $name ) ) );
				}
				$icons[ $name ] = $name;
			}

			$icons            = array_values( $icons );
			$rules['allowed'] = $icons;
		}
		$config['icons']    = $icons;
		$config['validate'] = $rules;

		if ( array_key_exists( 'default', $config ) ) {
			$default = $config['default'];
			if ( ! is_string( $default ) || ( '' !== $default && ! self::is_name( $default ) ) ) {
				throw new ConfigException( sprintf( 'Icon field "%s": `default` must be an icon name like "setting-2".', $id ) );
			}
			if ( '' !== $default && null !== $icons && ! in_array( $default, $icons, true ) ) {
				throw new ConfigException( sprintf( 'Icon field "%1$s": `default` "%2$s" is not in `icons`.', $id, $default ) );
			}
		}

		return $config;
	}

	protected function sanitize_value( $raw ) {
		return is_string( $raw ) ? trim( $raw ) : '';
	}

	protected function client_extra(): array {
		return array(
			'icons' => $this->config['icons'],
		);
	}
}
