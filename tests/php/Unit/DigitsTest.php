<?php
/**
 * Persian / Arabic-Indic digit normalisation and number reading, driven by the fixture the browser test also runs.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Fields\FieldFactory;
use Fyldo\V1\Fields\NumberField;
use Fyldo\V1\Validation\Digits;
use PHPUnit\Framework\TestCase;

final class DigitsTest extends TestCase {

	/**
	 * @return array<string,mixed>
	 */
	private static function fixture(): array {
		return json_decode( (string) file_get_contents( dirname( __DIR__, 2 ) . '/fixtures/validation-cases.json' ), true );
	}

	/**
	 * @dataProvider digit_cases
	 */
	public function test_the_field_type_keeps_the_shared_fixture_text( string $type, string $input, string $expect ): void {
		$field = FieldFactory::create( array( 'id' => 'f', 'type' => $type, 'label' => 'Label' ) );

		$this->assertSame( $expect, $field->sanitize( $input ) );
	}

	public function digit_cases(): array {
		$out = array();
		foreach ( self::fixture()['digits'] as $case ) {
			$out[ $case['name'] ] = array( $case['type'], $case['input'], $case['expect'] );
		}

		return $out;
	}

	/**
	 * @dataProvider number_cases
	 *
	 * @param mixed $input  Raw value.
	 * @param mixed $expect Sanitized value.
	 */
	public function test_number_field_reads_the_shared_fixture_values( $input, $expect ): void {
		$field = FieldFactory::create( array( 'id' => 'n', 'type' => 'number', 'label' => 'Number' ) );

		$this->assertSame( $expect, $field->sanitize( $input ) );
		$this->assertSame( $expect, NumberField::read( $input ) );
	}

	public function number_cases(): array {
		$out = array();
		foreach ( self::fixture()['numbers'] as $case ) {
			$out[ $case['name'] ] = array( $case['input'], $case['expect'] );
		}

		return $out;
	}

	public function test_every_digit_maps_to_its_ascii_twin(): void {
		$this->assertSame( '0123456789', Digits::to_ascii( "\u{06F0}\u{06F1}\u{06F2}\u{06F3}\u{06F4}\u{06F5}\u{06F6}\u{06F7}\u{06F8}\u{06F9}" ) );
		$this->assertSame( '0123456789', Digits::to_ascii( "\u{0660}\u{0661}\u{0662}\u{0663}\u{0664}\u{0665}\u{0666}\u{0667}\u{0668}\u{0669}" ) );
		$this->assertSame( 'سلام 1 abc', Digits::to_ascii( 'سلام ۱ abc' ), 'Only digits change.' );
	}
}
