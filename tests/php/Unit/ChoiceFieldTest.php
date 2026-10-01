<?php
/**
 * Field type `choice` (Choice Card Group).
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Fields\FieldFactory;
use Fyldo\V1\Schema\ConfigException;
use PHPUnit\Framework\TestCase;

final class ChoiceFieldTest extends TestCase {

	private function choice( array $extra = array() ) {
		return FieldFactory::create(
			array_merge(
				array(
					'id'      => 'theme',
					'type'    => 'choice',
					'label'   => 'Theme',
					'options' => array(
						array( 'value' => 'light', 'label' => 'Light', 'description' => 'Bright surfaces' ),
						array( 'value' => 'dark', 'label' => 'Dark', 'description' => 'Low-light ready' ),
						array( 'value' => 'system', 'label' => 'System', 'description' => 'Match device', 'disabled' => true ),
					),
				),
				$extra
			)
		);
	}

	private function with_images( array $extra = array() ) {
		return $this->choice(
			array_merge(
				array(
					'options' => array(
						array( 'value' => 'light', 'label' => 'Light', 'image' => 'https://example.com/light.svg' ),
						array( 'value' => 'dark', 'label' => 'Dark', 'image' => '/wp-content/themes/dark.svg' ),
					),
				),
				$extra
			)
		);
	}

	public function test_it_is_a_stacked_single_choice_with_required_and_allowed_rules(): void {
		$field = $this->choice();

		$this->assertSame( array( 'choice' ), $field::types() );
		$this->assertSame( 'stacked', $field->to_client()['layout'] );
		$this->assertEquals(
			array( 'required' => true, 'allowed' => array( 'light', 'dark' ) ),
			(array) $field->to_client()['validate']
		);
	}

	public function test_only_an_enabled_option_is_valid_and_nothing_selected_is_required(): void {
		$field = $this->choice();

		$this->assertNull( $field->validate( 'dark' ) );
		$this->assertSame( 'Choose one of the available options.', $field->validate( 'contrast' ) );
		$this->assertSame( 'Choose one of the available options.', $field->validate( 'system' ), 'a disabled option cannot be chosen' );
		$this->assertSame( 'This field is required.', $field->validate( '' ) );
		$this->assertSame( '', $field->sanitize( array( 'dark' ) ) );
		$this->assertSame( 'dark', $field->sanitize( ' dark ' ) );
	}

	public function test_default_is_optional_but_must_be_an_enabled_option(): void {
		$this->assertSame( '', $this->choice()->default_value() );
		$this->assertSame( '', $this->choice()->to_client()['default'] );
		$this->assertSame( 'dark', $this->choice( array( 'default' => 'dark' ) )->default_value() );

		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( 'not one of its enabled options' );
		$this->choice( array( 'default' => 'system' ) );
	}

	public function test_content_auto_is_text_without_images_and_image_text_with_images(): void {
		$text = $this->choice()->to_client();
		$this->assertSame( 'text', $text['content'] );
		$this->assertSame( 2, $text['columns'] );

		$images = $this->with_images()->to_client();
		$this->assertSame( 'image_text', $images['content'] );
	}

	public function test_content_auto_with_a_mix_of_images_throws(): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( 'give every option an `image`, or none' );
		$this->choice(
			array(
				'options' => array(
					array( 'value' => 'light', 'label' => 'Light', 'image' => 'https://example.com/light.svg' ),
					array( 'value' => 'dark', 'label' => 'Dark' ),
				),
			)
		);
	}

	public function test_content_image_needs_an_image_on_every_option(): void {
		$field = $this->with_images( array( 'content' => 'image' ) );
		$this->assertSame( 'image', $field->to_client()['content'] );

		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( 'needs an `image` on every option' );
		$this->choice( array( 'content' => 'image' ) );
	}

	public function test_content_text_ignores_images_and_does_not_send_their_urls(): void {
		$client = $this->with_images( array( 'content' => 'text' ) )->to_client();

		$this->assertSame( 'text', $client['content'] );
		foreach ( $client['options'] as $option ) {
			$this->assertArrayNotHasKey( 'image', $option );
		}
	}

	public function test_content_text_tolerates_a_mix_of_images(): void {
		$field = $this->choice(
			array(
				'content' => 'text',
				'options' => array(
					array( 'value' => 'light', 'label' => 'Light', 'image' => 'https://example.com/light.svg' ),
					array( 'value' => 'dark', 'label' => 'Dark' ),
				),
			)
		);

		$this->assertSame( 'text', $field->to_client()['content'] );
	}

	public function test_an_invalid_content_throws(): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( '`content` must be one of auto, image, text' );
		$this->choice( array( 'content' => 'both' ) );
	}

	public function test_columns_accept_two_three_or_four(): void {
		foreach ( array( 2, 3, 4 ) as $columns ) {
			$this->assertSame( $columns, $this->choice( array( 'columns' => $columns ) )->to_client()['columns'] );
		}
		$this->assertSame( 3, $this->choice( array( 'columns' => '3' ) )->to_client()['columns'] );
	}

	/**
	 * @dataProvider invalid_columns
	 *
	 * @param mixed $columns Invalid `columns` value.
	 */
	public function test_other_column_counts_throw( $columns ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( '`columns` must be one of 2, 3, 4' );
		$this->choice( array( 'columns' => $columns ) );
	}

	public function invalid_columns(): array {
		return array( 'one' => array( 1 ), 'five' => array( 5 ), 'zero' => array( 0 ), 'text' => array( 'wide' ), 'float' => array( 2.5 ), 'array' => array( array( 2 ) ) );
	}

	public function test_image_urls_are_http_https_or_root_relative(): void {
		$options = $this->with_images()->to_client()['options'];

		$this->assertSame( 'https://example.com/light.svg', $options[0]['image'] );
		$this->assertSame( '/wp-content/themes/dark.svg', $options[1]['image'] );
	}

	/**
	 * @dataProvider unsafe_images
	 */
	public function test_an_unsafe_image_url_throws( string $image ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( 'must be an http(s) URL or a path starting with "/"' );
		$this->choice( array( 'options' => array( array( 'value' => 'light', 'label' => 'Light', 'image' => $image ) ) ) );
	}

	public function unsafe_images(): array {
		return array(
			'javascript'        => array( 'javascript:alert(1)' ),
			'data'              => array( 'data:image/svg+xml;base64,PHN2Zy8+' ),
			'ftp'               => array( 'ftp://example.com/a.svg' ),
			'protocol relative' => array( '//example.com/a.svg' ),
			'bare name'         => array( 'a.svg' ),
		);
	}

	public function test_every_option_needs_a_label(): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( 'needs a `label`' );
		$this->choice( array( 'options' => array( array( 'value' => 'light', 'label' => '  ' ), array( 'value' => 'dark', 'label' => 'Dark' ) ) ) );
	}

	public function test_an_option_array_without_a_label_throws(): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( 'option arrays need `value` and `label`' );
		$this->choice( array( 'options' => array( array( 'value' => 'light', 'image' => 'https://example.com/light.svg' ) ) ) );
	}

	public function test_a_value_to_label_map_is_a_text_only_group(): void {
		$client = $this->choice( array( 'options' => array( 'monthly' => 'Monthly', 'yearly' => 'Yearly' ) ) )->to_client();

		$this->assertSame( 'text', $client['content'] );
		$this->assertSame( array( 'monthly', 'yearly' ), array_column( $client['options'], 'value' ) );
	}

	public function test_to_client_exports_content_columns_and_the_options(): void {
		$client = $this->with_images( array( 'columns' => 4, 'default' => 'dark' ) )->to_client();

		$this->assertSame( 'choice', $client['type'] );
		$this->assertSame( 4, $client['columns'] );
		$this->assertSame( 'image_text', $client['content'] );
		$this->assertSame( 'dark', $client['default'] );
		$this->assertSame(
			array(
				array( 'value' => 'light', 'label' => 'Light', 'disabled' => false, 'image' => 'https://example.com/light.svg' ),
				array( 'value' => 'dark', 'label' => 'Dark', 'disabled' => false, 'image' => '/wp-content/themes/dark.svg' ),
			),
			$client['options']
		);
	}

	public function test_options_may_come_from_a_callable_and_are_checked_when_resolved(): void {
		$field = $this->choice(
			array(
				'options' => static function () {
					return array(
						array( 'value' => 'light', 'label' => 'Light', 'image' => 'https://example.com/light.svg' ),
						array( 'value' => 'dark', 'label' => 'Dark', 'image' => 'https://example.com/dark.svg' ),
					);
				},
			)
		);

		$this->assertSame( 'image_text', $field->to_client()['content'] );
		$this->assertNull( $field->validate( 'dark' ) );

		$mixed = $this->choice(
			array(
				'options' => static function () {
					return array(
						array( 'value' => 'light', 'label' => 'Light', 'image' => 'https://example.com/light.svg' ),
						array( 'value' => 'dark', 'label' => 'Dark' ),
					);
				},
			)
		);
		$this->expectException( ConfigException::class );
		$mixed->to_client();
	}

	public function test_unknown_keys_and_missing_options_are_rejected(): void {
		try {
			$this->choice( array( 'rows' => 3 ) );
			$this->fail( 'unknown key accepted' );
		} catch ( ConfigException $e ) {
			$this->assertStringContainsString( 'unknown key(s): rows', $e->getMessage() );
		}

		$this->expectException( ConfigException::class );
		FieldFactory::create( array( 'id' => 'theme', 'type' => 'choice', 'label' => 'Theme' ) );
	}
}
