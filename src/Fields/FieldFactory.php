<?php
/**
 * Field type id → class.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;

/**
 * Builds field objects from developer config.
 */
final class FieldFactory {

	/**
	 * Field classes shipped with this version.
	 *
	 * @return array<int,class-string<AbstractField>>
	 */
	public static function classes(): array {
		return array(
			TextField::class,
			NumberField::class,
			PasswordField::class,
			NoticeField::class,
			TextareaField::class,
			ToggleField::class,
			CheckboxField::class,
			CheckboxGroupField::class,
			RadioField::class,
			SegmentedField::class,
			SelectField::class,
			SliderField::class,
			MultiSelectField::class,
		);
	}

	/**
	 * @param array<string,mixed> $config Raw field config (must contain `type`).
	 * @throws ConfigException On unknown type or invalid config.
	 */
	public static function create( array $config ): AbstractField {
		$type = isset( $config['type'] ) ? (string) $config['type'] : '';

		$supported = array();
		foreach ( self::classes() as $class ) {
			foreach ( $class::types() as $id ) {
				$supported[] = $id;
				if ( $id === $type ) {
					return new $class( $config );
				}
			}
		}

		throw new ConfigException(
			sprintf(
				'Unknown field type "%1$s" (field "%2$s"). Supported in this version: %3$s.',
				$type,
				isset( $config['id'] ) ? (string) $config['id'] : '?',
				implode( ', ', $supported )
			)
		);
	}
}
