<?php
/**
 * Field types `date`, `time` and `datetime`, and Support\Dates.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Fields\AbstractField;
use Fyldo\V1\Fields\DateField;
use Fyldo\V1\Fields\DateTimeField;
use Fyldo\V1\Fields\FieldFactory;
use Fyldo\V1\Fields\TimeField;
use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Support\Dates;
use PHPUnit\Framework\TestCase;

final class DateTimeFieldsTest extends TestCase {

	protected function tearDown(): void {
		Dates::pin( null );
	}

	/**
	 * @param array<string,mixed> $extra Config.
	 */
	private function field( string $type, array $extra = array() ): AbstractField {
		return FieldFactory::create( array_merge( array( 'id' => 'when', 'type' => $type, 'label' => 'When' ), $extra ) );
	}

	public function test_the_three_types_are_registered_with_the_field_layout_and_their_implied_rule(): void {
		$this->assertInstanceOf( DateField::class, $this->field( 'date' ) );
		$this->assertInstanceOf( TimeField::class, $this->field( 'time' ) );
		$this->assertInstanceOf( DateTimeField::class, $this->field( 'datetime' ) );

		foreach ( array( 'date', 'time', 'datetime' ) as $type ) {
			$client = $this->field( $type )->to_client();
			$this->assertSame( 'field', $client['layout'] );
			$this->assertSame( '', $client['default'] );
			$this->assertSame( '', $client['placeholder'] );
			$this->assertEquals( (object) array( $type => true ), $client['validate'] );
		}
	}

	public function test_calendar_defaults_to_auto_and_can_be_locked(): void {
		$this->assertSame( 'auto', $this->field( 'date' )->to_client()['calendar'] );
		$this->assertSame( 'jalali', $this->field( 'date', array( 'calendar' => 'jalali' ) )->to_client()['calendar'] );
		$this->assertSame( 'gregorian', $this->field( 'datetime', array( 'calendar' => 'gregorian' ) )->to_client()['calendar'] );
		$this->assertSame( 'gregorian', $this->field( 'time' )->to_client()['calendar'], 'a time has no calendar' );
	}

	public function test_min_max_and_step_become_the_implied_rule(): void {
		$date = $this->field( 'date', array( 'min' => 'today', 'max' => '2030-12-31' ) );
		$this->assertEquals( (object) array( 'date' => array( 'min' => 'today', 'max' => '2030-12-31' ) ), $date->to_client()['validate'] );

		$time = $this->field( 'time', array( 'step' => 15, 'min' => '09:00' ) );
		$this->assertEquals( (object) array( 'time' => array( 'min' => '09:00', 'step' => 15 ) ), $time->to_client()['validate'] );

		$this->assertEquals( (object) array( 'datetime' => true ), $this->field( 'datetime', array( 'step' => 1 ) )->to_client()['validate'], 'step 1 is the default' );
		$this->assertEquals( (object) array( 'required' => true, 'datetime' => array( 'min' => 'now', 'step' => 5 ) ), $this->field( 'datetime', array( 'step' => 5, 'min' => 'now', 'validate' => array( 'required' => true ) ) )->to_client()['validate'] );
	}

	public function test_values_are_read_as_text_with_ascii_digits_and_never_fixed_up(): void {
		$date = $this->field( 'date' );
		$this->assertSame( '2026-10-20', $date->sanitize( ' ۲۰۲۶-۱۰-۲۰ ' ) );
		$this->assertSame( '', $date->sanitize( array( '2026-10-20' ) ) );
		$this->assertSame( '', $date->sanitize( 20261020 ) );
		$this->assertSame( '1405-07-28 Jalali', $date->sanitize( '1405-07-28 Jalali' ), 'kept, so the rule reports it' );
		$this->assertSame( '14:30', $this->field( 'time' )->sanitize( '۱۴:۳۰' ) );
	}

	public function test_the_server_rejects_impossible_values_with_a_field_error(): void {
		$date = $this->field( 'date' );
		$this->assertNull( $date->validate( $date->sanitize( '2024-02-29' ) ) );
		$this->assertSame( 'Enter a valid date.', $date->validate( $date->sanitize( '2026-02-30' ) ) );
		$this->assertSame( 'Enter a valid date.', $date->validate( $date->sanitize( '2025-02-29' ) ) );

		$time = $this->field( 'time', array( 'step' => 15 ) );
		$this->assertSame( 'Enter a valid time between 00:00 and 23:59.', $time->validate( $time->sanitize( '24:00' ) ) );
		$this->assertSame( 'Choose a time in steps of 15 minutes.', $time->validate( $time->sanitize( '09:50' ) ) );
		$this->assertNull( $time->validate( $time->sanitize( '09:45' ) ) );

		$datetime = $this->field( 'datetime' );
		$this->assertSame( 'Enter a valid date and time.', $datetime->validate( $datetime->sanitize( '2026-10-20T11:00:00Z' ) ) );
		$this->assertSame( 'Enter a valid date and time.', $datetime->validate( $datetime->sanitize( '1405-07-28 14:30' ) ), 'never a Jalali or site-time text' );
	}

	public function test_min_today_is_the_sites_today_not_the_requests(): void {
		Dates::pin( '2026-10-19 21:00:00', 'Asia/Tehran' ); // 00:30 on the 20th in Tehran
		$date = $this->field( 'date', array( 'min' => 'today' ) );

		$this->assertNull( $date->validate( '2026-10-20' ) );
		$this->assertSame( 'Choose 2026-10-20 or later.', $date->validate( '2026-10-19' ) );
		$this->assertSame( array( 'rule' => 'too_early', 'params' => array( 'bound' => '2026-10-20', 'kind' => 'date' ) ), $date->failure( '2026-10-19' ) );
	}

	public function test_min_now_and_max_for_a_datetime(): void {
		Dates::pin( '2026-10-20 11:00:30', 'UTC' );
		$field = $this->field( 'datetime', array( 'min' => 'now', 'max' => '2026-12-31 20:29:00' ) );

		$this->assertNull( $field->validate( '2026-10-20 11:00:00' ) );
		$this->assertSame( 'too_early', $field->failure( '2026-10-20 10:59:00' )['rule'] );
		$this->assertSame( 'too_late', $field->failure( '2026-12-31 20:30:00' )['rule'] );
	}

	public function test_a_datetime_step_counts_site_time_across_a_dst_change(): void {
		Dates::pin( null, 'Europe/Berlin' );
		$field = $this->field( 'datetime', array( 'step' => 30 ) );

		// 29 March 2026: 02:00 CET jumps to 03:00 CEST at 01:00 UTC.
		$this->assertNull( $field->validate( '2026-03-29 00:30:00' ), '01:30 CET' );
		$this->assertNull( $field->validate( '2026-03-29 01:00:00' ), '03:00 CEST' );
		$this->assertSame( 'minute_step', $field->failure( '2026-03-29 01:15:00' )['rule'], '03:15 CEST' );
	}

	public function test_to_site_reads_a_stored_utc_datetime_in_the_site_time_zone_across_dst(): void {
		Dates::pin( null, 'Europe/Berlin' );

		$before = Dates::to_site( '2026-03-29 00:30:00' );
		$after  = Dates::to_site( '2026-03-29 01:30:00' );
		$this->assertNotNull( $before );
		$this->assertNotNull( $after );
		$this->assertSame( '2026-03-29 01:30 +01:00', $before->format( 'Y-m-d H:i P' ) );
		$this->assertSame( '2026-03-29 03:30 +02:00', $after->format( 'Y-m-d H:i P' ) );
		$this->assertSame( '2026-10-25 02:30 +02:00', Dates::to_site( '2026-10-25 00:30:00' )->format( 'Y-m-d H:i P' ), 'the first 02:30 of the autumn change' );
		$this->assertSame( '2026-10-25 02:30 +01:00', Dates::to_site( '2026-10-25 01:30:00' )->format( 'Y-m-d H:i P' ), 'the second one' );
		$this->assertSame( strtotime( '2026-03-29 01:30:00 UTC' ), $after->getTimestamp(), 'the same instant' );

		Dates::pin( null, 'Asia/Tehran' );
		$this->assertSame( '2026-10-20 14:30', Dates::to_site( '2026-10-20 11:00:00' )->format( 'Y-m-d H:i' ) );
		Dates::pin( null, '+03:30' );
		$this->assertSame( '2026-10-20 14:30', Dates::to_site( '2026-10-20 11:00:00' )->format( 'Y-m-d H:i' ), 'a "UTC+3:30" site' );
	}

	public function test_to_site_is_null_for_empty_or_invalid_values(): void {
		foreach ( array( '', '2026-02-30 10:00:00', '2026-10-20', '2026-10-20 11:00', 'now' ) as $value ) {
			$this->assertNull( Dates::to_site( $value ), $value );
		}
	}

	public function test_the_browser_gets_the_site_zone_and_never_reads_one_from_the_request(): void {
		Dates::pin( null, 'Asia/Tehran' );
		$this->assertSame( 'Asia/Tehran', Dates::timezone_name() );
		Dates::pin( null );
		$this->assertSame( 'UTC', Dates::timezone()->getName(), 'without WordPress' );
	}

	public function test_a_default_must_be_in_the_stored_format(): void {
		$this->assertSame( '09:00', $this->field( 'time', array( 'default' => '09:00' ) )->default_value() );
		$this->assertSame( '2026-10-20 11:00:00', $this->field( 'datetime', array( 'default' => '2026-10-20 11:00:00' ) )->default_value() );
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
			'unknown calendar'          => array( 'date', array( 'calendar' => 'hijri' ), '`calendar` must be "auto", "jalali" or "gregorian"' ),
			'a time has no calendar'    => array( 'time', array( 'calendar' => 'jalali' ), 'unknown key(s): calendar' ),
			'a date has no step'        => array( 'date', array( 'step' => 5 ), 'unknown key(s): step' ),
			'min in another format'     => array( 'date', array( 'min' => '2026/10/20' ), '`min` must be a date like 2026-10-20, or "today"' ),
			'min Feb 30'                => array( 'date', array( 'min' => '2026-02-30' ), '`min` must be a date' ),
			'now is for datetimes'      => array( 'date', array( 'max' => 'now' ), '`max` must be a date' ),
			'today is for dates'        => array( 'datetime', array( 'min' => 'today' ), '`min` must be a UTC datetime like 2026-10-20 11:00:00, or "now"' ),
			'a time min of 24:00'       => array( 'time', array( 'min' => '24:00' ), '`min` must be a time like 09:30 (24-hour)' ),
			'min later than max'        => array( 'time', array( 'min' => '18:00', 'max' => '09:00' ), '`min` is later than `max`' ),
			'step that does not divide' => array( 'time', array( 'step' => 7 ), '`step` must be a whole number of minutes that divides an hour' ),
			'step as text'              => array( 'datetime', array( 'step' => '5' ), '`step` must be a whole number' ),
			'step of 0'                 => array( 'time', array( 'step' => 0 ), '`step` must be a whole number' ),
			'min inside validate'       => array( 'date', array( 'validate' => array( 'min' => 3 ) ), 'set `min` on the field, not in `validate`' ),
			'default in Jalali'         => array( 'date', array( 'default' => '28 Mehr 1405' ), '`default` must be a date like 2026-10-20' ),
			'default not text'          => array( 'time', array( 'default' => 930 ), '`default` must be a time like 09:30' ),
			'default without seconds'   => array( 'datetime', array( 'default' => '2026-10-20 11:00' ), '`default` must be a UTC datetime' ),
		);
	}
}
