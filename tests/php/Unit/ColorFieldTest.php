<?php
/**
 * Field type `color`.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Fields\ColorField;
use Fyldo\V1\Fields\FieldFactory;
use Fyldo\V1\Schema\ConfigException;
use PHPUnit\Framework\TestCase;

final class ColorFieldTest extends TestCase {

	private function color( array $extra = array() ) {
		return FieldFactory::create( array_merge( array( 'id' => 'accent', 'type' => 'color', 'label' => 'Accent color' ), $extra ) );
	}

	public function test_the_defaults_are_empty_stacked_and_the_16_colours_of_the_pack_panel(): void {
		$field  = $this->color();
		$client = $field->to_client();

		$this->assertSame( array( 'color' ), $field::types() );
		$this->assertSame( '', $field->default_value() );
		$this->assertSame( 'stacked', $client['layout'] );
		$this->assertSame( ColorField::DEFAULT_PRESETS, $client['presets'] );
		$this->assertCount( 16, $client['presets'] );
		$this->assertEquals( (object) array( 'color' => true ), $client['validate'] );
	}

	public function test_the_default_presets_are_the_swatch_layers_of_the_panel(): void {
		$pack  = json_decode( (string) file_get_contents( dirname( __DIR__, 3 ) . '/design/figma/components/color-picker-panel.json' ), true );
		$names = array();
		$walk  = static function ( array $node ) use ( &$walk, &$names ): void {
			if ( 1 === preg_match( '/^Swatch (#[0-9A-Fa-f]{6})$/', (string) ( $node['name'] ?? '' ), $match ) ) {
				$names[] = strtolower( $match[1] );
			}
			foreach ( $node['children'] ?? array() as $child ) {
				$walk( $child );
			}
		};
		$walk( $pack['variants'][0]['node'] );

		$this->assertSame( $names, ColorField::DEFAULT_PRESETS );
	}

	public function test_presets_can_be_replaced_normalised_and_hidden(): void {
		$this->assertSame( array( '#ff0000', '#00aa00' ), $this->color( array( 'presets' => array( '#FF0000', '0a0', '#ff0000' ) ) )->to_client()['presets'], 'read like typed text, de-duplicated' );
		$this->assertFalse( $this->color( array( 'presets' => false ) )->to_client()['presets'] );
		$this->assertFalse( $this->color( array( 'presets' => array() ) )->to_client()['presets'], 'nothing to offer hides the section' );
	}

	public function test_default_is_read_like_typed_text(): void {
		$this->assertSame( '#aabbcc', $this->color( array( 'default' => '#ABC' ) )->default_value() );
		$this->assertSame( '', $this->color( array( 'default' => '' ) )->default_value() );
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
		$this->color( $config );
	}

	public function invalid_configs(): array {
		return array(
			'default not a colour'     => array( array( 'default' => 'red' ), '`default` must be a hex color' ),
			'default not text'         => array( array( 'default' => 123456 ), '`default` must be a hex color' ),
			'default with alpha'       => array( array( 'default' => '#2271b1ff' ), '`default` must be a hex color' ),
			'preset not a colour'      => array( array( 'presets' => array( '#2271b1', 'blue' ) ), 'preset "blue" is not a hex color' ),
			'preset with alpha'        => array( array( 'presets' => array( '#2271b1ff' ) ), 'preset "#2271b1ff" is not a hex color' ),
			'preset not text'          => array( array( 'presets' => array( array( '#2271b1' ) ) ), 'is not a hex color' ),
			'presets true'             => array( array( 'presets' => true ), '`presets` must be a list of hex colors' ),
			'presets a string'         => array( array( 'presets' => '#2271b1' ), '`presets` must be a list of hex colors' ),
			'unknown key'              => array( array( 'alpha' => true ), 'unknown key(s): alpha' ),
		);
	}

	/**
	 * @dataProvider color_cases
	 *
	 * @param mixed $input  Raw value.
	 * @param mixed $expect Sanitized value.
	 */
	public function test_it_reads_the_shared_fixture_values( $input, $expect ): void {
		$this->assertSame( $expect, $this->color()->sanitize( $input ) );
		$this->assertSame( $expect, ColorField::read( $input ) );
	}

	public function color_cases(): array {
		$fixture = json_decode( (string) file_get_contents( dirname( __DIR__, 2 ) . '/fixtures/validation-cases.json' ), true );

		$out = array();
		foreach ( $fixture['colors'] as $case ) {
			$out[ $case['name'] ] = array( $case['input'], $case['expect'] );
		}

		return $out;
	}

	public function test_a_colour_passes_and_anything_else_is_reported_not_replaced(): void {
		$field = $this->color();

		$this->assertNull( $field->validate( $field->sanitize( '#ABC' ) ) );
		$this->assertNull( $field->validate( $field->sanitize( '' ) ), 'optional' );
		$this->assertSame( 'Enter a valid color, like #rrggbb.', $field->validate( $field->sanitize( 'red' ) ) );
		$this->assertSame( 'Enter a valid color, like #rrggbb.', $field->validate( $field->sanitize( '#abcd' ) ) );
		$this->assertSame( 'red', $field->sanitize( 'red' ) );
	}

	public function test_required_rejects_an_empty_value(): void {
		$field = $this->color( array( 'validate' => array( 'required' => true ) ) );

		$this->assertSame( 'This field is required.', $field->validate( $field->sanitize( '' ) ) );
		$this->assertSame( 'This field is required.', $field->validate( $field->sanitize( null ) ) );
		$this->assertNull( $field->validate( $field->sanitize( '#000' ) ) );
		$this->assertEquals( (object) array( 'required' => true, 'color' => true ), $field->to_client()['validate'] );
	}
}
