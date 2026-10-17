<?php
/**
 * What the media fields need to know about a media library attachment.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Support;

/**
 * The one place that talks to WordPress about attachments (the `image` and `file` fields call it through a protected method,
 * so the unit tests replace it).
 */
final class Attachments {

	/**
	 * The attachment as the media fields use it, or null when there is no such attachment. Who may read it is a separate
	 * question (readable()): a stored value must not change with the visitor.
	 * The name, size, type and dimensions come from the attachment itself, never from its URL.
	 *
	 * @param int $id Attachment id.
	 * @return array{id:int,filename:string,filesize:int,mime:string,extension:string,width:?int,height:?int,thumbnail:?string,image:bool,duration:?int}|null
	 */
	public static function find( int $id ): ?array {
		$post = get_post( $id );
		if ( ! $post instanceof \WP_Post || 'attachment' !== $post->post_type ) {
			return null;
		}

		$path     = get_attached_file( $id );
		$path     = is_string( $path ) ? $path : '';
		$filename = '' !== $path ? wp_basename( $path ) : wp_basename( (string) $post->guid );
		$meta     = wp_get_attachment_metadata( $id );
		$meta     = is_array( $meta ) ? $meta : array();

		// 0 = unknown (WordPress before 6.0 did not store it, and a remote attachment has no file here).
		$size = isset( $meta['filesize'] ) ? (int) $meta['filesize'] : 0;
		if ( 0 === $size && '' !== $path && is_readable( $path ) ) {
			$size = (int) filesize( $path );
		}

		$image = (bool) wp_attachment_is_image( $post );
		$thumb = $image ? wp_get_attachment_image_url( $id, 'thumbnail' ) : false;
		$mime  = (string) get_post_mime_type( $post );
		// A video's or an audio file's length in seconds, as WordPress read it on upload (null when it could not).
		$media = 0 === strpos( $mime, 'video/' ) || 0 === strpos( $mime, 'audio/' );

		return array(
			'id'        => $id,
			'filename'  => $filename,
			'filesize'  => $size,
			'mime'      => $mime,
			'extension' => strtolower( pathinfo( $filename, PATHINFO_EXTENSION ) ),
			'width'     => $image && isset( $meta['width'] ) ? (int) $meta['width'] : null,
			'height'    => $image && isset( $meta['height'] ) ? (int) $meta['height'] : null,
			'thumbnail' => is_string( $thumb ) && '' !== $thumb ? $thumb : null,
			'image'     => $image,
			'duration'  => $media && isset( $meta['length'] ) && is_numeric( $meta['length'] ) ? (int) $meta['length'] : null,
		);
	}

	/**
	 * Whether the current user may read the attachment (checked when a value is saved or shown in the browser).
	 *
	 * @param int $id Attachment id.
	 */
	public static function readable( int $id ): bool {
		return current_user_can( 'read_post', $id );
	}
}
