<?php
/**
 * Shared base of the media library fields (`image`, `file`).
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Support\Attachments;

/**
 * One attachment from the WordPress media library. The value is the attachment ID (an int, 0 = nothing chosen): the name, size,
 * type and dimensions are read from the attachment, never from its URL, and clearing the field never deletes anything.
 *
 * Config: `types` (a list of file extensions such as `array( 'pdf', 'zip' )` and/or WordPress type groups from
 * `wp_get_ext_types()` such as `array( 'document', 'image' )`, which expand to their extensions; mapped to MIME types with
 * `wp_get_mime_types()`; a name that is neither is a ConfigException) and `max_size` (bytes, or text like `2MB`). The browser asks the
 * media library for those types only and checks the choice again; the server checks the stored attachment.
 */
abstract class AbstractMediaField extends AbstractField {

	/**
	 * True while a stored value is read: the value then only has to exist, whoever is reading. A logged-out visitor has no
	 * `read` capability, so checking `read_post` here would hand the front end the default instead of the saved attachment.
	 *
	 * @var bool
	 */
	private $reading = false;

	/** `image` or `file`. */
	abstract protected function kind(): string;

	protected function default_layout(): string {
		return 'field';
	}

	protected function fallback_default() {
		return 0;
	}

	protected function extra_keys(): array {
		return array( 'types', 'max_size' );
	}

	/**
	 * The attachment behind an id, or null when it does not exist. A seam to WordPress: unit tests override it.
	 *
	 * @param int $id Attachment id.
	 * @return array{id:int,filename:string,filesize:int,mime:string,extension:string,width:?int,height:?int,thumbnail:?string,image:bool,duration?:?int}|null
	 */
	protected function attachment( int $id ): ?array {
		return Attachments::find( $id );
	}

	/**
	 * Whether the current user may read the attachment. A seam to WordPress: unit tests override it.
	 *
	 * @param int $id Attachment id.
	 */
	protected function readable( int $id ): bool {
		return Attachments::readable( $id );
	}

	/**
	 * A stored value as the page reads it. The attachment must still exist and fit the field, but who reads it does not
	 * matter: the front end gets the same value as the admin.
	 *
	 * @param mixed $raw Stored value.
	 * @return mixed
	 */
	public function stored_value( $raw ) {
		$this->reading = true;
		try {
			return parent::stored_value( $raw );
		} finally {
			$this->reading = false;
		}
	}

	/** Extension (lower case) → MIME type for everything WordPress allows. */
	private static function mime_table(): array {
		$table = array();
		foreach ( wp_get_mime_types() as $extensions => $mime ) {
			foreach ( explode( '|', (string) $extensions ) as $extension ) {
				$table[ $extension ] = (string) $mime;
			}
		}

		return $table;
	}

	/**
	 * Bytes from `2MB`, `500 KB`, `1.5GB` or a plain number of bytes (1024-based, like WordPress). Null when it is not a size.
	 *
	 * @param mixed $raw Developer value.
	 */
	private static function parse_size( $raw ): ?int {
		if ( is_int( $raw ) ) {
			return $raw > 0 ? $raw : null;
		}
		if ( ! is_string( $raw ) || 1 !== preg_match( '/^\s*(\d+(?:\.\d+)?)\s*(b|kb?|mb?|gb?)?\s*$/i', $raw, $m ) ) {
			return null;
		}

		$unit  = strtolower( $m[2] ?? '' );
		$power = '' === $unit || 'b' === $unit ? 0 : 1 + (int) strpos( 'kmg', $unit[0] );
		$bytes = (int) round( (float) $m[1] * ( 1024 ** $power ) );

		return $bytes > 0 ? $bytes : null;
	}

	/**
	 * The extensions of a WordPress type group (`image`, `document`, …) that WordPress also allows to upload, or null when the
	 * name is not a group.
	 *
	 * @param string $name Lower-case name.
	 * @param array  $table Extension → MIME type.
	 * @return string[]|null
	 */
	private static function group_extensions( string $name, array $table ): ?array {
		$groups = wp_get_ext_types();
		if ( ! isset( $groups[ $name ] ) || ! is_array( $groups[ $name ] ) ) {
			return null;
		}

		return array_values( array_filter( array_map( 'strval', $groups[ $name ] ), static fn( string $extension ): bool => isset( $table[ $extension ] ) ) );
	}

	protected function normalize_type( array $config ): array {
		$id    = (string) $config['id'];
		$kind  = $this->kind();
		$label = 'image' === $kind ? 'Image' : 'File';

		$types = null;
		$mimes = null;
		if ( isset( $config['types'] ) ) {
			if ( ! is_array( $config['types'] ) || array() === $config['types'] ) {
				throw new ConfigException( sprintf( '%1$s field "%2$s": `types` must be a non-empty list of file extensions like "pdf" or type groups like "image".', $label, $id ) );
			}

			$table = self::mime_table();
			$types = array();
			$mimes = array();
			foreach ( $config['types'] as $entry ) {
				$name       = is_string( $entry ) ? strtolower( ltrim( trim( $entry ), '.' ) ) : '';
				$group      = '' === $name ? null : self::group_extensions( $name, $table );
				$extensions = null === $group ? array( $name ) : $group;
				if ( '' === $name || array() === $extensions || ( null === $group && ! isset( $table[ $name ] ) ) ) {
					throw new ConfigException( sprintf( '%1$s field "%2$s": "%3$s" in `types` is not a file extension or type group WordPress knows (see wp_get_mime_types() and wp_get_ext_types()).', $label, $id, is_scalar( $entry ) ? (string) $entry : gettype( $entry ) ) );
				}

				foreach ( $extensions as $extension ) {
					if ( 'image' === $kind && 0 !== strpos( $table[ $extension ], 'image/' ) ) {
						throw new ConfigException( sprintf( 'Image field "%1$s": `types` may only narrow to image extensions, "%2$s" is not one. Use a `file` field for it.', $id, $name ) );
					}
					$types[ $extension ] = $extension;

					$mime           = $table[ $extension ];
					$mimes[ $mime ] = $mime;
				}
			}
			$types = array_values( $types );
			$mimes = array_values( $mimes );
		}

		$max_size = null;
		if ( isset( $config['max_size'] ) ) {
			$max_size = self::parse_size( $config['max_size'] );
			if ( null === $max_size ) {
				throw new ConfigException( sprintf( '%1$s field "%2$s": `max_size` must be a number of bytes or text like "2MB".', $label, $id ) );
			}
		}

		if ( array_key_exists( 'default', $config ) && ( ! is_int( $config['default'] ) || $config['default'] < 0 ) ) {
			throw new ConfigException( sprintf( '%1$s field "%2$s": `default` must be an attachment ID (a whole number, 0 for none).', $label, $id ) );
		}

		$rules          = $config['validate'];
		$rules['media'] = true;

		$config['types']    = $types;
		$config['mimes']    = $mimes;
		$config['max_size'] = $max_size;
		$config['validate'] = $rules;

		return $config;
	}

	protected function sanitize_value( $raw ) {
		// absint, but only for something that is a number: an array or a word is "nothing chosen".
		if ( is_int( $raw ) || is_float( $raw ) || ( is_string( $raw ) && is_numeric( $raw ) ) ) {
			return abs( (int) $raw );
		}

		return 0;
	}

	/**
	 * The attachment must exist, be readable by the current user (when saving; not when a stored value is read), be an image
	 * (`image`), be one of `types`, and not exceed `max_size`.
	 *
	 * @param mixed $value Sanitized value.
	 */
	protected function implicit_check( $value ): ?array {
		$id = (int) $value;
		if ( $id <= 0 ) {
			return null;
		}

		$attachment = $this->attachment( $id );
		if ( null === $attachment || ( ! $this->reading && ! $this->readable( $id ) ) ) {
			return array(
				'rule'   => 'attachment',
				'params' => array(),
			);
		}

		if ( 'image' === $this->kind() && ! $attachment['image'] ) {
			return array(
				'rule'   => 'media_image',
				'params' => array(),
			);
		}

		if ( null !== $this->config['mimes'] && ! in_array( $attachment['mime'], $this->config['mimes'], true ) ) {
			return array(
				'rule'   => 'media_type',
				'params' => array(),
			);
		}

		$limit = $this->config['max_size'];
		// A size WordPress does not know (0) cannot be held against the limit.
		if ( null !== $limit && $attachment['filesize'] > $limit ) {
			return array(
				'rule'   => 'media_size',
				'params' => array( 'max' => (int) $limit ),
			);
		}

		return null;
	}

	/**
	 * What the browser draws for the saved value: the attachment's name, size, type and dimensions. Null when nothing is
	 * chosen, the attachment is gone or the current user may not read it.
	 *
	 * @param mixed $value Stored value.
	 * @return array{id:int,filename:string,filesize:int,mime:string,extension:string,width:?int,height:?int,thumbnail:?string,duration:?int}|null
	 */
	public function media( $value ): ?array {
		$id = (int) $value;
		if ( $id <= 0 ) {
			return null;
		}

		$attachment = $this->attachment( $id );
		if ( null === $attachment || ! $this->readable( $id ) ) {
			return null;
		}

		return array(
			'id'        => $attachment['id'],
			'filename'  => $attachment['filename'],
			'filesize'  => $attachment['filesize'],
			'mime'      => $attachment['mime'],
			'extension' => $attachment['extension'],
			'width'     => $attachment['width'],
			'height'    => $attachment['height'],
			'thumbnail' => 'image' === $this->kind() ? $attachment['thumbnail'] : null,
			'duration'  => $attachment['duration'] ?? null,
		);
	}

	protected function client_extra(): array {
		return array(
			'types'    => $this->config['types'],
			'mimes'    => $this->config['mimes'],
			'max_size' => $this->config['max_size'],
		);
	}
}
