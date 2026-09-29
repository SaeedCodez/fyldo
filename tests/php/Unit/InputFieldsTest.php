<?php
/**
 * Milestone 2 part 3: number, password, notice, URL/email digits, disabled reasons, the callbacks and the full
 * declarative vocabulary as the field layer sees it.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Fields\FieldFactory;
use Fyldo\V1\Instance;
use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Schema\Page;
use PHPUnit\Framework\TestCase;

final class InputFieldsTest extends TestCase {

	protected function setUp(): void {
		$GLOBALS['__fyldo_test_options']  = array();
		$GLOBALS['__fyldo_test_autoload'] = array();
		$GLOBALS['__fyldo_test_wrong']    = array();
	}

	private function field( string $type, array $extra = array() ) {
		return FieldFactory::create( array_merge( array( 'id' => 'f', 'type' => $type, 'label' => 'Label' ), $extra ) );
	}

	private function instance( array $fields ): Instance {
		$instance = new Instance( 'acme-seo', array( 'title' => 'Acme SEO' ) );
		$instance->add_page(
			'general',
			array(
				'title'    => 'General',
				'sections' => array(
					array(
						'id'     => 'main',
						'title'  => 'Main',
						'fields' => $fields,
					),
				),
			)
		);

		return $instance;
	}

	// Number ----------------------------------------------------------------------------------------------

	public function test_number_exports_its_rules_so_the_browser_mirrors_them(): void {
		$field = $this->field( 'number', array( 'validate' => array( 'min' => 0, 'max' => 100, 'step' => 5 ), 'default' => 10 ) );

		$client = $field->to_client();

		$this->assertSame( 'number', $client['type'] );
		$this->assertSame( 10, $client['default'] );
		$this->assertEquals( (object) array( 'min' => 0, 'max' => 100, 'step' => 5, 'number' => true ), $client['validate'] );
	}

	public function test_number_validates_min_max_and_step_after_reading_persian_digits(): void {
		$field = $this->field( 'number', array( 'validate' => array( 'min' => 0, 'max' => 100, 'step' => 5 ) ) );

		$this->assertNull( $field->validate( $field->sanitize( '۵۰' ) ) );
		$this->assertSame( 'Enter a value of at most 100.', $field->validate( $field->sanitize( '۱۰۵' ) ) );
		$this->assertSame( 'Enter a value of at least 0.', $field->validate( $field->sanitize( '-5' ) ) );
		$this->assertSame( 'Enter a value in steps of 5.', $field->validate( $field->sanitize( '٤٢' ) ) );
		$this->assertSame( 'Enter a number.', $field->validate( $field->sanitize( 'abc' ) ) );
		$this->assertNull( $field->validate( $field->sanitize( '' ) ), 'Optional and empty.' );
	}

	public function test_number_saves_as_a_number_and_an_empty_value_as_nothing(): void {
		$instance = $this->instance( array( array( 'id' => 'per_page', 'type' => 'number', 'label' => 'Per page', 'validate' => array( 'min' => 1 ) ) ) );

		$this->assertSame( '', $instance->get( 'general', 'per_page' ) );

		$result = $instance->update( 'general', array( 'per_page' => '۲۵' ) );
		$this->assertSame( 'ok', $result['status'] );
		$this->assertSame( 25, $instance->get( 'general', 'per_page' ) );

		$result = $instance->update( 'general', array( 'per_page' => '0' ) );
		$this->assertSame( 'invalid', $result['status'] );
		$this->assertSame( 'Enter a value of at least 1.', $result['errors']['per_page'] );
		$this->assertSame( 25, $instance->get( 'general', 'per_page' ), 'A rejected value is not stored.' );
	}

	public function test_number_registration_mistakes_are_reported(): void {
		foreach (
			array(
				'step 0'        => array( 'validate' => array( 'step' => 0 ) ),
				'negative step' => array( 'validate' => array( 'step' => -1 ) ),
				'text step'     => array( 'validate' => array( 'step' => '5' ) ),
				'min > max'     => array( 'validate' => array( 'min' => 10, 'max' => 1 ) ),
				'text min'      => array( 'validate' => array( 'min' => 'a' ) ),
				'bad default'   => array( 'default' => 'abc' ),
			) as $label => $extra
		) {
			try {
				$this->field( 'number', $extra );
				$this->fail( "Expected a ConfigException for: $label" );
			} catch ( ConfigException $e ) {
				$this->assertNotSame( '', $e->getMessage(), $label );
			}
		}
	}

	// Password --------------------------------------------------------------------------------------------

	public function test_password_is_write_only_null_keeps_empty_clears_text_replaces(): void {
		$instance = $this->instance( array( array( 'id' => 'api_key', 'type' => 'password', 'label' => 'API key' ), array( 'id' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$page     = $instance->page( 'general' );
		$store    = $instance->store();

		$this->assertSame( array( 'api_key' => '', 'name' => '' ), $store->client_values( $page ), 'Nothing set yet.' );

		$this->assertSame( 'ok', $instance->update( 'general', array( 'api_key' => ' s3cr3t ' ) )['status'] );
		$this->assertSame( ' s3cr3t ', $instance->get( 'general', 'api_key' ), 'Stored exactly as typed: never trimmed.' );
		$this->assertSame( array( 'api_key' => null, 'name' => '' ), $store->client_values( $page ), 'The browser learns only that one is set.' );

		$instance->update( 'general', array( 'api_key' => null, 'name' => 'Acme' ) );
		$this->assertSame( ' s3cr3t ', $instance->get( 'general', 'api_key' ), 'null keeps the stored secret.' );

		$instance->update( 'general', array( 'api_key' => '' ) );
		$this->assertSame( '', $instance->get( 'general', 'api_key' ), 'An empty string clears it.' );
		$this->assertSame( 'Acme', $instance->get( 'general', 'name' ) );
	}

	public function test_a_password_never_appears_in_what_php_sends_to_the_browser(): void {
		$instance = $this->instance( array( array( 'id' => 'api_key', 'type' => 'password', 'label' => 'API key' ) ) );
		$instance->update( 'general', array( 'api_key' => 'top-secret-value' ) );

		$page = $instance->page( 'general' );
		$json = (string) wp_json_encode( $page->to_client( $instance->store()->client_values( $page ), 'rev' ) );
		$this->assertStringNotContainsString( 'top-secret-value', $json );

		$result = $instance->update( 'general', array( 'api_key' => 'another-secret' ) );
		$this->assertStringNotContainsString( 'another-secret', (string) wp_json_encode( $result ) );
	}

	public function test_password_rules_apply_to_a_new_value_only(): void {
		$instance = $this->instance( array( array( 'id' => 'api_key', 'type' => 'password', 'label' => 'API key', 'validate' => array( 'required' => true, 'min_length' => 8 ) ) ) );

		$this->assertSame( 'invalid', $instance->update( 'general', array( 'api_key' => 'short' ) )['status'] );
		$this->assertSame( 'invalid', $instance->update( 'general', array( 'api_key' => '' ) )['status'], 'Clearing a required secret is an error.' );
		$this->assertSame( 'ok', $instance->update( 'general', array( 'api_key' => 'long-enough-1' ) )['status'] );
		$this->assertSame( 'ok', $instance->update( 'general', array( 'api_key' => null ) )['status'], 'Keeping it is always fine.' );
	}

	public function test_password_autocomplete_defaults_to_new_password(): void {
		$this->assertSame( 'new-password', $this->field( 'password' )->to_client()['autocomplete'] );
		$this->assertSame( 'off', $this->field( 'password', array( 'autocomplete' => 'off' ) )->to_client()['autocomplete'] );
		$this->assertSame( 'current-password', $this->field( 'password', array( 'autocomplete' => 'current-password' ) )->to_client()['autocomplete'] );
	}

	public function test_password_registration_mistakes_are_reported(): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessageMatches( '/write-only/' );
		$this->field( 'password', array( 'default' => 'x' ) );
	}

	public function test_password_rejects_an_unknown_autocomplete_token(): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessageMatches( '/autocomplete/' );
		$this->field( 'password', array( 'autocomplete' => 'username' ) );
	}

	// Notice ----------------------------------------------------------------------------------------------

	public function test_a_notice_stores_nothing_and_never_reaches_the_client_values(): void {
		$instance = $this->instance(
			array(
				array( 'id' => 'heads_up', 'type' => 'notice', 'tone' => 'amber', 'label' => 'Heads up', 'description' => 'Changes apply after a cache flush.' ),
				array( 'id' => 'name', 'type' => 'text', 'label' => 'Name' ),
			)
		);
		$page = $instance->page( 'general' );

		$this->assertSame( array( 'name' ), array_keys( $page->fields() ) );
		$this->assertSame( array( 'name' => '' ), $instance->all( 'general' ) );
		$this->assertSame( array( 'name' => '' ), $instance->store()->client_values( $page ) );

		// Even a request that names it is ignored: it is neither stored nor an error.
		$result = $instance->update( 'general', array( 'heads_up' => 'hijack', 'name' => 'Acme' ) );
		$this->assertSame( 'ok', $result['status'] );
		$this->assertSame( array( 'name' => 'Acme' ), $GLOBALS['__fyldo_test_options']['acme-seo_general'] );
	}

	public function test_a_notice_is_described_to_the_browser_by_tone_title_and_message_only(): void {
		$field = $this->field( 'notice', array( 'tone' => 'red', 'label' => 'Careful', 'description' => 'This is destructive.' ) );

		$this->assertSame(
			array( 'id' => 'f', 'type' => 'notice', 'label' => 'Careful', 'description' => 'This is destructive.', 'tone' => 'red' ),
			$field->to_client()
		);
		$this->assertFalse( $field->is_stored() );
	}

	public function test_a_notice_title_is_optional_and_every_tone_is_accepted(): void {
		foreach ( array( 'gray', 'blue', 'green', 'amber', 'red' ) as $tone ) {
			$field = $this->field( 'notice', array( 'tone' => $tone, 'label' => '', 'description' => 'Message.' ) );
			$this->assertSame( $tone, $field->to_client()['tone'] );
		}

		$this->assertSame( 'gray', $this->field( 'notice', array( 'label' => '', 'description' => 'Message.' ) )->to_client()['tone'] );
	}

	/**
	 * @dataProvider notice_mistakes
	 */
	public function test_notice_registration_mistakes_are_reported( array $extra, string $needle ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessageMatches( '/' . preg_quote( $needle, '/' ) . '/i' );

		$this->field( 'notice', array_merge( array( 'description' => 'Message.' ), $extra ) );
	}

	public function notice_mistakes(): array {
		return array(
			'no message'           => array( array( 'description' => ' ' ), 'description' ),
			'unknown tone'         => array( array( 'tone' => 'purple' ), 'tone' ),
			'nothing to validate'  => array( array( 'validate' => array( 'required' => true ) ), 'unknown key' ),
			'no value to disable'  => array( array( 'disabled' => true ), 'unknown key' ),
			'no default'           => array( array( 'default' => 'x' ), 'unknown key' ),
			'no callbacks'         => array( array( 'validate_cb' => 'is_string' ), 'unknown key' ),
		);
	}

	public function test_a_notice_id_is_still_unique_on_the_page(): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessageMatches( '/duplicate field id/' );

		new Page(
			'acme-seo',
			'general',
			array(
				'title'    => 'General',
				'sections' => array(
					array(
						'id'     => 'main',
						'title'  => 'Main',
						'fields' => array(
							array( 'id' => 'same', 'type' => 'notice', 'description' => 'One.' ),
							array( 'id' => 'same', 'type' => 'text', 'label' => 'Two' ),
						),
					),
				),
			)
		);
	}

	// URL and email digits --------------------------------------------------------------------------------

	public function test_url_and_email_read_persian_digits_but_text_keeps_them(): void {
		$this->assertSame( 'https://example.com/۱۲', $this->field( 'text' )->sanitize( 'https://example.com/۱۲' ) );
		$this->assertSame( 'https://example.com/12', $this->field( 'url' )->sanitize( 'https://example.com/۱۲' ) );
		$this->assertSame( 'a12@example.com', $this->field( 'email' )->sanitize( 'a۱۲@example.com' ) );
		$this->assertNull( $this->field( 'url' )->validate( $this->field( 'url' )->sanitize( 'https://۱۲۳.example.com:۸۰' ) ) );
	}

	// Disabled with a reason ------------------------------------------------------------------------------

	public function test_a_disabled_reason_is_trimmed_and_an_empty_one_is_just_disabled(): void {
		$this->assertSame( 'Set in wp-config.php', $this->field( 'text', array( 'disabled' => '  Set in wp-config.php ' ) )->to_client()['disabled'] );
		$this->assertTrue( $this->field( 'text', array( 'disabled' => '   ' ) )->to_client()['disabled'] );
		$this->assertTrue( $this->field( 'text', array( 'disabled' => true ) )->to_client()['disabled'] );
		$this->assertFalse( $this->field( 'text' )->to_client()['disabled'] );
	}

	public function test_a_disabled_field_cannot_be_changed_by_a_request(): void {
		$instance = $this->instance(
			array(
				array( 'id' => 'locked', 'type' => 'text', 'label' => 'Locked', 'default' => 'fixed', 'disabled' => 'Managed by the host.' ),
				array( 'id' => 'secret', 'type' => 'password', 'label' => 'Secret', 'disabled' => true ),
				array( 'id' => 'amount', 'type' => 'number', 'label' => 'Amount', 'default' => 3, 'disabled' => 'Pro only.' ),
			)
		);

		$result = $instance->update( 'general', array( 'locked' => 'hacked', 'secret' => 'hacked', 'amount' => 99 ) );

		$this->assertSame( 'ok', $result['status'] );
		$this->assertSame( 'fixed', $instance->get( 'general', 'locked' ) );
		$this->assertSame( '', $instance->get( 'general', 'secret' ) );
		$this->assertSame( 3, $instance->get( 'general', 'amount' ) );
	}

	// Callbacks -------------------------------------------------------------------------------------------

	public function test_sanitize_cb_runs_after_the_type_sanitizer_and_before_validation(): void {
		$order = array();
		$field = $this->field(
			'number',
			array(
				'validate'    => array( 'max' => 10 ),
				'sanitize_cb' => static function ( $value ) use ( &$order ) {
					$order[] = 'sanitize:' . gettype( $value );
					return is_int( $value ) ? $value * 2 : $value;
				},
				'validate_cb' => static function ( $value ) use ( &$order ) {
					$order[] = 'validate:' . $value;
					return true;
				},
			)
		);

		$value = $field->sanitize( '۴' );
		$this->assertSame( 8, $value, 'The callback receives the number the type sanitizer produced.' );
		$this->assertNull( $field->validate( $value ) );
		$this->assertSame( 'Enter a value of at most 10.', $field->validate( $field->sanitize( '٦' ) ), 'The declarative rules see the callback output.' );
		$this->assertSame( array( 'sanitize:integer', 'validate:8', 'sanitize:integer' ), $order, 'validate_cb does not run once a declarative rule failed.' );
	}

	public function test_validate_cb_may_return_a_message_false_or_true(): void {
		$message = $this->field( 'text', array( 'validate_cb' => static function () {
			return 'Nope.';
		} ) );
		$false   = $this->field( 'text', array( 'validate_cb' => static function () {
			return false;
		} ) );
		$true    = $this->field( 'text', array( 'validate_cb' => static function () {
			return true;
		} ) );

		$this->assertSame( 'Nope.', $message->validate( 'x' ) );
		$this->assertSame( 'This value is not valid.', $false->validate( 'x' ) );
		$this->assertNull( $true->validate( 'x' ) );
	}

	public function test_a_validate_cb_message_becomes_the_422_error_of_that_field(): void {
		$instance = $this->instance(
			array(
				array(
					'id'          => 'site_url',
					'type'        => 'url',
					'label'       => 'Site URL',
					'validate_cb' => static function ( $value ) {
						return false !== strpos( (string) $value, 'blocked' ) ? 'This host is blocked.' : true;
					},
				),
			)
		);

		$result = $instance->update( 'general', array( 'site_url' => 'https://blocked.example.com' ) );

		$this->assertSame( 'invalid', $result['status'] );
		$this->assertSame( array( 'site_url' => 'This host is blocked.' ), $result['errors'] );
	}

	// Vocabulary registration ----------------------------------------------------------------------------

	/**
	 * @dataProvider malformed_rules
	 */
	public function test_malformed_rule_parameters_fail_at_registration( array $rules, string $needle ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessageMatches( '/' . preg_quote( $needle, '/' ) . '/' );

		$this->field( 'text', array( 'validate' => $rules ) );
	}

	public function malformed_rules(): array {
		return array(
			'negative max_length' => array( array( 'max_length' => -1 ), 'max_length' ),
			'text min_length'     => array( array( 'min_length' => '3' ), 'min_length' ),
			'bad pattern'         => array( array( 'pattern' => '(' ), 'pattern' ),
			'empty pattern'       => array( array( 'pattern' => '' ), 'pattern' ),
			'no schemes'          => array( array( 'schemes' => array() ), 'schemes' ),
			'schemes not a list'  => array( array( 'schemes' => 'https' ), 'schemes' ),
			'allowed not a list'  => array( array( 'allowed' => 'a' ), 'allowed' ),
		);
	}

	public function test_every_declarative_rule_reaches_the_client_unchanged(): void {
		$rules = array(
			'required'   => true,
			'min_length' => 2,
			'max_length' => 9,
			'pattern'    => '^[a-z]+$',
			'schemes'    => array( 'https' ),
			'allowed'    => array( 'a', 'b' ),
			'min'        => 1,
			'max'        => 5,
			'step'       => 2,
		);

		$this->assertEquals( (object) $rules, $this->field( 'text', array( 'validate' => $rules ) )->to_client()['validate'] );
	}
}
