<?php
/**
 * Field types `date_range`, `time_range` and `datetime_range`, and the range helpers of Support\Dates.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Fields\AbstractField;
use Fyldo\V1\Fields\DateRangeField;
use Fyldo\V1\Fields\DateTimeRangeField;
use Fyldo\V1\Fields\FieldFactory;
use Fyldo\V1\Fields\TimeRangeField;
use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Support\Dates;
use PHPUnit\Framework\TestCase;

final class DateRangeFieldsTest extends TestCase {

	const EMPTY_RANGE = array(
		'start' => '',
		'end'   => '',
	);

	protected function tearDown(): void {
		Dates::pin( null );
	}

	/**
	 * @param array<string,mixed> $extra Config.
	 */
	private function field( string $type, array $extra = array() ): AbstractField {
		return FieldFactory::create( array_merge( array( 'id' => 'period', 'type' => $type, 'label' => 'Period' ), $extra ) );
	}

	/**
	 * @return array{start:string,end:string}
	 */
	private static function range( string $start, string $end ): array {
		return array(
			'start' => $start,
			'end'   => $end,
		);
	}

	public function test_the_three_types_are_registered_stacked_with_the_single_rule_and_range_on(): void {
		$this->assertInstanceOf( DateRangeField::class, $this->field( 'date_range' ) );
		$this->assertInstanceOf( TimeRangeField::class, $this->field( 'time_range' ) );
		$this->assertInstanceOf( DateTimeRangeField::class, $this->field( 'datetime_range' ) );

		foreach ( array( 'date_range' => 'date', 'time_range' => 'time', 'datetime_range' => 'datetime' ) as $type => $kind ) {
			$client = $this->field( $type )->to_client();
			$this->assertSame( 'stacked', $client['layout'] );
			$this->assertSame( self::EMPTY_RANGE, $client['default'] );
			$this->assertSame( '', $client['placeholder'] );
			$this->assertSame( '', $client['start_placeholder'] );
			$this->assertSame( '', $client['end_placeholder'] );
			$this->assertEquals( (object) array( $kind => array( 'range' => true ) ), $client['validate'] );
		}
		$this->assertSame( 'gregorian', $this->field( 'time_range' )->to_client()['calendar'], 'a time has no calendar' );
	}

	public function test_the_single_config_applies_to_both_ends(): void {
		$field = $this->field(
			'datetime_range',
			array(
				'min'               => 'now',
				'step'              => 5,
				'calendar'          => 'jalali',
				'start_placeholder' => 'From',
				'end_placeholder'   => 'To',
			)
		);
		$client = $field->to_client();

		$this->assertEquals( (object) array( 'datetime' => array( 'min' => 'now', 'step' => 5, 'range' => true ) ), $client['validate'] );
		$this->assertSame( 'jalali', $client['calendar'] );
		$this->assertSame( 'From', $client['start_placeholder'] );
		$this->assertSame( 'To', $client['end_placeholder'] );
	}

	public function test_values_are_read_as_a_pair_unknown_keys_dropped_and_anything_else_empty(): void {
		$field = $this->field( 'date_range' );

		$this->assertSame( self::range( '2026-10-20', '2026-10-26' ), $field->sanitize( array( 'start' => ' ۲۰۲۶-۱۰-۲۰ ', 'end' => '2026-10-26', 'evil' => '<script>' ) ) );
		$this->assertSame( self::range( '2026-10-20', '' ), $field->sanitize( array( 'start' => '2026-10-20' ) ) );
		$this->assertSame( self::EMPTY_RANGE, $field->sanitize( '2026-10-20' ) );
		$this->assertSame( self::EMPTY_RANGE, $field->sanitize( null ) );
		$this->assertSame( self::range( '', '' ), $field->sanitize( array( 'start' => 5, 'end' => array() ) ) );
	}

	public function test_the_server_checks_the_pair_on_every_save(): void {
		$date = $this->field( 'date_range' );
		$this->assertNull( $date->validate( self::EMPTY_RANGE ) );
		$this->assertNull( $date->validate( self::range( '2026-10-20', '2026-10-20' ) ), 'one day' );
		$this->assertSame( 'Choose an end date.', $date->validate( self::range( '2026-10-20', '' ) ) );
		$this->assertSame( 'Choose a start date.', $date->validate( self::range( '', '2026-10-26' ) ) );
		$this->assertSame( 'Choose an end after the start.', $date->validate( self::range( '2026-10-20', '2026-10-19' ) ) );
		$this->assertSame( 'Enter a valid date.', $date->validate( self::range( '2026-02-30', '2026-03-02' ) ) );
		$this->assertSame( array( 'rule' => 'range_order', 'params' => array( 'end' => 'end' ) ), $date->failure( self::range( '2026-10-20', '2026-10-19' ) ) );

		$time = $this->field( 'time_range', array( 'step' => 15 ) );
		$this->assertNull( $time->validate( self::range( '22:00', '06:00' ) ), 'overnight' );
		$this->assertSame( 'Choose an end different from the start.', $time->validate( self::range( '09:00', '09:00' ) ) );
		$this->assertSame( 'Choose an end time.', $time->validate( self::range( '09:00', '' ) ) );
		$this->assertSame( 'Choose a time in steps of 15 minutes.', $time->validate( self::range( '09:00', '17:20' ) ) );

		$datetime = $this->field( 'datetime_range' );
		$this->assertSame( 'Choose an end after the start.', $datetime->validate( self::range( '2026-10-20 05:30:00', '2026-10-20 05:30:00' ) ) );
		$this->assertNull( $datetime->validate( self::range( '2026-10-20 05:30:00', '2026-10-26 15:00:00' ) ) );
	}

	public function test_a_failing_end_is_named_so_the_browser_draws_it_in_red(): void {
		Dates::pin( '2026-10-20 08:00:00', 'UTC' );
		$field = $this->field( 'date_range', array( 'min' => 'today' ) );

		$this->assertSame( 'start', $field->failure( self::range( '2026-10-19', '2026-10-26' ) )['params']['end'] );
		$this->assertSame( 'too_early', $field->failure( self::range( '2026-10-19', '2026-10-26' ) )['rule'] );
		$this->assertSame( 'start', $field->failure( self::range( '', '2026-10-26' ) )['params']['end'] );
	}

	public function test_required_rejects_the_empty_pair(): void {
		$field = $this->field( 'time_range', array( 'validate' => array( 'required' => true ) ) );

		$this->assertSame( 'This field is required.', $field->validate( $field->sanitize( array() ) ) );
		$this->assertSame( 'Choose an end time.', $field->validate( $field->sanitize( array( 'start' => '09:00' ) ) ) );
	}

	public function test_a_stored_value_that_no_longer_validates_falls_back_to_the_default(): void {
		$field = $this->field( 'time_range', array( 'default' => self::range( '22:00', '07:00' ) ) );

		$this->assertSame( self::range( '22:00', '07:00' ), $field->default_value() );
		$this->assertSame( self::range( '22:00', '07:00' ), $field->stored_value( self::range( '09:00', '09:00' ) ) );
		$this->assertSame( self::range( '08:00', '18:00' ), $field->stored_value( self::range( '08:00', '18:00' ) ) );
	}

	/**
	 * @dataProvider invalid_configs
	 *
	 * @param string              $type    Field type.
	 * @param array<string,mixed> $config  Field config.
	 * @param string              $message Expected fragment of the exception message.
	 */
	public function test_bad_config_fails_loudly( string $type, array $config, string $message ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( $message );
		$this->field( $type, $config );
	}

	public function invalid_configs(): array {
		return array(
			'a default that is not a pair' => array( 'date_range', array( 'default' => '2026-10-20' ), '`default` must be array(' ),
			'a default with one end'       => array( 'time_range', array( 'default' => self::range( '22:00', '' ) ), '`default` must be array(' ),
			'a default in the wrong form'  => array( 'datetime_range', array( 'default' => self::range( '2026-10-20 11:00', '2026-10-21 11:00' ) ), 'a UTC datetime' ),
			'a default with other keys'    => array( 'date_range', array( 'default' => array( 'from' => '2026-10-20' ) ), '`default` must be array(' ),
			'min in another format'        => array( 'date_range', array( 'min' => '2026/10/20' ), '`min` must be a date like 2026-10-20, or "today"' ),
			'a date range has no step'     => array( 'date_range', array( 'step' => 5 ), 'unknown key(s): step' ),
			'a time range has no calendar' => array( 'time_range', array( 'calendar' => 'jalali' ), 'unknown key(s): calendar' ),
			'step that does not divide'    => array( 'time_range', array( 'step' => 7 ), '`step` must be a whole number of minutes that divides an hour' ),
			'no presets'                   => array( 'date_range', array( 'presets' => array() ), 'unknown key(s): presets' ),
			'no min_days'                  => array( 'date_range', array( 'min_days' => 2 ), 'unknown key(s): min_days' ),
			'min inside validate'          => array( 'time_range', array( 'validate' => array( 'min' => '09:00' ) ), 'set `min` on the field, not in `validate`' ),
		);
	}

	public function test_range_to_site_reads_both_ends_in_the_site_time_zone(): void {
		Dates::pin( null, 'Asia/Tehran' );

		list( $from, $to ) = Dates::range_to_site( self::range( '2026-10-20 05:30:00', '2026-10-26 15:00:00' ) );
		$this->assertNotNull( $from );
		$this->assertNotNull( $to );
		$this->assertSame( '2026-10-20 09:00', $from->format( 'Y-m-d H:i' ) );
		$this->assertSame( '2026-10-26 18:30', $to->format( 'Y-m-d H:i' ) );

		$this->assertSame( array( null, null ), Dates::range_to_site( self::EMPTY_RANGE ) );
		$this->assertSame( array( null, null ), Dates::range_to_site( array() ) );
		list( $start, $end ) = Dates::range_to_site( self::range( '2026-10-20 05:30:00', '2026-02-30 10:00:00' ) );
		$this->assertNotNull( $start );
		$this->assertNull( $end, 'an invalid end' );
	}

	public function test_range_to_site_across_a_dst_change(): void {
		Dates::pin( null, 'Europe/Berlin' );

		list( $from, $to ) = Dates::range_to_site( self::range( '2026-10-25 00:30:00', '2026-10-25 01:15:00' ) );
		$this->assertSame( '2026-10-25 02:30 +02:00', $from->format( 'Y-m-d H:i P' ) );
		$this->assertSame( '2026-10-25 02:15 +01:00', $to->format( 'Y-m-d H:i P' ) );
		$this->assertSame( 45 * 60, $to->getTimestamp() - $from->getTimestamp(), 'the real time between them' );
	}

	public function test_time_in_range_includes_the_start_and_excludes_the_end(): void {
		$day = self::range( '09:00', '17:30' );

		$this->assertTrue( Dates::time_in_range( $day, '09:00' ), 'the start' );
		$this->assertTrue( Dates::time_in_range( $day, '12:00' ) );
		$this->assertTrue( Dates::time_in_range( $day, '17:29' ) );
		$this->assertFalse( Dates::time_in_range( $day, '17:30' ), 'the end' );
		$this->assertFalse( Dates::time_in_range( $day, '08:59' ) );
		$this->assertFalse( Dates::time_in_range( $day, '23:00' ) );
	}

	public function test_time_in_range_handles_an_overnight_range(): void {
		$night = self::range( '22:00', '07:00' );

		$this->assertTrue( Dates::time_in_range( $night, '22:00' ), 'the start' );
		$this->assertTrue( Dates::time_in_range( $night, '23:59' ) );
		$this->assertTrue( Dates::time_in_range( $night, '00:00' ) );
		$this->assertTrue( Dates::time_in_range( $night, '06:59' ) );
		$this->assertFalse( Dates::time_in_range( $night, '07:00' ), 'the end' );
		$this->assertFalse( Dates::time_in_range( $night, '12:00' ) );
		$this->assertFalse( Dates::time_in_range( $night, '21:59' ) );
	}

	public function test_time_in_range_defaults_to_now_on_the_sites_clock(): void {
		Dates::pin( '2026-10-19 19:00:00', 'Asia/Tehran' ); // 22:30 in Tehran

		$this->assertTrue( Dates::time_in_range( self::range( '22:00', '07:00' ) ) );
		$this->assertFalse( Dates::time_in_range( self::range( '09:00', '17:00' ) ), 'UTC 19:00 would be outside too, but Tehran decides' );
		$this->assertTrue( Dates::time_in_range( self::range( '22:15', '22:45' ) ) );
	}

	public function test_time_in_range_is_false_for_an_empty_invalid_or_zero_length_range(): void {
		$this->assertFalse( Dates::time_in_range( self::EMPTY_RANGE, '10:00' ) );
		$this->assertFalse( Dates::time_in_range( array(), '10:00' ) );
		$this->assertFalse( Dates::time_in_range( self::range( '09:00', '09:00' ), '09:00' ) );
		$this->assertFalse( Dates::time_in_range( self::range( '09:00', '24:00' ), '10:00' ) );
		$this->assertFalse( Dates::time_in_range( self::range( '09:00', '17:00' ), '10:00:00' ), 'a time is H:i' );
	}
}
