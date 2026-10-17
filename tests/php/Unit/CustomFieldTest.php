<?php
/**
 * Field type `custom`: a control drawn by the developer's own JavaScript module.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Fields\FieldFactory;
use Fyldo\V1\Fields\GroupField;
use Fyldo\V1\Schema\ConfigException;
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
