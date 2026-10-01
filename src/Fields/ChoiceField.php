<?php
/**
 * Exactly one of a few selectable cards (a Choice Card Group), each with an optional image and description.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;

/**
 * Renders a Choice Card Group: single choice, like a radio group, but with room for a preview image per option.
 *
 * Option keys besides `value`, `label` and `disabled`: `description` and `image` (an http(s) URL or a `/relative` path).
 */
final class ChoiceField extends AbstractOptionsField {

	/** `content` values a developer may set. */
	const CONTENT = array( 'auto', 'image', 'text' );

	/** Column counts of the Figma Choice Card Group. */
	const COLUMNS = array( 2, 3, 4 );

	public static function types(): array {
		return array( 'choice' );
	}

	protected function noun(): string {
		return 'Choice';
	}

	protected function option_keys(): array {
		return array( 'description', 'image' );
	}

	protected function default_layout(): string {
		return 'stacked';
	}

	protected function extra_keys(): array {
		return array( 'options', 'content', 'columns' );
	}

	protected function normalize_type( array $config ): array {
		$config = $this->normalize_options( $config );

		$content = $config['content'] ?? 'auto';
		if ( ! is_string( $content ) || ! in_array( $content, self::CONTENT, true ) ) {
			throw new ConfigException( sprintf( 'Choice field "%1$s": `content` must be one of %2$s.', $config['id'], implode( ', ', self::CONTENT ) ) );
		}
		$config['content'] = $content;

		$columns = $config['columns'] ?? 2;
		if ( is_string( $columns ) && 1 === preg_match( '/^\d+$/', $columns ) ) {
			$columns = (int) $columns;
		}
		if ( ! is_int( $columns ) || ! in_array( $columns, self::COLUMNS, true ) ) {
			throw new ConfigException( sprintf( 'Choice field "%1$s": `columns` must be one of %2$s.', $config['id'], implode( ', ', self::COLUMNS ) ) );
		}
		$config['columns'] = $columns;

		// Unlike a radio group, "nothing selected" is a valid starting point (the error state): `default` is optional.
		$default = isset( $config['default'] ) && is_scalar( $config['default'] ) ? (string) $config['default'] : '';
		if ( '' !== $default ) {
			$config['default'] = $default;
		} else {
			unset( $config['default'] );
		}

		if ( is_array( $config['options'] ) ) {
			$this->resolve_content( $content, (string) $config['id'] ); // Mixed images, or `image` without images: a registration error, not a surprise later.
			if ( '' !== $default && ! in_array( $default, $this->enabled_values(), true ) ) {
				throw new ConfigException( sprintf( 'Choice field "%1$s": the default "%2$s" is not one of its enabled options.', $config['id'], $default ) );
			}
		}

		return $config;
	}

	/**
	 * Every option needs a label; an `image` must be a safe URL.
	 *
	 * @param array<string,mixed> $option   Option as built.
	 * @param string              $field_id For error messages.
	 * @return array<string,mixed>
	 * @throws ConfigException On an empty label or an unusable image.
	 */
	protected function clean_option( array $option, string $field_id ): array {
		if ( '' === trim( (string) $option['label'] ) ) {
			throw new ConfigException( sprintf( 'Choice field "%1$s": option "%2$s" needs a `label` (it names the card, even when only the image is shown).', $field_id, $option['value'] ) );
		}

		if ( isset( $option['image'] ) ) {
			$url = $this->clean_url( (string) $option['image'] );
			if ( '' === $url ) {
				throw new ConfigException( sprintf( 'Choice field "%1$s": the `image` of option "%2$s" must be an http(s) URL or a path starting with "/".', $field_id, $option['value'] ) );
			}
			$option['image'] = $url;
		}

		return $option;
	}

	/** An http(s) URL or a root-relative path; anything else (other schemes, `//host`, bare names) is dropped. */
	private function clean_url( string $url ): string {
		$url = trim( $url );
		// WordPress would turn a bare "a.svg" into "http://a.svg" and let "//host" through: only these two shapes pass.
		if ( 1 !== preg_match( '#^(https?://|/(?!/))#i', $url ) ) {
			return '';
		}

		return esc_url_raw( $url, array( 'http', 'https' ) );
	}

	/**
	 * What the cards show: `image_text`, `image` or `text`.
	 *
	 * @throws ConfigException On a mix of options with and without image, or `content` image without images.
	 */
	public function content(): string {
		return $this->resolve_content( (string) $this->config['content'], $this->id() );
	}

	/**
	 * Works out what the cards show from the configured `content` and the options' images.
	 *
	 * @param string $content  The configured `content`.
	 * @param string $field_id For error messages.
	 * @throws ConfigException On a mix of options with and without image, or `content` image without images.
	 */
	private function resolve_content( string $content, string $field_id ): string {
		if ( 'text' === $content ) {
			return 'text';
		}

		$options = $this->options();
		$images  = count(
			array_filter(
				$options,
				static function ( array $option ): bool {
					return isset( $option['image'] );
				}
			)
		);

		if ( 'image' === $content ) {
			if ( count( $options ) !== $images ) {
				throw new ConfigException( sprintf( 'Choice field "%s": `content` "image" needs an `image` on every option.', $field_id ) );
			}

			return 'image';
		}

		if ( 0 === $images ) {
			return 'text';
		}
		if ( count( $options ) !== $images ) {
			throw new ConfigException( sprintf( 'Choice field "%s": give every option an `image`, or none (or set `content` to "text" to ignore the images).', $field_id ) );
		}

		return 'image_text';
	}

	/** A card group is never empty: the browser mirrors `required` too. */
	public function rules(): array {
		$rules             = parent::rules();
		$rules['required'] = true;
		$rules['allowed']  = $this->enabled_values();

		return $rules;
	}

	protected function sanitize_value( $raw ) {
		return is_scalar( $raw ) ? sanitize_text_field( (string) $raw ) : '';
	}

	protected function client_extra(): array {
		$content = $this->content();
		$options = $this->options();

		// Text-only cards never show a picture: do not make the browser know the URLs.
		if ( 'text' === $content ) {
			$options = array_map(
				static function ( array $option ): array {
					unset( $option['image'] );
					return $option;
				},
				$options
			);
		}

		return array(
			'options' => $options,
			'content' => $content,
			'columns' => (int) $this->config['columns'],
		);
	}
}
