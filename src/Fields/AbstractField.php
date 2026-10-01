<?php
/**
 * Base class of every field type.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Validation\Messages;
use Fyldo\V1\Validation\Rules;

/**
 * One field of one section: definition + server-side sanitize/validate + client export.
 */
abstract class AbstractField {

	/** Keys every field accepts. */
	const COMMON_KEYS = array(
		'id',
		'type',
		'label',
		'description',
		'default',
		'disabled',
		'layout',
		'icon',
		'badge',
		'validate',
		'validate_cb',
		'sanitize_cb',
	);

	/** @var array<string,mixed> */
	protected $config;

	/**
	 * @param array<string,mixed> $config Raw developer config for this field.
	 * @throws ConfigException On invalid configuration.
	 */
	final public function __construct( array $config ) {
		$this->config = $this->normalize( $config );
	}

	/** Field type ids handled by the class (e.g. `text`, `url`). */
	abstract public static function types(): array;

	/** Default layout in a Setting Row. */
	abstract protected function default_layout(): string;

	/**
	 * Cast a raw (untrusted) value into the storage representation.
	 *
	 * @param mixed $raw Value from the request.
	 * @return mixed
	 */
	abstract protected function sanitize_value( $raw );

	/**
	 * Value used when nothing is stored.
	 *
	 * @return mixed
	 */
	protected function fallback_default() {
		return '';
	}

	/** Extra keys accepted by the concrete type. */
	protected function extra_keys(): array {
		return array();
	}

	/** Keys the type accepts. Display-only types narrow this to what they render. */
	protected function accepted_keys(): array {
		return array_merge( self::COMMON_KEYS, $this->extra_keys() );
	}

	/** Every control has a visible or accessible name; a display-only type may go without. */
	protected function requires_label(): bool {
		return true;
	}

	/**
	 * Concrete types add their own normalisation (and may extend `validate` rules) here.
	 *
	 * @param array<string,mixed> $config Config after common normalisation.
	 * @return array<string,mixed>
	 */
	protected function normalize_type( array $config ): array {
		return $config;
	}

	/**
	 * Implicit, type-specific checks that always run (e.g. email format).
	 *
	 * @param mixed $value Sanitized value.
	 * @return array{rule:string,params:array<string,mixed>}|null
	 */
	protected function implicit_check( $value ): ?array { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found -- overridden by the types that need it.
		return null;
	}

	public function id(): string {
		return (string) $this->config['id'];
	}

	public function type(): string {
		return (string) $this->config['type'];
	}

	public function label(): string {
		return (string) $this->config['label'];
	}

	/** Whether the field owns a value in the option. Display-only types (`notice`) do not: they never reach storage or REST. */
	public function is_stored(): bool {
		return true;
	}

	/**
	 * An incoming value that means "leave what is stored alone" (a write-only password sent as `null`).
	 *
	 * @param mixed $raw Raw value from the request.
	 */
	public function keeps_stored( $raw ): bool { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found -- overridden by write-only types.
		return false;
	}

	/** A disabled field ignores incoming values. */
	public function is_disabled(): bool {
		return false !== $this->config['disabled'];
	}

	/**
	 * Default value, fully sanitized.
	 *
	 * @return mixed
	 */
	public function default_value() {
		return array_key_exists( 'default', $this->config ) ? $this->config['default'] : $this->fallback_default();
	}

	/**
	 * The value as the browser receives it. Write-only types hide the real one.
	 *
	 * @param mixed $value Stored (sanitized) value.
	 * @return mixed
	 */
	public function client_value( $value ) {
		return $value;
	}

	/**
	 * Sanitize an untrusted value (developer callback first, then the type's own sanitizer).
	 *
	 * @param mixed $raw Raw value.
	 * @return mixed
	 */
	public function sanitize( $raw ) {
		$value = $this->sanitize_value( $raw );

		if ( isset( $this->config['sanitize_cb'] ) && is_callable( $this->config['sanitize_cb'] ) ) {
			$value = call_user_func( $this->config['sanitize_cb'], $value );
		}

		return $value;
	}

	/**
	 * Validate a sanitized value. Returns a translated message, or null when valid.
	 *
	 * @param mixed $value Sanitized value.
	 */
	public function validate( $value ): ?string {
		$failure = $this->failure( $value );
		if ( null !== $failure ) {
			return Messages::for( $failure['rule'], $failure['params'] );
		}

		if ( isset( $this->config['validate_cb'] ) && is_callable( $this->config['validate_cb'] ) ) {
			$result = call_user_func( $this->config['validate_cb'], $value );
			if ( is_string( $result ) && '' !== $result ) {
				return $result;
			}
			if ( false === $result ) {
				return Messages::for( 'invalid' );
			}
		}

		return null;
	}

	/**
	 * Rule id of the first failing declarative rule (used by tests and the shared fixture suite).
	 *
	 * @param mixed $value Sanitized value.
	 * @return array{rule:string,params:array<string,mixed>}|null
	 */
	public function failure( $value ): ?array {
		$rules = $this->rules();

		$declared = Rules::check( $rules, $value );
		if ( null !== $declared ) {
			return $declared;
		}

		return Rules::is_empty( $value ) ? null : $this->implicit_check( $value );
	}

	/** Declarative rules (developer + type-derived). Exported to the client. */
	public function rules(): array {
		return (array) ( $this->config['validate'] ?? array() );
	}

	/**
	 * Description of this field for the browser. Never contains callbacks.
	 *
	 * @return array<string,mixed>
	 */
	public function to_client(): array {
		$out = array(
			'id'          => $this->id(),
			'type'        => $this->type(),
			'label'       => $this->label(),
			'description' => (string) $this->config['description'],
			'default'     => $this->default_value(),
			'disabled'    => $this->config['disabled'],
			'layout'      => (string) $this->config['layout'],
			'validate'    => (object) $this->rules(),
		);

		foreach ( array( 'icon', 'badge' ) as $key ) {
			if ( isset( $this->config[ $key ] ) && '' !== $this->config[ $key ] ) {
				$out[ $key ] = $this->config[ $key ];
			}
		}

		return array_merge( $out, $this->client_extra() );
	}

	/** Type-specific keys for the browser. */
	protected function client_extra(): array {
		return array();
	}

	/**
	 * @param array<string,mixed> $config Raw config.
	 * @return array<string,mixed>
	 * @throws ConfigException On invalid configuration.
	 */
	private function normalize( array $config ): array {
		$id = isset( $config['id'] ) ? (string) $config['id'] : '';
		if ( 1 !== preg_match( '/^[a-z0-9][a-z0-9_-]{0,63}$/', $id ) ) {
			throw new ConfigException( sprintf( 'Field id "%s" is invalid: use lower-case letters, digits, "_" or "-" (max 64 characters).', $id ) );
		}

		$unknown = array_diff( array_keys( $config ), $this->accepted_keys() );
		if ( array() !== $unknown ) {
			throw new ConfigException( sprintf( 'Field "%1$s" has unknown key(s): %2$s.', $id, implode( ', ', $unknown ) ) );
		}

		if ( $this->requires_label() && ( ! isset( $config['label'] ) || '' === trim( (string) $config['label'] ) ) ) {
			throw new ConfigException( sprintf( 'Field "%s" needs a label (every control has a visible or accessible name).', $id ) );
		}

		$layout = isset( $config['layout'] ) ? (string) $config['layout'] : $this->default_layout();
		if ( ! in_array( $layout, array( 'inline', 'stacked', 'field' ), true ) ) {
			throw new ConfigException( sprintf( 'Field "%s": layout must be "inline", "stacked" or "field".', $id ) );
		}

		$rules = isset( $config['validate'] ) ? (array) $config['validate'] : array();
		$bad   = array_diff( array_keys( $rules ), Rules::KNOWN );
		if ( array() !== $bad ) {
			throw new ConfigException( sprintf( 'Field "%1$s": unknown validation rule(s): %2$s.', $id, implode( ', ', $bad ) ) );
		}

		$disabled = $config['disabled'] ?? false;
		if ( ! is_bool( $disabled ) && ! is_string( $disabled ) ) {
			throw new ConfigException( sprintf( 'Field "%s": disabled must be a boolean or a string explaining why.', $id ) );
		}
		// The reason is what people read (and screen readers announce): an empty one is just `true`.
		if ( is_string( $disabled ) ) {
			$disabled = '' === trim( $disabled ) ? true : trim( $disabled );
		}

		$normalized                = $config;
		$normalized['id']          = $id;
		$normalized['type']        = (string) ( $config['type'] ?? '' );
		$normalized['label']       = isset( $config['label'] ) ? (string) $config['label'] : '';
		$normalized['description'] = isset( $config['description'] ) ? (string) $config['description'] : '';
		$normalized['layout']      = $layout;
		$normalized['validate']    = $rules;
		$normalized['disabled']    = $disabled;

		$normalized = $this->normalize_type( $normalized );

		// After the type had its say (it may derive rules), so a type's own, more specific message comes first.
		$problem = Rules::config_error( (array) $normalized['validate'] );
		if ( null !== $problem ) {
			throw new ConfigException( sprintf( 'Field "%1$s": %2$s', $id, $problem ) );
		}

		return $normalized;
	}
}
