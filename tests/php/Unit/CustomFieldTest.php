<?php
/**
 * Field type `custom`: a control drawn by the developer's own JavaScript module.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Fields\CustomField;
use Fyldo\V1\Fields\FieldFactory;
use Fyldo\V1\Fields\GroupField;
use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Schema\Form;
use Fyldo\V1\Schema\Page;
use PHPUnit\Framework\TestCase;

final class CustomFieldTest extends TestCase {

	private function custom( array $extra = array() ) {
		return FieldFactory::create(
			array_merge(
				array(
					'id'     => 'hours',
					'type'   => 'custom',
					'label'  => 'Working hours',
					'module' => 'https://example.com/wp-content/plugins/acme/hours.js',
				),
				$extra
			)
		);
	}

	public function test_the_browser_gets_the_module_and_the_props_as_an_object(): void {
		$client = $this->custom( array( 'props' => array( 'opens' => 'Opens', 'times' => array( '09:00', '17:00' ) ) ) )->to_client();

		$this->assertSame( 'custom', $client['type'] );
		$this->assertSame( 'field', $client['layout'] );
		$this->assertSame( 'https://example.com/wp-content/plugins/acme/hours.js', $client['module'] );
		$this->assertSame( '{"opens":"Opens","times":["09:00","17:00"]}', wp_json_encode( $client['props'] ) );
		$this->assertSame( '{}', wp_json_encode( $this->custom()->to_client()['props'] ), 'no props: an object, never []' );
		$this->assertArrayNotHasKey( 'style', $client, 'the stylesheet is enqueued by PHP, not loaded by the app' );
		$this->assertNull( $this->custom()->default_value(), 'nothing set' );
	}

	public function test_a_root_relative_module_and_a_stylesheet_are_accepted(): void {
		$field = $this->custom(
			array(
				'module' => '/wp-content/plugins/acme/hours.js',
				'style'  => 'https://example.com/hours.css',
			)
		);

		$this->assertSame( '/wp-content/plugins/acme/hours.js', $field->to_client()['module'] );
		$this->assertSame( 'https://example.com/hours.css', $field->style() );
		$this->assertSame( '', $this->custom()->style() );
	}

	public function test_any_json_value_is_kept_with_its_text_cleaned_all_the_way_down(): void {
		$field = $this->custom();

		$this->assertSame( '09:00-17:00', $field->sanitize( '09:00-17:00' ) );
		$this->assertSame( "line one\nline two", $field->sanitize( "<b>line one</b>\nline two" ), 'tags go, line breaks stay' );
		$this->assertSame( 42, $field->sanitize( 42 ) );
		$this->assertSame( 1.5, $field->sanitize( 1.5 ) );
		$this->assertTrue( $field->sanitize( true ) );
		$this->assertNull( $field->sanitize( null ) );
		$this->assertSame(
			array(
				'from'  => '09:00',
				'days'  => array( 'mon', 'tue' ),
				'extra' => array( 'note' => 'hi' ),
			),
			$field->sanitize(
				array(
					'from'      => '<b>09:00</b>',
					'days'      => array( 'mon', 'tue' ),
					'<i>extra'  => array( 'note' => '<em>hi</em>' ),
				)
			)
		);
		$this->assertNull( $field->sanitize( new \stdClass() ), 'not JSON data' );
		$this->assertNull( $field->sanitize( INF ) );
	}

	public function test_values_nested_too_deep_are_cut(): void {
		$deep = 'leaf';
		for ( $i = 0; $i < 10; $i++ ) {
			$deep = array( $deep );
		}

		$clean = $this->custom()->sanitize( $deep );
		for ( $i = 0; $i < 8; $i++ ) {
			$clean = $clean[0];
		}
		$this->assertNull( $clean );
	}

	public function test_prototype_keys_are_dropped_at_every_depth(): void {
		$value = array(
			'__proto__'   => array( 'admin' => true ),
			'constructor' => array( 'prototype' => array( 'admin' => true ) ),
			'days'        => array(
				array(
					'open'      => '09:00',
					'__proto__' => 'x',
					'nested'    => array( 'prototype' => 1, ' constructor ' => 2, 'ok' => 3 ),
				),
			),
		);

		$this->assertSame(
			array( 'days' => array( array( 'open' => '09:00', 'nested' => array( 'ok' => 3 ) ) ) ),
			$this->custom()->sanitize( $value )
		);
	}

	public function test_the_default_is_cleaned_like_a_value(): void {
		$this->assertSame( array( 'from' => '09:00' ), $this->custom( array( 'default' => array( 'from' => '<b>09:00</b>' ) ) )->default_value() );
	}

	public function test_sanitize_cb_and_validate_cb_run_after_the_default_cleaning(): void {
		$field = $this->custom(
			array(
				'sanitize_cb' => static function ( $value ) {
					return is_string( $value ) ? strtoupper( $value ) : $value;
				},
				'validate_cb' => static function ( $value ) {
					return 'OK' === $value ? true : 'Say ok.';
				},
				'validate'    => array( 'required' => true ),
			)
		);

		$this->assertSame( 'OK', $field->sanitize( '<b>ok</b>' ) );
		$this->assertNull( $field->validate( 'OK' ) );
		$this->assertSame( 'Say ok.', $field->validate( 'NO' ) );
		$this->assertSame( 'This field is required.', $field->validate( '' ) );
	}

	public function test_a_group_can_hold_a_custom_field(): void {
		$group = FieldFactory::create(
			array(
				'id'      => 'days',
				'type'    => 'group',
				'label'   => 'Days',
				'addable' => true,
				'fields'  => array(
					array(
						'id'          => 'hours',
						'type'        => 'custom',
						'label'       => 'Hours',
						'module'      => '/hours.js',
						'default'     => '09:00-17:00',
						'validate_cb' => static function ( $value ) {
							return '09:00-17:00' === $value ? true : 'Only 9 to 5.';
						},
					),
				),
			)
		);

		$this->assertInstanceOf( GroupField::class, $group );
		$this->assertSame( 'custom', $group->to_client()['fields'][0]['type'] );
		$this->assertSame( array( 'days.0.hours' => 'Only 9 to 5.' ), $group->errors( array( array( 'hours' => '10:00-11:00' ) ) ) );
	}

	public function test_validate_cb_may_answer_with_messages_by_path_inside_the_value(): void {
		$field = $this->custom(
			array(
				'id'          => 'slides',
				'default'     => array(),
				'validate_cb' => static function ( $slides ) {
					$errors = array();
					foreach ( (array) $slides as $i => $slide ) {
						if ( 0 !== strpos( (string) ( $slide['link'] ?? '' ), 'https://' ) ) {
							$errors[ $i . '.link' ] = 'Enter a full URL.';
						}
					}
					if ( count( (array) $slides ) > 3 ) {
						$errors[''] = 'Three slides at most.';
					}
					return $errors;
				},
			)
		);
		$two = array( array( 'link' => 'https://example.com' ), array( 'link' => 'example.com' ) );

		$this->assertSame( array( 'slides.1.link' => 'Enter a full URL.' ), $field->errors( $two ) );
		$this->assertSame( 'Enter a full URL.', $field->validate( $two ), 'validate(): the first message' );
		$this->assertSame( array(), $field->errors( array( array( 'link' => 'https://example.com' ) ) ) );
		$this->assertSame( array( 'slides' => 'Three slides at most.' ), $field->errors( array_fill( 0, 4, array( 'link' => 'https://a.b' ) ) ) );

		// A stored value keeps its items when a message is inside it; only a message about the whole value resets it.
		$this->assertSame( $two, $field->stored_value( $two ) );
		$this->assertSame( array(), $field->stored_value( array_fill( 0, 4, array( 'link' => 'https://a.b' ) ) ) );
	}

	public function test_the_declared_rules_still_come_first_and_a_plain_answer_keys_the_field(): void {
		$field = $this->custom(
			array(
				'validate'    => array( 'required' => true ),
				'validate_cb' => static function ( $value ) {
					return 'nine-to-five' === $value ? true : 'Only 9 to 5.';
				},
			)
		);
		$this->assertSame( array( 'hours' ), array_keys( $field->errors( '' ) ), 'required' );
		$this->assertSame( array( 'hours' => 'Only 9 to 5.' ), $field->errors( '10-11' ) );
		$this->assertSame( array(), $field->errors( 'nine-to-five' ) );
	}

	public function test_module_false_is_for_a_form_whose_page_draws_the_field(): void {
		$field = $this->custom( array( 'module' => false ) );
		$this->assertFalse( $field->has_module() );
		$this->assertSame( '', $field->to_client()['module'] );
		$this->assertTrue( $this->custom()->has_module() );

		$form = new Form(
			'acme-shop',
			'story',
			array(
				'sections' => array( array( 'id' => 'content', 'title' => 'Slides', 'fields' => array( array( 'id' => 'slides', 'type' => 'custom', 'label' => 'Slides', 'module' => false ) ) ) ),
				'load'     => static function () {
					return null;
				},
				'save'     => static function () {
					return 'k';
				},
			)
		);
		$this->assertArrayHasKey( 'slides', $form->schema()->fields() );
	}

	/** A settings page holding `$fields` in one section. */
	private static function page( array $fields ): Page {
		return new Page( 'acme-shop', 'appearance', array( 'title' => 'Appearance', 'sections' => array( array( 'id' => 's', 'title' => 'S', 'fields' => $fields ) ) ) );
	}

	public function test_watch_names_fields_of_the_same_page_and_reaches_the_browser(): void {
		$page = self::page(
			array(
				array( 'id' => 'brand', 'type' => 'color', 'label' => 'Brand colour' ),
				array( 'id' => 'theme', 'type' => 'select', 'label' => 'Theme', 'options' => array( 'light' => 'Light', 'dark' => 'Dark' ) ),
				array( 'id' => 'preview', 'type' => 'custom', 'label' => 'Preview', 'module' => '/preview.js', 'watch' => array( 'brand', 'theme', 'brand' ) ),
				array(
					'id'      => 'rows',
					'type'    => 'group',
					'label'   => 'Rows',
					'addable' => true,
					'fields'  => array(
						array( 'id' => 'size', 'type' => 'number', 'label' => 'Size' ),
						array( 'id' => 'sample', 'type' => 'custom', 'label' => 'Sample', 'module' => '/sample.js', 'watch' => array( 'size' ) ),
					),
				),
			)
		);

		$preview = $page->field( 'preview' );
		$this->assertInstanceOf( CustomField::class, $preview );
		$this->assertSame( array( 'brand', 'theme' ), $preview->watch(), 'each id once, in order' );
		$this->assertSame( array( 'brand', 'theme' ), $preview->to_client()['watch'] );
		$this->assertSame( array(), $this->custom()->to_client()['watch'], 'nothing watched: an empty list' );
	}

	public function test_a_group_sub_field_watches_the_other_sub_fields_of_its_item(): void {
		$page = self::page(
			array(
				array(
					'id'      => 'sections',
					'type'    => 'group',
					'label'   => 'Sections',
					'addable' => true,
					'fields'  => array(
						array( 'id' => 'stories', 'type' => 'text', 'label' => 'Stories' ),
						array( 'id' => 'size', 'type' => 'select', 'label' => 'Size', 'options' => array( 's' => 'S', 'l' => 'L' ) ),
						array( 'id' => 'show_titles', 'type' => 'toggle', 'label' => 'Show titles' ),
						array( 'id' => 'preview', 'type' => 'custom', 'label' => 'Preview', 'module' => '/preview.js', 'watch' => array( 'stories', 'size', 'show_titles' ) ),
					),
				),
			)
		);

		$group = $page->field( 'sections' );
		$this->assertInstanceOf( GroupField::class, $group );
		$this->assertSame( array( 'stories', 'size', 'show_titles' ), $group->sub_fields()['preview']->watch() );
		$client = $group->to_client()['fields'];
		$this->assertSame( array( 'stories', 'size', 'show_titles' ), $client[3]['watch'], 'the browser gets the sibling ids' );
	}

	/**
	 * @dataProvider invalid_group_watches
	 *
	 * @param array<int,array<string,mixed>> $fields  The page's fields.
	 * @param string                         $message Expected part of the message.
	 */
	public function test_group_watch_errors( array $fields, string $message ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( $message );
		self::page( $fields );
	}

	public function invalid_group_watches(): array {
		$group = static fn( $watch ): array => array(
			'id'      => 'rows',
			'type'    => 'group',
			'label'   => 'Rows',
			'addable' => true,
			'fields'  => array(
				array( 'id' => 'label', 'type' => 'text', 'label' => 'Label' ),
				array( 'id' => 'sample', 'type' => 'custom', 'label' => 'Sample', 'module' => '/sample.js', 'watch' => $watch ),
			),
		);
		$brand = array( 'id' => 'brand', 'type' => 'color', 'label' => 'Brand colour' );
		return array(
			'unknown sibling' => array( array( $group( array( 'logo' ) ) ), 'Custom field "sample" watches "logo", which is not a sub-field of group "rows"' ),
			'a page field'    => array( array( $brand, $group( array( 'brand' ) ) ), 'Custom field "sample" watches "brand", which is not a sub-field of group "rows"' ),
			'itself'          => array( array( $group( array( 'sample' ) ) ), 'Custom field "sample" cannot watch itself' ),
		);
	}

	/**
	 * @dataProvider invalid_watches
	 *
	 * @param array<int,array<string,mixed>> $fields  The page's fields.
	 * @param string                         $message Expected part of the message.
	 */
	public function test_watch_errors( array $fields, string $message ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( $message );
		self::page( $fields );
	}

	public function invalid_watches(): array {
		$preview = static fn( $watch ): array => array( 'id' => 'preview', 'type' => 'custom', 'label' => 'Preview', 'module' => '/preview.js', 'watch' => $watch );
		$brand   = array( 'id' => 'brand', 'type' => 'color', 'label' => 'Brand colour' );
		return array(
			'not a list'         => array( array( $brand, $preview( 'brand' ) ), '`watch` must be a list of field ids of the same page' ),
			'keyed'              => array( array( $brand, $preview( array( 'a' => 'brand' ) ) ), '`watch` must be a list of field ids' ),
			'not text'           => array( array( $brand, $preview( array( 1 ) ) ), '`watch` must be a list of field ids' ),
			'unknown field'      => array( array( $brand, $preview( array( 'logo' ) ) ), 'Custom field "preview" watches "logo", which is not a field of page "appearance"' ),
			'itself'             => array( array( $preview( array( 'preview' ) ) ), 'Custom field "preview" cannot watch itself' ),
			'a password'         => array( array( array( 'id' => 'key', 'type' => 'password', 'label' => 'Key' ), $preview( array( 'key' ) ) ), 'cannot watch password field "key"' ),
			'a group sub-field'  => array(
				array(
					array( 'id' => 'rows', 'type' => 'group', 'label' => 'Rows', 'addable' => true, 'fields' => array( array( 'id' => 'label', 'type' => 'text', 'label' => 'Label' ) ) ),
					$preview( array( 'label' ) ),
				),
				'watches "label", which is not a field of page',
			),
		);
	}

	/**
	 * @dataProvider settings_pages_with_a_module_less_field
	 *
	 * @param array<string,mixed> $field Field config.
	 */
	public function test_a_settings_page_refuses_module_false( array $field ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( 'Custom field "slides": `module` false is only for a form whose page draws its fields (useForm)' );

		new Page( 'acme-shop', 'general', array( 'title' => 'General', 'sections' => array( array( 'id' => 's', 'title' => 'S', 'fields' => array( $field ) ) ) ) );
	}

	public function settings_pages_with_a_module_less_field(): array {
		$slides = array( 'id' => 'slides', 'type' => 'custom', 'label' => 'Slides', 'module' => false );
		return array(
			'on its own'     => array( $slides ),
			'inside a group' => array( array( 'id' => 'days', 'type' => 'group', 'label' => 'Days', 'addable' => true, 'fields' => array( $slides ) ) ),
		);
	}

	/**
	 * @dataProvider invalid_configs
	 *
	 * @param array<string,mixed> $config  Field config.
	 * @param string              $message Expected fragment of the exception message.
	 */
	public function test_bad_config_fails_loudly( array $config, string $message ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( $message );
		$this->custom( $config );
	}

	public function invalid_configs(): array {
		return array(
			'no module'               => array( array( 'module' => '' ), '`module` must be the URL of its JavaScript module' ),
			'module not a URL'        => array( array( 'module' => 'hours.js' ), '`module` must be the URL' ),
			'module javascript:'      => array( array( 'module' => 'javascript:alert(1)' ), '`module` must be the URL' ),
			'module protocol-relative' => array( array( 'module' => '//cdn.example.com/x.js' ), '`module` must be the URL' ),
			'module not text'         => array( array( 'module' => array( '/x.js' ) ), '`module` must be the URL' ),
			'style not a URL'         => array( array( 'style' => 'hours.css' ), '`style` must be the URL of a stylesheet' ),
			'props a list'            => array( array( 'props' => array( 'a', 'b' ) ), '`props` must be an array keyed by name' ),
			'props not an array'      => array( array( 'props' => 'x' ), '`props` must be an array keyed by name' ),
			'props with a callback'   => array( array( 'props' => array( 'cb' => static function () {} ) ), '`props` must be an array keyed by name' ),
			'unknown key'             => array( array( 'component' => 'x' ), 'unknown key(s): component' ),
			'media not a boolean'     => array( array( 'media' => 'yes' ), '`media` must be true (the module opens the media library) or false' ),
		);
	}
}
