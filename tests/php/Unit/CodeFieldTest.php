<?php
/**
 * Field type `code` (Figma "Code Editor"): config, what the browser gets, the code kept as typed, the implied `code`
 * rule with CSS messages keyed by line, and `validate_cb` by line.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Fields\CodeField;
use Fyldo\V1\Fields\FieldFactory;
use Fyldo\V1\Schema\ConfigException;
use PHPUnit\Framework\TestCase;

final class CodeFieldTest extends TestCase {

	protected function setUp(): void {
		$GLOBALS['__fyldo_test_caps'] = array( 'manage_options', 'unfiltered_html' );
	}

	private static function code( array $extra = array() ): CodeField {
		$field = FieldFactory::create(
			array_merge(
				array(
					'id'    => 'custom_css',
					'type'  => 'code',
					'label' => 'Custom CSS',
				),
				$extra
			)
		);
		self::assertInstanceOf( CodeField::class, $field );
		return $field;
	}

	public function test_defaults_and_what_the_browser_gets(): void {
		$client = self::code()->to_client();

		$this->assertSame( 'code', $client['type'] );
		$this->assertSame( 'text', $client['language'] );
		$this->assertSame( 7, $client['rows'] );
		$this->assertTrue( $client['toolbar'] );
		$this->assertTrue( $client['line_numbers'] );
		$this->assertSame( 'stacked', $client['layout'] );
		$this->assertSame( '', $client['default'] );
		$this->assertArrayNotHasKey( 'code', (array) $client['validate'], 'text is not checked' );

		$css = self::code( array( 'language' => 'css', 'rows' => 12, 'toolbar' => false, 'line_numbers' => false ) )->to_client();
		$this->assertSame( array( 'css', 12, false, false ), array( $css['language'], $css['rows'], $css['toolbar'], $css['line_numbers'] ) );
		$this->assertSame( array( 'language' => 'css' ), ( (array) $css['validate'] )['code'], 'the implied rule' );
		$this->assertSame( array( 'language' => 'json' ), ( (array) self::code( array( 'language' => 'json' ) )->to_client()['validate'] )['code'] );
		$this->assertArrayNotHasKey( 'code', (array) self::code( array( 'language' => 'html' ) )->to_client()['validate'] );
	}

	public function test_the_code_is_kept_as_typed(): void {
		$css = ".a > .b {\r\n  content: \"<&>\";\r}\0";
		$this->assertSame( ".a > .b {\n  content: \"<&>\";\n}", self::code( array( 'language' => 'css' ) )->sanitize( $css ), 'line ends normalised, NUL dropped, nothing stripped' );
		$this->assertSame( '', self::code()->sanitize( "\xC3\x28" ), 'invalid UTF-8' );
		$this->assertSame( '', self::code()->sanitize( array( 'a' ) ) );
	}

	public function test_html_is_filtered_for_someone_without_unfiltered_html(): void {
		$html = '<p onclick="x()">Hi</p><script>alert(1)</script>';
		$this->assertSame( $html, self::code( array( 'language' => 'html' ) )->sanitize( $html ) );

		$GLOBALS['__fyldo_test_caps'] = array( 'manage_options' );
		$this->assertSame( '<p>Hi</p>', self::code( array( 'language' => 'html' ) )->sanitize( $html ) );
		$this->assertSame( '<b onclick="x()">', self::code( array( 'language' => 'css' ) )->sanitize( '<b onclick="x()">' ), 'only HTML' );
	}

	public function test_json_and_text_are_filtered_on_save_for_someone_without_unfiltered_html(): void {
		$json = "{\n  \"a\": \"</script><b>\"\n}";
		$text = 'Hi <script>alert(1)</script>';
		$this->assertSame( $json, self::code( array( 'language' => 'json' ) )->sanitize( $json ) );
		$this->assertSame( $text, self::code()->sanitize( $text ) );

		$GLOBALS['__fyldo_test_caps'] = array( 'manage_options' );
		$escaped = self::code( array( 'language' => 'json' ) )->sanitize( $json );
		$this->assertSame( "{\n  \"a\": \"\\u003C/script\\u003E\\u003Cb\\u003E\"\n}", $escaped, 'formatting kept' );
		$this->assertSame( json_decode( $json, true ), json_decode( $escaped, true ), 'the same JSON' );
		$this->assertSame( 'Hi ', self::code()->sanitize( $text ) );
		$this->assertSame( 'a { background: url(x.png); }', self::code( array( 'language' => 'css' ) )->sanitize( 'a { background: url(x.png); }' ), 'CSS as typed' );
	}

	public function test_a_code_sub_field_of_a_group_is_filtered_on_save_too(): void {
		$GLOBALS['__fyldo_test_caps'] = array( 'manage_options' );
		$group = FieldFactory::create(
			array(
				'id'      => 'snippets',
				'type'    => 'group',
				'label'   => 'Snippets',
				'addable' => true,
				'fields'  => array( array( 'id' => 'data', 'type' => 'code', 'label' => 'Data', 'language' => 'json' ) ),
			)
		);

		$this->assertSame( array( array( 'data' => '["\\u003Cb\\u003E"]' ) ), $group->sanitize( array( array( 'data' => '["<b>"]' ) ) ) );
		$this->assertSame( array( array( 'data' => '["<b>"]' ) ), $group->stored_value( array( array( 'data' => '["<b>"]' ) ) ), 'not on read' );
	}

	public function test_reading_never_filters_for_the_current_user(): void {
		$html = '<p onclick="x()">Hi</p><script>alert(1)</script>';
		$GLOBALS['__fyldo_test_caps'] = array();

		$this->assertSame( $html, self::code( array( 'language' => 'html' ) )->stored_value( $html ), 'what an admin with unfiltered_html saved' );
		$this->assertSame( 'Hi <b>', self::code()->stored_value( 'Hi <b>' ) );
	}

	public function test_stored_css_with_markup_reads_as_the_default(): void {
		$field = self::code( array( 'language' => 'css', 'default' => 'a {}' ) );

		$this->assertSame( 'a {}', $field->stored_value( "a {\n}</style><script>alert(1)</script>" ) );
		$this->assertSame( 'b { color: red; }', $field->stored_value( 'b { color: red; }' ) );
	}

	public function test_css_markup_is_reported_at_its_line(): void {
		$field = self::code( array( 'language' => 'css' ) );

		$this->assertSame( array( 'custom_css.3' => 'Markup is not allowed in CSS.' ), $field->errors( "a {\n  color: red;\n}</style>" ) );
		$this->assertSame( 'Markup is not allowed in CSS.', $field->validate( '<b>' ) );
		$this->assertSame( array(), $field->errors( ".a > .b { content: 'a < b'; }" ) );
	}

	public function test_json_must_parse(): void {
		$field = self::code( array( 'language' => 'json' ) );

		$this->assertSame( array( 'custom_css' => 'Enter valid JSON.' ), $field->errors( '{a: 1}' ) );
		$this->assertSame( array(), $field->errors( '{"a": 1}' ) );
		$this->assertSame( array(), $field->errors( '' ), 'optional and empty' );
	}

	public function test_validate_cb_may_name_lines_and_a_stored_value_keeps_them(): void {
		$field = self::code(
			array(
				'language'    => 'css',
				'validate_cb' => static function ( $css ) {
					$errors = array();
					foreach ( explode( "\n", $css ) as $i => $line ) {
						if ( false !== strpos( $line, '!important' ) ) {
							$errors[ $i + 1 ] = 'Avoid !important.';
						}
					}
					return $errors;
				},
			)
		);
		$css = "a {\n  color: red !important;\n}";

		$this->assertSame( array( 'custom_css.2' => 'Avoid !important.' ), $field->errors( $css ) );
		$this->assertSame( $css, $field->stored_value( $css ), 'a message at a line keeps the stored code' );
		$this->assertSame( '', self::code( array( 'language' => 'json' ) )->stored_value( '{a: 1}' ), 'JSON that does not parse falls back' );
	}

	/**
	 * @dataProvider invalid_configs
	 *
	 * @param array<string,mixed> $config  Field config.
	 * @param string              $message Expected part of the message.
	 */
	public function test_bad_config_fails_loudly( array $config, string $message ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( $message );
		self::code( $config );
	}

	public function invalid_configs(): array {
		return array(
			'unknown language' => array( array( 'language' => 'php' ), '`language` must be one of css, html, json, text' ),
			'rows too few'     => array( array( 'rows' => 2 ), '`rows` must be a whole number between 3 and 40' ),
			'rows not a whole' => array( array( 'rows' => '7' ), '`rows` must be a whole number' ),
			'toolbar not bool' => array( array( 'toolbar' => 'yes' ), '`toolbar` must be true or false' ),
			'lines not bool'   => array( array( 'line_numbers' => 1 ), '`line_numbers` must be true or false' ),
		);
	}
}
