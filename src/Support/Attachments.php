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
	 * The attachment as the media fields use it, or null when there is no such attachment or the current user may not read it.
	 * The name, size, type and dimensions come from the attachment itself, never from its URL.
	 *
	 * @param int $id Attachment id.
	 * @return array{id:int,filename:string,filesize:int,mime:string,extension:string,width:?int,height:?int,thumbnail:?string,image:bool}|null
	 */
	public static function find( int $id ): ?array {
		$post = get_post( $id );
		if ( ! $post instanceof \WP_Post || 'attachment' !== $post->post_type || ! current_user_can( 'read_post', $id ) ) {
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

		return array(
			'id'        => $id,
			'filename'  => $filename,
			'filesize'  => $size,
			'mime'      => (string) get_post_mime_type( $post ),
			'extension' => strtolower( pathinfo( $filename, PATHINFO_EXTENSION ) ),
			'width'     => $image && isset( $meta['width'] ) ? (int) $meta['width'] : null,
			'height'    => $image && isset( $meta['height'] ) ? (int) $meta['height'] : null,
			'thumbnail' => is_string( $thumb ) && '' !== $thumb ? $thumb : null,
			'image'     => $image,
		);
	}
}
