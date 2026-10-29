<?php
/**
 * Base class of every field type.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Schema\Dependency;
use Fyldo\V1\Support\Version;
use Fyldo\V1\Validation\Messages;
use Fyldo\V1\Validation\Rules;

/**
 * One field of one section: definition + server-side sanitize/validate + client export.
 *
 * @internal
 */
abstract class AbstractField {

	/** Keys every field accepts. */
	const COMMON_KEYS = array(
		'id',
		'type',
		'label',
		'description',
		'default',
		'default_before',
		'disabled',
		'layout',
		'icon',
		'badge',
		'dependency',
		'validate',
		'validate_cb',
		'sanitize_cb',
	);

	/** @var array<string,mixed> */
	protected $config;

	/** @var int Depth of trusted() calls: above 0, the checks that depend on the current user are off. */
	private static $trusted = 0;

	/**
	 * Runs `$run` with the checks that depend on the current user off: a post, term or user item, or an attachment, then
	 * only has to exist and fit the field, as when a stored value is read. For saves made by the plugin's own code
	 * (Instance::update()), which may run with no user at all (cron, WP-CLI); a REST save never runs inside it.
	 *
	 * @internal
	 * @param callable $run Called with no arguments.
	 * @return mixed What `$run` returns.
	 */
	public static function trusted( callable $run ) {
		++self::$trusted;
		try {
			return $run();
		} finally {
			--self::$trusted;
		}
	}

	/** False inside trusted(): whether the current user may read an item does not matter there. */
	protected static function checks_user(): bool {
		return 0 === self::$trusted;
	}

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
	 * Earlier defaults, keyed by the plugin version that replaced them, oldest first (`'2.0.0' => 10`: "before 2.0.0
	 * the default was 10"). Server-only: the browser never needs them.
	 *
	 * @return array<int|string,mixed> Keys are versions (PHP turns a key such as "2" into an int).
	 */
	public function default_before(): array {
		return $this->config['default_before'];
	}

	/**
	 * The default this field had in a given plugin version: the first `default_before` entry for a later version, else
	 * today's default.
	 *
	 * @param string $version A plugin version.
	 * @return mixed
	 */
	public function default_at( string $version ) {
		foreach ( $this->config['default_before'] as $before => $value ) {
			if ( version_compare( $version, (string) $before, '<' ) ) {
				return $value;
			}
		}

		return $this->default_value();
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
	 * Sanitize an untrusted value: the type's own sanitizer first, then the developer's `sanitize_cb` on its result.
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
	 * Every message of a sanitized value, keyed by where it is shown: the field id for a single field. A group adds its
	 * sub-fields' messages under `<group>.<index>.<sub-field>`.
	 *
	 * @param mixed $value Sanitized value.
	 * @return array<string,string>
	 */
	public function errors( $value ): array {
		$message = $this->validate( $value );

		return null === $message ? array() : array( $this->id() => $message );
	}

	/**
	 * errors() of a field on a page whose other fields are known: `$outside( $id )` says whether a field of the page
	 * shows and what it holds (Schema\Visibility::resolve()). A group skips its hidden sub-fields.
	 *
	 * @param mixed    $value   Sanitized value.
	 * @param callable $outside `fn( string $id ): array{visible:bool,value:mixed}`.
	 * @return array<string,string>
	 */
	public function page_errors( $value, callable $outside ): array { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- used by the group.
		return $this->errors( $value );
	}

	/**
	 * When the field shows (Schema\Dependency), or null: always.
	 *
	 * @return array{relation:string,conditions:array<int,array{field:string,operator:string,value:mixed}>}|null
	 */
	public function dependency(): ?array {
		return $this->config['dependency'] ?? null;
	}

	/**
	 * The messages of `validate_cb`: `true`, `false`, a message, or messages by path inside the value
	 * (`array( '2.link' => '…' )` → `<field>.2.link`; the key `''` is the field itself). For the fields whose values have
	 * parts (custom, code).
	 *
	 * @param mixed $value Sanitized value.
	 * @return array<string,string>
	 */
	protected function callback_errors( $value ): array {
		$result = isset( $this->config['validate_cb'] ) && is_callable( $this->config['validate_cb'] ) ? call_user_func( $this->config['validate_cb'], $value ) : true;
		if ( is_array( $result ) ) {
			$errors = array();
			foreach ( $result as $path => $message ) {
				if ( is_string( $message ) && '' !== $message ) {
					$errors[ '' === (string) $path ? $this->id() : $this->id() . '.' . $path ] = $message;
				}
			}
			return $errors;
		}
		if ( is_string( $result ) && '' !== $result ) {
			return array( $this->id() => $result );
		}

		return false === $result ? array( $this->id() => Messages::for( 'invalid' ) ) : array();
	}

	/**
	 * The first message of errors(), or null: validate() for the fields whose errors() is the source.
	 *
	 * @param mixed $value Sanitized value.
	 */
	protected function first_error( $value ): ?string {
		$errors = $this->errors( $value );

		return array() === $errors ? null : (string) reset( $errors );
	}

	/**
	 * stored_value() for the fields with messages inside their value: only a message about the whole value resets it.
	 *
	 * @param mixed $raw Stored value.
	 * @return mixed
	 */
	protected function stored_unless_whole_error( $raw ) {
		$value = $this->sanitize( $raw );

		return isset( $this->errors( $value )[ $this->id() ] ) ? $this->default_value() : $value;
	}

	/**
	 * A stored value as the page reads it: sanitized, and the default when it no longer validates (e.g. a removed select option).
	 *
	 * @param mixed $raw Stored value.
	 * @return mixed
	 */
	public function stored_value( $raw ) {
		$value = $this->sanitize( $raw );

		return null === $this->validate( $value ) ? $value : $this->default_value();
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

		return $this->with_dependency( array_merge( $out, $this->client_extra() ) );
	}

	/**
	 * `$out` with the field's dependency, when it has one.
	 *
	 * @param array<string,mixed> $out Client description.
	 * @return array<string,mixed>
	 */
	protected function with_dependency( array $out ): array {
		if ( null !== $this->dependency() ) {
			$out['dependency'] = $this->dependency();
		}

		return $out;
	}

	/**
	 * Bounds and counts (`min`, `max`, `step`) are keys of the field; `validate` accepts them too for the types that have
	 * them (number and the lists). Either way they become the declarative rules, which the server checks and the browser
	 * gets. Both places at once is a mistake: which one wins?
	 *
	 * @param array<string,mixed> $config Config after common normalisation.
	 * @param string[]            $keys   The bounds this type has.
	 * @return array<string,mixed> The config with the field's own bounds moved into `validate`.
	 * @throws ConfigException When a bound is given on the field and in `validate`.
	 */
	protected function bounds_into_rules( array $config, array $keys ): array {
		$rules = (array) $config['validate'];
		foreach ( $keys as $key ) {
			if ( ! array_key_exists( $key, $config ) ) {
				continue;
			}
			if ( isset( $rules[ $key ] ) && null !== $config[ $key ] ) {
				throw new ConfigException( sprintf( 'Field "%1$s": `%2$s` is set on the field and in `validate`; use one (the field).', $config['id'], $key ) );
			}
			if ( null !== $config[ $key ] ) {
				$rules[ $key ] = $config[ $key ];
			}
			unset( $config[ $key ] );
		}
		$config['validate'] = $rules;

		return $config;
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

		$badge = $config['badge'] ?? '';
		if ( ! is_string( $badge ) && ! is_int( $badge ) ) {
			throw new ConfigException( sprintf( 'Field "%s": badge must be a short string or a number.', $id ) );
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

		$history = $config['default_before'] ?? array();
		if ( ! is_array( $history ) ) {
			throw new ConfigException( sprintf( 'Field "%s": `default_before` must be an array of version => earlier default.', $id ) );
		}
		foreach ( array_keys( $history ) as $before ) {
			if ( ! Version::is_valid( (string) $before ) ) {
				throw new ConfigException( sprintf( 'Field "%1$s": `default_before` keys must be version numbers such as "2.0.0" (got "%2$s").', $id, $before ) );
			}
		}
		// Oldest first: default_at() takes the first version the site had not reached yet.
		uksort(
			$history,
			static function ( $a, $b ): int {
				return version_compare( (string) $a, (string) $b );
			}
		);

		$normalized                   = $config;
		$normalized['id']             = $id;
		$normalized['default_before'] = $history;
		$normalized['type']           = (string) ( $config['type'] ?? '' );
		$normalized['label']          = isset( $config['label'] ) ? (string) $config['label'] : '';
		$normalized['description']    = isset( $config['description'] ) ? (string) $config['description'] : '';
		$normalized['layout']         = $layout;
		$normalized['badge']          = (string) $badge;
		$normalized['validate']       = $rules;
		$normalized['disabled']       = $disabled;
		$normalized['dependency']     = isset( $config['dependency'] ) ? Dependency::normalize( $config['dependency'], $id ) : null;

		$normalized = $this->normalize_type( $normalized );

		// After the type had its say (it may derive rules), so a type's own, more specific message comes first.
		$problem = Rules::config_error( (array) $normalized['validate'] );
		if ( null !== $problem ) {
			throw new ConfigException( sprintf( 'Field "%1$s": %2$s', $id, $problem ) );
		}

		return $normalized;
	}
}
