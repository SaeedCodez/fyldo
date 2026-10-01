<?php
/**
 * Field types `segmented` and `slider`.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Fields\FieldFactory;
use Fyldo\V1\Instance;
use Fyldo\V1\Schema\ConfigException;
use PHPUnit\Framework\TestCase;

final class SegmentedSliderFieldsTest extends TestCase {

	protected function setUp(): void {
		$GLOBALS['__fyldo_test_options']  = array();
		$GLOBALS['__fyldo_test_autoload'] = array();
		$GLOBALS['__fyldo_test_wrong']    = array();
	}

	private function segmented( array $extra = array() ) {
		return FieldFactory::create(
			array_merge(
				array(
					'id'      => 'sort_by',
					'type'    => 'segmented',
					'label'   => 'Sort products',
					'options' => array( 'order' => 'By order', 'product' => 'By product', 'simple' => 'Simple' ),
					'default' => 'product',
				),
				$extra
			)
		);
	}

	private function slider( array $extra = array() ) {
		return FieldFactory::create( array_merge( array( 'id' => 'quality', 'type' => 'slider', 'label' => 'Image quality' ), $extra ) );
	}

	// ── Segmented ──────────────────────────────────────────────────────────────────────────────────────

	public function test_segmented_accepts_only_enabled_options_and_is_never_empty(): void {
		$field = $this->segmented();

		$this->assertNull( $field->validate( 'simple' ) );
		$this->assertSame( 'Choose one of the available options.', $field->validate( 'other' ) );
		$this->assertSame( 'This field is required.', $field->validate( '' ) );
		$this->assertSame( '', $field->sanitize( array( 'order' ) ) );
		$this->assertSame( 'product', $field->default_value() );
		$this->assertSame( 'stacked', $field->to_client()['layout'] );
		$this->assertSame( array( 'segmented' ), $field::types() );
		$this->assertEquals(
			array( 'required' => true, 'allowed' => array( 'order', 'product', 'simple' ) ),
			(array) $field->to_client()['validate']
		);
	}

	public function test_segmented_exports_its_options_and_a_disabled_one_cannot_be_chosen(): void {
		$field = $this->segmented(
			array(
				'options' => array(
					array( 'value' => 'order', 'label' => 'By order' ),
					array( 'value' => 'product', 'label' => 'By product' ),
					array( 'value' => 'pro', 'label' => 'Pro', 'disabled' => true ),
				),
			)
		);

		$options = $field->to_client()['options'];
		$this->assertSame( array( 'order', 'product', 'pro' ), array_column( $options, 'value' ) );
		$this->assertTrue( $options[2]['disabled'] );
		$this->assertSame( 'Choose one of the available options.', $field->validate( 'pro' ) );
	}

	public function test_segmented_with_more_than_five_options_asks_for_a_select_but_still_works(): void {
		$options = array();
		foreach ( range( 1, 6 ) as $n ) {
			$options[ 'o' . $n ] = 'Option ' . $n;
		}

		$field = $this->segmented( array( 'options' => $options, 'default' => 'o1' ) );

		$this->assertNull( $field->validate( 'o6' ) );
		$this->assertCount( 1, $GLOBALS['__fyldo_test_wrong'] );
		$this->assertStringContainsString( 'use a `select` field', $GLOBALS['__fyldo_test_wrong'][0] );
	}

	// ── Slider ─────────────────────────────────────────────────────────────────────────────────────────

	public function test_slider_defaults_to_zero_to_hundred_by_one_and_starts_at_min(): void {
		$field  = $this->slider();
		$client = $field->to_client();

		$this->assertSame( 0, $field->default_value() );
		$this->assertSame( 'stacked', $client['layout'] );
		$this->assertSame( array( 0, 100, 1 ), array( $client['min'], $client['max'], $client['step'] ) );
		$this->assertEquals( (object) array( 'number' => true, 'required' => true, 'min' => 0, 'max' => 100, 'step' => 1 ), $client['validate'] );
		$this->assertSame( 10, $this->slider( array( 'min' => 10, 'max' => 50 ) )->default_value(), 'min is the default when none is given' );
	}

	public function test_slider_exports_its_range_as_the_declarative_rules_and_checks_them(): void {
		$field = $this->slider( array( 'min' => 0, 'max' => 100, 'step' => 5, 'default' => 75 ) );

		$this->assertSame( 75, $field->default_value() );
		$this->assertNull( $field->validate( $field->sanitize( 0 ) ) );
		$this->assertNull( $field->validate( $field->sanitize( '100' ) ) );
		$this->assertSame( 'Enter a value of at least 0.', $field->validate( $field->sanitize( -5 ) ), 'rejected, not clamped' );
		$this->assertSame( 'Enter a value of at most 100.', $field->validate( $field->sanitize( 105 ) ) );
		$this->assertSame( 'Enter a value in steps of 5.', $field->validate( $field->sanitize( 33 ) ) );
		$this->assertSame( 'This field is required.', $field->validate( $field->sanitize( '' ) ) );
		$this->assertSame( 'Enter a number.', $field->validate( $field->sanitize( 'abc' ) ) );
		$this->assertSame( 'This field is required.', $field->validate( $field->sanitize( array( 5 ) ) ), 'Non-scalars read as nothing.' );
	}

	public function test_slider_reads_persian_digits_and_keeps_whole_numbers_whole(): void {
		$field = $this->slider( array( 'step' => 5 ) );

		$this->assertSame( 75, $field->sanitize( '۷۵' ) );
		$this->assertSame( 50, $field->sanitize( 50.0 ) );
		$this->assertSame( 0.5, $this->slider( array( 'max' => 1, 'step' => 0.1 ) )->sanitize( '0.5' ) );
	}

	public function test_slider_step_counts_from_min_and_allows_decimals(): void {
		$grid = $this->slider( array( 'min' => 10, 'max' => 50, 'step' => 15 ) );
		$this->assertNull( $grid->validate( 25 ) );
		$this->assertSame( 'Enter a value in steps of 15.', $grid->validate( 30 ) );

		$decimal = $this->slider( array( 'min' => 0, 'max' => 1, 'step' => 0.1 ) );
		$this->assertNull( $decimal->validate( 0.3 ) );
		$this->assertSame( 'Enter a value in steps of 0.1.', $decimal->validate( 0.35 ) );
	}

	/**
	 * @dataProvider invalid_configs
	 *
	 * @param array<string,mixed> $config  Field config.
	 * @param string              $message Expected fragment of the exception message.
	 */
	public function test_registration_mistakes_are_reported( array $config, string $message ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessageMatches( '/' . preg_quote( $message, '/' ) . '/' );

		FieldFactory::create( $config );
	}

	public function invalid_configs(): array {
		$seg    = array( 'id' => 's', 'type' => 'segmented', 'label' => 'Seg', 'options' => array( 'a' => 'A', 'b' => 'B' ), 'default' => 'a' );
		$slider = array( 'id' => 'q', 'type' => 'slider', 'label' => 'Slider' );

		return array(
			'segmented without default'        => array( array_diff_key( $seg, array( 'default' => 1 ) ), 'needs a `default`' ),
			'segmented default not an option'  => array( array_merge( $seg, array( 'default' => 'z' ) ), 'not one of its enabled options' ),
			'segmented default is disabled'    => array( array_merge( $seg, array( 'options' => array( array( 'value' => 'a', 'label' => 'A', 'disabled' => true ), 'b' => 'B' ) ) ), 'not one of its enabled options' ),
			'segmented with one option'        => array( array_merge( $seg, array( 'options' => array( 'a' => 'A' ) ) ), 'at least two options' ),
			'segmented without options'        => array( array_diff_key( $seg, array( 'options' => 1 ) ), 'needs `options`' ),
			'segmented unknown key'            => array( array_merge( $seg, array( 'min' => 1 ) ), 'unknown key' ),
			'slider min not a number'          => array( array_merge( $slider, array( 'min' => '0' ) ), '`min` must be a number' ),
			'slider step zero'                 => array( array_merge( $slider, array( 'step' => 0 ) ), '`step` must be a number greater than 0' ),
			'slider min equals max'            => array( array_merge( $slider, array( 'min' => 5, 'max' => 5 ) ), '`min` must be less than `max`' ),
			'slider min above max'             => array( array_merge( $slider, array( 'min' => 9, 'max' => 5 ) ), '`min` must be less than `max`' ),
			'slider default not a number'      => array( array_merge( $slider, array( 'default' => 'x' ) ), '`default` must be a number' ),
			'slider default above max'         => array( array_merge( $slider, array( 'default' => 101 ) ), 'outside the range or off the step' ),
			'slider default off the step'      => array( array_merge( $slider, array( 'step' => 5, 'default' => 12 ) ), 'outside the range or off the step' ),
			'slider range in validate'         => array( array_merge( $slider, array( 'validate' => array( 'max' => 50 ) ) ), 'set `max` on the field' ),
			'slider unknown key'               => array( array_merge( $slider, array( 'options' => array() ) ), 'unknown key' ),
		);
	}

	// ── Through the save pipeline ──────────────────────────────────────────────────────────────────────

	private function instance(): Instance {
		$instance = new Instance( 'acme-shop', array( 'title' => 'Acme Shop' ) );
		$instance->add_page(
			'general',
			array(
				'title'    => 'General',
				'sections' => array(
					array(
						'id'     => 'display',
						'title'  => 'Display',
						'fields' => array(
							array( 'id' => 'sort_by', 'type' => 'segmented', 'label' => 'Sort products', 'options' => array( 'order' => 'By order', 'product' => 'By product' ), 'default' => 'product' ),
							array( 'id' => 'quality', 'type' => 'slider', 'label' => 'Image quality', 'min' => 0, 'max' => 100, 'step' => 5, 'default' => 75 ),
						),
					),
				),
			)
		);

		return $instance;
	}

	public function test_defaults_and_a_round_trip_through_the_saver(): void {
		$instance = $this->instance();

		$this->assertSame( array( 'sort_by' => 'product', 'quality' => 75 ), $instance->all( 'general' ) );

		$result = $instance->update( 'general', array( 'sort_by' => 'order', 'quality' => '40' ) );

		$this->assertSame( 'ok', $result['status'] );
		$this->assertSame( array( 'sort_by' => 'order', 'quality' => 40 ), $instance->all( 'general' ) );
	}

	public function test_an_out_of_range_slider_value_and_an_unknown_segment_are_reported_and_nothing_is_saved(): void {
		$instance = $this->instance();

		$result = $instance->update( 'general', array( 'sort_by' => 'random', 'quality' => 105 ) );

		$this->assertSame( 'invalid', $result['status'] );
		$this->assertSame(
			array(
				'sort_by' => 'Choose one of the available options.',
				'quality' => 'Enter a value of at most 100.',
			),
			$result['errors']
		);
		$this->assertSame( array( 'sort_by' => 'product', 'quality' => 75 ), $instance->all( 'general' ) );
	}
}
