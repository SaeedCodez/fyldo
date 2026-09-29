<?php
/**
 * Declarative validation, driven by the fixture that the browser test also runs.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Validation\Rules;
use PHPUnit\Framework\TestCase;

final class RulesTest extends TestCase {

	/**
	 * @dataProvider cases
	 *
	 * @param array<string,mixed> $rules  Rules.
	 * @param mixed               $value  Value.
	 * @param string|null         $expect Expected failing rule id.
	 */
	public function test_shared_fixture( array $rules, $value, ?string $expect ): void {
		$failure = Rules::check( $rules, $value );

		$this->assertSame( $expect, null === $failure ? null : $failure['rule'] );
	}

	public function cases(): array {
		$file = dirname( __DIR__, 2 ) . '/fixtures/validation-cases.json';
		$json = json_decode( (string) file_get_contents( $file ), true );

		$out = array();
		foreach ( $json['cases'] as $case ) {
			$out[ $case['name'] ] = array( $case['rules'], $case['value'], $case['expect'] );
		}

		return $out;
	}

	public function test_min_and_max_length_report_their_limits(): void {
		$this->assertSame( array( 'min' => 3 ), Rules::check( array( 'min_length' => 3 ), 'a' )['params'] );
		$this->assertSame( array( 'max' => 2 ), Rules::check( array( 'max_length' => 2 ), 'abc' )['params'] );
	}

	public function test_an_invalid_developer_pattern_fails_closed_without_warnings(): void {
		$failure = Rules::check( array( 'pattern' => '(' ), 'abc' );

		$this->assertSame( 'pattern', $failure['rule'] );
	}

	public function test_every_known_rule_is_covered_by_the_fixture(): void {
		$json = json_decode( (string) file_get_contents( dirname( __DIR__, 2 ) . '/fixtures/validation-cases.json' ), true );

		$used = array();
		foreach ( $json['cases'] as $case ) {
			$used = array_merge( $used, array_keys( $case['rules'] ) );
		}

		$this->assertSame( array(), array_diff( Rules::KNOWN, array_unique( $used ) ) );
	}
}
