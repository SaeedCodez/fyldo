<?php
/**
 * Field types `image` and `file`: config, sanitize, validation against the (stubbed) attachment lookup, client export.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Fields\FieldFactory;
use Fyldo\V1\Fields\FileField;
use Fyldo\V1\Fields\ImageField;
use Fyldo\V1\Instance;
use Fyldo\V1\Schema\ConfigException;
use PHPUnit\Framework\TestCase;

/** An image field whose attachments come from a table instead of WordPress. */
final class StubbedImageField extends ImageField {
	/** @var array<int,array<string,mixed>> */
	public static $attachments = array();

	protected function attachment( int $id ): ?array {
		return self::$attachments[ $id ] ?? null;
	}
}

/** A file field whose attachments come from a table instead of WordPress. */
final class StubbedFileField extends FileField {
	/** @var array<int,array<string,mixed>> */
	public static $attachments = array();

	protected function attachment( int $id ): ?array {
		return self::$attachments[ $id ] ?? null;
	}
}

final class MediaFieldsTest extends TestCase {

	protected function setUp(): void {
		StubbedImageField::$attachments = array(
			7  => array( 'id' => 7, 'filename' => 'logo-mark.png', 'filesize' => 38912, 'mime' => 'image/png', 'extension' => 'png', 'width' => 512, 'height' => 512, 'thumbnail' => 'https://example.com/logo-150x150.png', 'image' => true ),
			8  => array( 'id' => 8, 'filename' => 'photo.jpg', 'filesize' => 3145728, 'mime' => 'image/jpeg', 'extension' => 'jpg', 'width' => 4000, 'height' => 3000, 'thumbnail' => null, 'image' => true ),
			9  => array( 'id' => 9, 'filename' => 'guide.pdf', 'filesize' => 1258291, 'mime' => 'application/pdf', 'extension' => 'pdf', 'width' => null, 'height' => null, 'thumbnail' => null, 'image' => false ),
		);
		StubbedFileField::$attachments = StubbedImageField::$attachments;
	}

	private function image( array $extra = array() ): ImageField {
		return new StubbedImageField( array_merge( array( 'id' => 'site_logo', 'type' => 'image', 'label' => 'Site logo' ), $extra ) );
	}

	private function file( array $extra = array() ): FileField {
		return new StubbedFileField( array_merge( array( 'id' => 'guide', 'type' => 'file', 'label' => 'Brand guidelines' ), $extra ) );
	}

	public function test_the_factory_builds_both_types_with_the_field_layout_and_no_value(): void {
		$image = FieldFactory::create( array( 'id' => 'site_logo', 'type' => 'image', 'label' => 'Site logo' ) );
		$file  = FieldFactory::create( array( 'id' => 'guide', 'type' => 'file', 'label' => 'Brand guidelines' ) );

		$this->assertInstanceOf( ImageField::class, $image );
		$this->assertInstanceOf( FileField::class, $file );
		foreach ( array( $image, $file ) as $field ) {
			$client = $field->to_client();
			$this->assertSame( 0, $field->default_value(), 'nothing chosen is 0' );
			$this->assertSame( 'field', $client['layout'] );
			$this->assertNull( $client['types'], 'no filter: everything WordPress allows (or every image)' );
			$this->assertNull( $client['mimes'] );
			$this->assertNull( $client['max_size'] );
			$this->assertEquals( (object) array( 'media' => true ), $client['validate'] );
		}
	}

	public function test_types_are_mapped_to_mime_types_and_aliases_collapse(): void {
		$file = $this->file( array( 'types' => array( 'PDF', '.zip', 'pdf' ) ) );
		$this->assertSame( array( 'pdf', 'zip' ), $file->to_client()['types'] );
		$this->assertSame( array( 'application/pdf', 'application/zip' ), $file->to_client()['mimes'] );

		$image = $this->image( array( 'types' => array( 'jpg', 'jpeg', 'png' ) ) );
		$this->assertSame( array( 'jpg', 'jpeg', 'png' ), $image->to_client()['types'] );
		$this->assertSame( array( 'image/jpeg', 'image/png' ), $image->to_client()['mimes'], 'one MIME type for both spellings of JPEG' );
	}

	public function test_max_size_takes_bytes_or_text(): void {
		$this->assertSame( 2097152, $this->image( array( 'max_size' => '2MB' ) )->to_client()['max_size'] );
		$this->assertSame( 512000, $this->file( array( 'max_size' => '500 kb' ) )->to_client()['max_size'] );
		$this->assertSame( 1610612736, $this->file( array( 'max_size' => '1.5GB' ) )->to_client()['max_size'] );
		$this->assertSame( 4096, $this->file( array( 'max_size' => 4096 ) )->to_client()['max_size'] );
		$this->assertSame( 2048, $this->file( array( 'max_size' => '2048' ) )->to_client()['max_size'], 'plain digits are bytes' );
	}

	/**
	 * @dataProvider bad_config
	 */
	public function test_bad_config_throws( string $type, array $extra, string $message ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( $message );
		new StubbedFileField( array_merge( array( 'id' => 'x', 'type' => $type, 'label' => 'X' ), $extra ) );
	}

	public function bad_config(): array {
		return array(
			'unknown extension'    => array( 'file', array( 'types' => array( 'pdf', 'exe-ish' ) ), '"exe-ish" in `types`' ),
			'types not a list'     => array( 'file', array( 'types' => 'pdf' ), '`types` must be a non-empty list' ),
			'empty types'          => array( 'file', array( 'types' => array() ), '`types` must be a non-empty list' ),
			'a number as type'     => array( 'file', array( 'types' => array( 7 ) ), '`types`' ),
			'max_size words'       => array( 'file', array( 'max_size' => 'big' ), '`max_size` must be a number of bytes or text like "2MB"' ),
			'max_size zero'        => array( 'file', array( 'max_size' => 0 ), '`max_size`' ),
			'max_size negative'    => array( 'file', array( 'max_size' => -5 ), '`max_size`' ),
			'max_size bad unit'    => array( 'file', array( 'max_size' => '2 TB' ), '`max_size`' ),
			'default not an id'    => array( 'file', array( 'default' => 'x' ), '`default` must be an attachment ID' ),
			'default negative'     => array( 'file', array( 'default' => -1 ), '`default` must be an attachment ID' ),
		);
	}

	public function test_an_image_may_only_narrow_to_image_extensions(): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( 'may only narrow to image extensions' );
		$this->image( array( 'types' => array( 'png', 'pdf' ) ) );
	}

	/**
	 * @dataProvider sanitize_cases
	 * @param mixed $input  Raw value.
	 * @param int   $expect Attachment id.
	 */
	public function test_sanitize_follows_the_shared_fixture( $input, $expect ): void {
		$this->assertSame( $expect, $this->image()->sanitize( $input ) );
		$this->assertSame( $expect, $this->file()->sanitize( $input ) );
	}

	public function sanitize_cases(): array {
		$fixture = json_decode( (string) file_get_contents( dirname( __DIR__, 2 ) . '/fixtures/validation-cases.json' ), true );

		$out = array();
		foreach ( $fixture['media'] as $case ) {
			$out[ $case['name'] ] = array( $case['input'], $case['expect'] );
		}

		return $out;
	}

	public function test_nothing_chosen_is_valid_unless_required(): void {
		$optional = $this->image();
		$this->assertNull( $optional->validate( 0 ) );

		$required = $this->image( array( 'validate' => array( 'required' => true ) ) );
		$this->assertSame( 'This field is required.', $required->validate( $required->sanitize( 0 ) ) );
		$this->assertSame( 'This field is required.', $required->validate( $required->sanitize( '' ) ) );
		$this->assertNull( $required->validate( 7 ) );
	}

	public function test_an_attachment_that_does_not_exist_or_cannot_be_read_is_refused(): void {
		$image = $this->image();
		$this->assertSame( 'This file is no longer available. Choose another one.', $image->validate( 99 ) );
		$this->assertSame( 'This file is no longer available. Choose another one.', $this->file()->validate( 99 ) );
	}

	public function test_an_image_field_wants_an_image(): void {
		$image = $this->image();
		$this->assertNull( $image->validate( 7 ) );
		$this->assertNull( $image->validate( 8 ) );
		$this->assertSame( 'Choose an image.', $image->validate( 9 ) );
	}

	public function test_an_image_field_narrowed_by_types_refuses_other_images(): void {
		$image = $this->image( array( 'types' => array( 'png' ) ) );
		$this->assertNull( $image->validate( 7 ) );
		$this->assertSame( 'This file type is not allowed.', $image->validate( 8 ) );
		$this->assertSame( 'Choose an image.', $image->validate( 9 ), 'not an image at all: the more useful message' );
	}

	public function test_a_file_field_accepts_anything_without_types_and_only_the_listed_ones_with_them(): void {
		$this->assertNull( $this->file()->validate( 9 ) );
		$this->assertNull( $this->file()->validate( 7 ), 'an image is a file too' );

		$pdf = $this->file( array( 'types' => array( 'pdf' ) ) );
		$this->assertNull( $pdf->validate( 9 ) );
		$this->assertSame( 'This file type is not allowed.', $pdf->validate( 7 ) );
	}

	public function test_max_size_is_held_against_the_attachments_file_size(): void {
		$field = $this->image( array( 'max_size' => '2MB' ) );
		$this->assertNull( $field->validate( 7 ), '38 KB' );
		$this->assertSame( 'Choose a file of 2 MB or less.', $field->validate( 8 ), '3 MB' );

		$exact = $this->file( array( 'max_size' => 1258291 ) );
		$this->assertNull( $exact->validate( 9 ), 'the limit itself is allowed' );

		StubbedFileField::$attachments[9]['filesize'] = 0;
		$this->assertNull( $this->file( array( 'max_size' => 10 ) )->validate( 9 ), 'a size WordPress does not know cannot be held against the limit' );
	}

	public function test_the_media_rule_refuses_a_stored_value_that_is_not_an_id(): void {
		$field = $this->image();
		$this->assertSame( 'Choose a file from the media library.', $field->validate( -3 ) );
		$this->assertSame( 'Choose a file from the media library.', $field->validate( '7' ) );
	}

	public function test_media_describes_the_saved_attachment_for_the_browser(): void {
		$image = $this->image();
		$this->assertSame(
			array(
				'id'        => 7,
				'filename'  => 'logo-mark.png',
				'filesize'  => 38912,
				'mime'      => 'image/png',
				'extension' => 'png',
				'width'     => 512,
				'height'    => 512,
				'thumbnail' => 'https://example.com/logo-150x150.png',
			),
			$image->media( 7 )
		);
		$this->assertNull( $image->media( 0 ), 'nothing chosen' );
		$this->assertNull( $image->media( 99 ), 'gone' );

		$file = $this->file()->media( 7 );
		$this->assertNull( $file['thumbnail'], 'a file shows its tile, not a thumbnail' );
		$this->assertSame( 'logo-mark.png', $file['filename'] );
	}

	public function test_a_value_the_attachment_lookup_cannot_see_keeps_its_default(): void {
		$field = $this->file( array( 'default' => 9 ) );
		$this->assertSame( 9, $field->default_value() );
		$this->assertNull( $field->validate( $field->sanitize( '9' ) ) );
	}

	public function test_the_page_payload_lists_the_media_fields_only_when_the_page_has_any(): void {
		$with = new Instance( 'acme-media', array( 'title' => 'Acme' ) );
		$with->add_page( 'fields', require dirname( __DIR__, 2 ) . '/fixtures/form-fields-page.php' );
		$page  = $with->page( 'fields' );
		$media = $with->store()->client_media( $page );

		$this->assertSame( array( 'site_logo' => null, 'brand_guidelines' => null ), $media, 'nothing chosen: one entry per field, each null' );
		$client = $page->to_client( array(), 'rev-1', $media );
		$this->assertEquals( (object) array( 'site_logo' => null, 'brand_guidelines' => null ), $client['media'] );

		$without = new Instance( 'acme-plain', array( 'title' => 'Acme' ) );
		$without->add_page( 'general', require dirname( __DIR__, 2 ) . '/fixtures/slice-page.php' );
		$plain = $without->page( 'general' );
		$this->assertNull( $without->store()->client_media( $plain ) );
		$this->assertArrayNotHasKey( 'media', $plain->to_client( array(), 'rev-1', null ) );
	}
}
