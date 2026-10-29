<?php
/**
 * Code: custom CSS, JSON or HTML, in the Code Editor.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Validation\Messages;
use Fyldo\V1\Validation\Rules;

/**
 * Renders a Code Editor (Figma "Code Editor"): a language label and a copy button, line numbers, the code in Geist Mono,
 * left to right in every language. The value is the code as typed: Fyldo never strips tags from it, so escape it where
 * you print it. HTML from someone who may not post unfiltered HTML is passed through `wp_kses_post`.
 *
 * The implied `code` rule checks JSON (it must parse) and CSS (no markup, as WordPress checks its Additional CSS); a CSS
 * message names its line. `validate_cb` may answer with messages by line (`array( 3 => '…' )` → `<field>.3`).
 *
 * @internal
 */
final class CodeField extends AbstractField {

	/** The languages: a label in the toolbar, colours for the syntax. `text` has neither. */
	const LANGUAGES = array( 'css', 'html', 'json', 'text' );

	/** Lines the editor shows before it scrolls: Figma's control. */
	const DEFAULT_ROWS = 7;

	public static function types(): array {
		return array( 'code' );
	}

	protected function default_layout(): string {
		return 'stacked';
	}

	protected function extra_keys(): array {
		return array( 'language', 'rows', 'toolbar', 'line_numbers' );
	}

	protected function normalize_type( array $config ): array {
		$id = (string) $config['id'];

		$language = $config['language'] ?? 'text';
		if ( ! in_array( $language, self::LANGUAGES, true ) ) {
			throw new ConfigException( sprintf( 'Code field "%1$s": `language` must be one of %2$s.', $id, implode( ', ', self::LANGUAGES ) ) );
		}

		$rows = $config['rows'] ?? self::DEFAULT_ROWS;
		if ( ! is_int( $rows ) || $rows < 3 || $rows > 40 ) {
			throw new ConfigException( sprintf( 'Code field "%s": `rows` must be a whole number between 3 and 40.', $id ) );
		}

		foreach ( array( 'toolbar', 'line_numbers' ) as $key ) {
			if ( isset( $config[ $key ] ) && ! is_bool( $config[ $key ] ) ) {
				throw new ConfigException( sprintf( 'Code field "%1$s": `%2$s` must be true or false.', $id, $key ) );
			}
		}

		if ( in_array( $language, Rules::CODE_CHECKS, true ) ) {
			$config['validate']['code'] = array( 'language' => $language );
		}

		$config['language']     = $language;
		$config['rows']         = $rows;
		$config['toolbar']      = $config['toolbar'] ?? true;
		$config['line_numbers'] = $config['line_numbers'] ?? true;
		$config['default']      = isset( $config['default'] ) ? $this->sanitize_value( $config['default'] ) : '';

		return $config;
	}

	/**
	 * The code as typed: valid UTF-8, `\n` line ends, no NUL bytes. HTML is filtered for someone without `unfiltered_html`.
	 *
	 * @param mixed $raw Raw value.
	 * @return string
	 */
	protected function sanitize_value( $raw ) {
		if ( ! is_scalar( $raw ) ) {
			return '';
		}
		$code = str_replace( array( "\r\n", "\r", "\0" ), array( "\n", "\n", '' ), wp_check_invalid_utf8( (string) $raw ) );
		if ( 'html' === ( $this->config['language'] ?? '' ) && function_exists( 'current_user_can' ) && ! current_user_can( 'unfiltered_html' ) ) {
			$code = wp_kses_post( $code );
		}

		return $code;
	}

	/**
	 * The declared rules (a CSS message keyed by its line, `<field>.<line>`), then `validate_cb`.
	 *
	 * @param mixed $value Sanitized value.
	 * @return array<string,string>
	 */
	public function errors( $value ): array {
		$failure = $this->failure( $value );
		if ( null !== $failure ) {
			$line = $failure['params']['line'] ?? null;
			return array( ( null === $line ? $this->id() : $this->id() . '.' . $line ) => Messages::for( $failure['rule'], $failure['params'] ) );
		}

		return $this->callback_errors( $value );
	}

	public function validate( $value ): ?string {
		return $this->first_error( $value );
	}

	/**
	 * A stored value keeps a message at a line (it shows when the person saves); a message about the whole value resets it.
	 *
	 * @param mixed $raw Stored value.
	 * @return mixed
	 */
	public function stored_value( $raw ) {
		return $this->stored_unless_whole_error( $raw );
	}

	protected function client_extra(): array {
		return array(
			'language'     => (string) $this->config['language'],
			'rows'         => (int) $this->config['rows'],
			'toolbar'      => (bool) $this->config['toolbar'],
			'line_numbers' => (bool) $this->config['line_numbers'],
		);
	}
}
