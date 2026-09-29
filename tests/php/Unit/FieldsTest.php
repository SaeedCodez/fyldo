<?php
/**
 * Field types: normalisation, sanitize, validate, client export.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Fields\FieldFactory;
use Fyldo\V1\Fields\SelectField;
use Fyldo\V1\Schema\ConfigException;
use PHPUnit\Framework\TestCase;

final class FieldsTest extends TestCase {

	private function text( array $extra = array() ) {
		return FieldFactory::create( array_merge( array( 'id' => 'site_title', 'type' => 'text', 'label' => 'Site title' ), $extra ) );
	}

	public function test_text_sanitizes_and_validates_declaratively(): void {
		$field = $this->text( array( 'validate' => array( 'required' => true, 'max_length' => 5 ) ) );

		$this->assertSame( 'Hello', $field->sanitize( '  <b>Hello</b>  ' ) );
		$this->assertSame( '', $field->sanitize( array( 'x' ) ), 'Non-scalars become an empty string.' );
		$this->assertNull( $field->validate( 'Hello' ) );
		$this->assertSame( 'This field is required.', $field->validate( '' ) );
		$this->assertSame( 'Use no more than 5 characters.', $field->validate( 'Hello!' ) );
	}

	public function test_url_type_implies_a_scheme_rule_and_surfaces_bad_schemes_as_errors(): void {
		$field = FieldFactory::create( array( 'id' => 'canonical', 'type' => 'url', 'label' => 'URL' ) );

		$this->assertEquals( array( 'schemes' => array( 'http', 'https' ) ), (array) $field->to_client()['validate'] );
		$this->assertSame( 'https://example.com/a', $field->sanitize( 'https://example.com/a' ) );

		$rejected = $field->sanitize( 'javascript:alert(1)' );
		$this->assertNotSame( '', $rejected, 'A rejected scheme must not silently become an empty (valid) value.' );
		$this->assertSame( 'Enter a valid URL.', $field->validate( $rejected ) );
	}

	public function test_email_type_validates_format(): void {
		$field = FieldFactory::create( array( 'id' => 'contact', 'type' => 'email', 'label' => 'Email' ) );

		$this->assertNull( $field->validate( $field->sanitize( 'me@example.com' ) ) );
		$this->assertSame( 'Enter a valid email address.', $field->validate( $field->sanitize( 'nope' ) ) );
	}

	public function test_toggle_defaults_to_off_and_casts_to_bool(): void {
		$field = FieldFactory::create( array( 'id' => 'maintenance', 'type' => 'toggle', 'label' => 'Maintenance' ) );

		$this->assertFalse( $field->default_value() );
		$this->assertSame( 'inline', $field->to_client()['layout'] );
		$this->assertTrue( $field->sanitize( 'true' ) );
		$this->assertTrue( $field->sanitize( 1 ) );
		$this->assertFalse( $field->sanitize( 'false' ) );
		$this->assertFalse( $field->sanitize( '0' ) );
	}

	public function test_a_required_toggle_must_be_on(): void {
		$field = FieldFactory::create( array( 'id' => 'agree', 'type' => 'toggle', 'label' => 'Agree', 'validate' => array( 'required' => true ) ) );

		$this->assertSame( 'This field is required.', $field->validate( false ) );
		$this->assertNull( $field->validate( true ) );
	}

	public function test_select_allows_only_enabled_options(): void {
		$field = FieldFactory::create(
			array(
				'id'      => 'language',
				'type'    => 'select',
				'label'   => 'Language',
				'options' => array(
					'en_US' => 'English',
					'1'     => 'Numeric key',
					array( 'value' => 'de_DE', 'label' => 'Deutsch', 'disabled' => true ),
				),
				'default' => 'en_US',
			)
		);

		$this->assertNull( $field->validate( 'en_US' ) );
		$this->assertNull( $field->validate( '1' ), 'Integer keys are cast back to strings.' );
		$this->assertSame( 'Choose one of the available options.', $field->validate( 'fa_IR' ) );
		$this->assertSame( 'Choose one of the available options.', $field->validate( 'de_DE' ), 'Disabled options cannot be chosen.' );
		$this->assertSame( array( 'en_US', '1' ), $field->to_client()['validate']->allowed );
		$this->assertCount( 3, $field->to_client()['options'] );
		$this->assertTrue( $field->to_client()['options'][2]['disabled'] );
	}

	public function test_select_options_may_be_a_callable_resolved_lazily_once(): void {
		$calls = 0;
		$field = FieldFactory::create(
			array(
				'id'      => 'post_type',
				'type'    => 'select',
				'label'   => 'Post type',
				'options' => static function () use ( &$calls ) {
					++$calls;
					return array( 'post' => 'Posts', 'page' => 'Pages' );
				},
			)
		);

		$this->assertSame( 0, $calls, 'Callable options are not resolved at registration.' );
		$this->assertNull( $field->validate( 'page' ) );
		$field->to_client();
		$this->assertSame( 1, $calls );
		$this->assertInstanceOf( SelectField::class, $field );
	}

	public function test_callbacks_never_reach_the_client(): void {
		$field = $this->text(
			array(
				'sanitize_cb' => static function ( $v ) {
					return $v;
				},
				'validate_cb' => static function ( $v ) {
					return true;
				},
			)
		);

		$json = json_encode( $field->to_client() );
		$this->assertStringNotContainsString( 'sanitize_cb', (string) $json );
		$this->assertStringNotContainsString( 'validate_cb', (string) $json );
	}

	public function test_sanitize_and_validate_callbacks_run(): void {
		$field = $this->text(
			array(
				'sanitize_cb' => static function ( $v ) {
					return strtoupper( $v );
				},
				'validate_cb' => static function ( $v ) {
					return 'ADMIN' === $v ? 'Reserved word.' : true;
				},
			)
		);

		$this->assertSame( 'ADMIN', $field->sanitize( 'admin' ) );
		$this->assertSame( 'Reserved word.', $field->validate( 'ADMIN' ) );
		$this->assertNull( $field->validate( 'BOB' ) );
	}

	public function test_disabled_may_carry_the_reason(): void {
		$field = $this->text( array( 'disabled' => 'Managed by wp-config.php' ) );

		$this->assertTrue( $field->is_disabled() );
		$this->assertSame( 'Managed by wp-config.php', $field->to_client()['disabled'] );
		$this->assertFalse( $this->text()->is_disabled() );
	}

	/**
	 * @dataProvider invalid_configs
	 */
	public function test_registration_time_errors( array $config, string $needle ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessageMatches( '/' . preg_quote( $needle, '/' ) . '/i' );

		FieldFactory::create( $config );
	}

	public function invalid_configs(): array {
		$base = array( 'id' => 'f', 'type' => 'text', 'label' => 'Label' );

		return array(
			'unknown type'       => array( array_merge( $base, array( 'type' => 'wysiwyg' ) ), 'Unknown field type' ),
			'bad id'             => array( array_merge( $base, array( 'id' => 'Bad Id' ) ), 'invalid' ),
			'missing label'      => array( array_diff_key( $base, array( 'label' => 1 ) ), 'needs a label' ),
			'empty label'        => array( array_merge( $base, array( 'label' => '  ' ) ), 'needs a label' ),
			'unknown key'        => array( array_merge( $base, array( 'colour' => 'red' ) ), 'unknown key' ),
			'bad layout'         => array( array_merge( $base, array( 'layout' => 'grid' ) ), 'layout' ),
			'unknown rule'       => array( array_merge( $base, array( 'validate' => array( 'minimum' => 3 ) ) ), 'unknown validation rule' ),
			'bad disabled'       => array( array_merge( $base, array( 'disabled' => 3 ) ), 'disabled' ),
			'select w/o options' => array( array_merge( $base, array( 'type' => 'select' ) ), 'needs `options`' ),
			'select empty'       => array( array_merge( $base, array( 'type' => 'select', 'options' => array() ) ), 'no options' ),
			'select bad option'  => array( array_merge( $base, array( 'type' => 'select', 'options' => array( array( 'value' => 'x' ) ) ) ), 'value` and `label' ),
		);
	}
}
