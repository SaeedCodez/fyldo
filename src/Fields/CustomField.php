<?php
/**
 * A field the developer draws with their own JavaScript module (React or plain DOM).
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Support\Module;
use Fyldo\V1\Validation\Messages;

/**
 * Fyldo draws the row (title, description, error) and loads `module`, an ES module whose default export draws the
 * control (docs/custom-fields.md). The value is any JSON value; without a `sanitize_cb` it is cleaned like text, all the
 * way down (tags stripped, line breaks kept). `props` reach the module as they are: translated labels, option lists.
 *
 * In a form whose page draws its own fields (`useForm`, docs/custom-pages.md), `module` may be `false`: Fyldo then
 * keeps, sanitizes and validates the value and draws nothing. `validate_cb` may answer with messages by path inside the
 * value (`array( '2.link' => '…' )`), shown under `<field>.<path>`.
 *
 * `watch` names other fields of the same page whose current values the module receives (`values`), as the person edits
 * them: a live preview of the page's settings. Page checks that they exist.
 */
final class CustomField extends AbstractField {

	/** Arrays deeper than this are cut: a value is settings, not a document. */
	const MAX_DEPTH = 8;

	public static function types(): array {
		return array( 'custom' );
	}

	protected function default_layout(): string {
		return 'field';
	}

	protected function fallback_default() {
		return null;
	}

	protected function extra_keys(): array {
		return array( 'module', 'style', 'props', 'media', 'watch' );
	}

	/** URL of the stylesheet to enqueue with the screen; '' = none. */
	public function style(): string {
		return (string) $this->config['style'];
	}

	/** Whether the module opens the media library (`ui.MediaPicker`): the screen then loads `wp.media`. */
	public function media(): bool {
		return true === $this->config['media'];
	}

	/**
	 * The ids of the fields of the same page whose values the module receives as they change.
	 *
	 * @return array<int,string>
	 */
	public function watch(): array {
		return $this->config['watch'];
	}

	/** False for `'module' => false`: the page that uses `useForm` draws the field, Fyldo does not. */
	public function has_module(): bool {
		return '' !== $this->config['module'];
	}

	protected function normalize_type( array $config ): array {
		$id = (string) $config['id'];

		// `false`: drawn by the page itself (a form shown with `useForm`); Page refuses it on a settings page.
		$module = false === ( $config['module'] ?? null ) ? '' : Module::url( $config['module'] ?? '' );
		if ( '' === $module && false !== ( $config['module'] ?? null ) ) {
			throw new ConfigException( sprintf( 'Custom field "%s": `module` must be the URL of its JavaScript module (http(s), or a path starting with "/"), or false in a form whose page draws it.', $id ) );
		}

		$style = $config['style'] ?? '';
		if ( '' !== $style ) {
			$style = Module::url( $style );
			if ( '' === $style ) {
				throw new ConfigException( sprintf( 'Custom field "%s": `style` must be the URL of a stylesheet (http(s), or a path starting with "/").', $id ) );
			}
		}

		$props = $config['props'] ?? array();
		if ( ! Module::is_props( $props ) ) {
			throw new ConfigException( sprintf( 'Custom field "%s": `props` must be an array keyed by name, holding only text, numbers, booleans, null and arrays.', $id ) );
		}

		$media = $config['media'] ?? false;
		if ( ! is_bool( $media ) ) {
			throw new ConfigException( sprintf( 'Custom field "%s": `media` must be true (the module opens the media library) or false.', $id ) );
		}

		$watch = $config['watch'] ?? array();
		if ( ! is_array( $watch ) || array_values( $watch ) !== $watch || array() !== array_filter( $watch, static fn( $one ) => ! is_string( $one ) || '' === $one ) ) {
			throw new ConfigException( sprintf( 'Custom field "%s": `watch` must be a list of field ids of the same page.', $id ) );
		}

		$config['module'] = $module;
		$config['style']  = $style;
		$config['props']  = $props;
		$config['media']  = $media;
		$config['watch']  = array_values( array_unique( $watch ) );
		if ( array_key_exists( 'default', $config ) ) {
			$config['default'] = $this->sanitize_value( $config['default'] );
		}

		return $config;
	}

	protected function sanitize_value( $raw ) {
		return self::clean( $raw, 0 );
	}

	/**
	 * The declared rules, then `validate_cb`: `true`, `false`, a message, or messages by path inside the value
	 * (`array( '2.link' => '…' )` → `<field>.2.link`; the key `''` is the field itself).
	 *
	 * @param mixed $value Sanitized value.
	 * @return array<string,string>
	 */
	public function errors( $value ): array {
		$failure = $this->failure( $value );
		if ( null !== $failure ) {
			return array( $this->id() => Messages::for( $failure['rule'], $failure['params'] ) );
		}

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

	public function validate( $value ): ?string {
		$errors = $this->errors( $value );

		return array() === $errors ? null : (string) reset( $errors );
	}

	/**
	 * A stored value falls back to the default only when the value as a whole is invalid. Messages inside it (one item's
	 * link) leave it as it is: they show when the person saves, and nothing else of the record is lost.
	 *
	 * @param mixed $raw Stored value.
	 * @return mixed
	 */
	public function stored_value( $raw ) {
		$value = $this->sanitize( $raw );

		return isset( $this->errors( $value )[ $this->id() ] ) ? $this->default_value() : $value;
	}

	protected function client_extra(): array {
		return array(
			'module' => (string) $this->config['module'],
			'watch'  => $this->config['watch'],
			// An object even when empty, so the browser always gets `{}`, never `[]`.
			'props'  => (object) $this->config['props'],
		);
	}

	/**
	 * Any JSON value, with every string (and key) cleaned like a textarea's text. Anything else becomes null.
	 *
	 * @param mixed $value Raw value.
	 * @param int   $depth How deep `$value` sits.
	 * @return mixed
	 */
	private static function clean( $value, int $depth ) {
		if ( is_string( $value ) ) {
			return sanitize_textarea_field( $value );
		}
		if ( is_bool( $value ) || is_int( $value ) || null === $value ) {
			return $value;
		}
		if ( is_float( $value ) ) {
			return is_finite( $value ) ? $value : null;
		}
		if ( ! is_array( $value ) || $depth >= self::MAX_DEPTH ) {
			return null;
		}

		$out = array();
		foreach ( $value as $key => $item ) {
			$out[ is_int( $key ) ? $key : sanitize_text_field( (string) $key ) ] = self::clean( $item, $depth + 1 );
		}

		return $out;
	}
}
