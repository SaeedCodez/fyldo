<?php
/**
 * Base of every field that picks from a list of options: `select`, `radio`, `checkbox_group`.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;

/**
 * Option list handling shared by the option-based types.
 */
abstract class AbstractOptionsField extends AbstractField {

	/** @var array<int,array<string,mixed>>|null */
	private $resolved = null;

	/** Name used in registration errors ("Select", "Radio", "Checkbox group"). */
	abstract protected function noun(): string;

	/**
	 * Optional keys an option array may carry besides `value`, `label` and `disabled`.
	 *
	 * @return string[]
	 */
	protected function option_keys(): array {
		return array();
	}

	/**
	 * Validates `options` and resolves an array immediately (a callable is resolved lazily, once per request).
	 *
	 * @param array<string,mixed> $config Config after common normalisation.
	 * @return array<string,mixed>
	 * @throws ConfigException When options are missing or malformed.
	 */
	protected function normalize_options( array $config ): array {
		$options = $config['options'] ?? null;

		if ( ! is_array( $options ) && ! is_callable( $options ) ) {
			throw new ConfigException( sprintf( '%1$s field "%2$s" needs `options` (an array or a callable returning one).', $this->noun(), $config['id'] ) );
		}

		if ( is_array( $options ) ) {
			$this->resolved = $this->build_options( $options, (string) $config['id'] );
			if ( array() === $this->resolved ) {
				throw new ConfigException( sprintf( '%1$s field "%2$s" has no options.', $this->noun(), $config['id'] ) );
			}
		}

		return $config;
	}

	/**
	 * Options as a list of `value` / `label` / `disabled` (+ type-specific keys) objects.
	 *
	 * @return array<int,array<string,mixed>>
	 */
	public function options(): array {
		if ( null === $this->resolved ) {
			$this->resolved = $this->build_options( (array) call_user_func( $this->config['options'] ), $this->id() );
		}

		return $this->resolved;
	}

	/**
	 * Values a user may pick (disabled options stay visible but cannot be chosen).
	 *
	 * @return string[]
	 */
	protected function enabled_values(): array {
		$values = array();
		foreach ( $this->options() as $option ) {
			if ( empty( $option['disabled'] ) ) {
				$values[] = (string) $option['value'];
			}
		}

		return $values;
	}

	/**
	 * Accepts `[ value => label ]` or `[ [ 'value' =>, 'label' =>, 'disabled' =>, …type keys ] ]`.
	 *
	 * @param array<mixed> $raw      Developer options.
	 * @param string       $field_id For error messages.
	 * @return array<int,array<string,mixed>>
	 * @throws ConfigException On malformed options.
	 */
	private function build_options( array $raw, string $field_id ): array {
		$list = array();
		$seen = array();

		foreach ( $raw as $key => $item ) {
			if ( is_array( $item ) ) {
				if ( ! isset( $item['value'], $item['label'] ) ) {
					throw new ConfigException( sprintf( '%1$s field "%2$s": option arrays need `value` and `label`.', $this->noun(), $field_id ) );
				}
				$option = array(
					'value'    => (string) $item['value'],
					'label'    => (string) $item['label'],
					'disabled' => ! empty( $item['disabled'] ),
				);
				foreach ( $this->option_keys() as $extra ) {
					if ( isset( $item[ $extra ] ) && '' !== $item[ $extra ] ) {
						$option[ $extra ] = (string) $item[ $extra ];
					}
				}
			} else {
				// PHP turns numeric-string keys into ints: cast back.
				$option = array(
					'value'    => (string) $key,
					'label'    => (string) $item,
					'disabled' => false,
				);
			}

			if ( isset( $seen[ $option['value'] ] ) ) {
				throw new ConfigException( sprintf( '%1$s field "%2$s": option value "%3$s" is used twice.', $this->noun(), $field_id, $option['value'] ) );
			}
			$seen[ $option['value'] ] = true;

			$list[] = $option;
		}

		return $list;
	}
}
