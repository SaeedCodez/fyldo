<?php
/**
 * Slider: a number inside a bounded range, picked by dragging a thumb or with the arrow keys.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Validation\Rules;

/**
 * Renders a Slider with one thumb. `min` (0), `max` (100) and `step` (1) are config keys; they are exported as the
 * declarative `min` / `max` / `step` rules, so the server rejects (and the browser prevents) values outside the range or
 * off the step grid. A slider always has a value: `default` is `min` unless given, and `required` is implied. Stored as
 * int|float; text that is not a number is kept as text so the implied `number` rule reports it.
 */
final class SliderField extends AbstractField {

	public static function types(): array {
		return array( 'slider' );
	}

	protected function default_layout(): string {
		return 'stacked';
	}

	protected function extra_keys(): array {
		return array( 'min', 'max', 'step' );
	}

	protected function normalize_type( array $config ): array {
		$id = (string) $config['id'];

		$rules = $config['validate'];
		foreach ( array( 'min', 'max', 'step' ) as $key ) {
			if ( isset( $rules[ $key ] ) ) {
				throw new ConfigException( sprintf( 'Slider field "%1$s": set `%2$s` on the field, not in `validate`.', $id, $key ) );
			}
		}

		$min  = $config['min'] ?? 0;
		$max  = $config['max'] ?? 100;
		$step = $config['step'] ?? 1;
		foreach ( array(
			'min'  => $min,
			'max'  => $max,
			'step' => $step,
		) as $key => $number ) {
			if ( ! is_int( $number ) && ! is_float( $number ) ) {
				throw new ConfigException( sprintf( 'Slider field "%1$s": `%2$s` must be a number.', $id, $key ) );
			}
		}
		if ( $step <= 0 ) {
			throw new ConfigException( sprintf( 'Slider field "%s": `step` must be a number greater than 0.', $id ) );
		}
		if ( $min >= $max ) {
			throw new ConfigException( sprintf( 'Slider field "%s": `min` must be less than `max`.', $id ) );
		}

		$config['min']  = $min;
		$config['max']  = $max;
		$config['step'] = $step;

		$rules['number']   = true;
		$rules['required'] = true;
		$rules['min']      = $min;
		$rules['max']      = $max;
		$rules['step']     = $step;

		$config['validate'] = $rules;

		$config['default'] = array_key_exists( 'default', $config ) ? NumberField::read( $config['default'] ) : $min;
		if ( ! is_int( $config['default'] ) && ! is_float( $config['default'] ) ) {
			throw new ConfigException( sprintf( 'Slider field "%s": `default` must be a number.', $id ) );
		}

		$failure = Rules::check( $rules, $config['default'] );
		if ( null !== $failure ) {
			throw new ConfigException( sprintf( 'Slider field "%1$s": the default %2$s is outside the range or off the step (`min` %3$s, `max` %4$s, `step` %5$s).', $id, (string) $config['default'], (string) $min, (string) $max, (string) $step ) );
		}

		return $config;
	}

	protected function sanitize_value( $raw ) {
		return NumberField::read( $raw );
	}

	protected function client_extra(): array {
		return array(
			'min'  => $this->config['min'],
			'max'  => $this->config['max'],
			'step' => $this->config['step'],
		);
	}
}
