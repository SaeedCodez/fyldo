<?php
/**
 * `$instance->add_form()`: a field schema whose records the plugin stores. Config, the record store (load, defaults,
 * revision) and the save path (Saver::save_record, the form's hooks).
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Instance;
use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Schema\Form;
use Fyldo\V1\Storage\RecordStore;
use Fyldo\V1\Storage\Saver;
use PHPUnit\Framework\TestCase;

final class FormTest extends TestCase {

	/** @var BookTable */
	private $table;

	/** @var Instance */
	private $instance;

	protected function setUp(): void {
		$GLOBALS['__fyldo_test_options']  = array();
		$GLOBALS['__fyldo_test_fired']    = array();
		$GLOBALS['__fyldo_test_filtered'] = array();
		$GLOBALS['__fyldo_test_wrong']    = array();
		$GLOBALS['__fyldo_test_caps']     = array( 'manage_options' );

		$this->table    = new BookTable();
		$this->instance = new Instance( 'acme-shop', array( 'title' => 'Acme Shop' ) );
		$this->instance->add_form( 'book', $this->table->form() );

		$this->table->rows['b7'] = array(
			'title'   => 'Dune',
			'status'  => 'published',
			'licence' => 'secret-key',
			'source'  => 'import',
			'author'  => 'Frank Herbert', // A column of the plugin's table the form does not show.
		);
	}

	private function form(): Form {
		$form = $this->instance->form( 'book' );
		$this->assertNotNull( $form );

		return $form;
	}

	private function record( string $key ): RecordStore {
		return new RecordStore( $this->form(), $key );
	}

	/** @return array<string,mixed> */
	private function save( string $key, array $values, ?string $revision = null ): array {
		return ( new Saver( $this->instance ) )->save_record( $this->record( $key ), $values, $revision );
	}

	/** The messages reported with _doing_it_wrong(), as the developer reads them (they are escaped for HTML). */
	private static function wrong(): array {
		return array_map( static fn( string $message ): string => html_entity_decode( $message, ENT_QUOTES ), $GLOBALS['__fyldo_test_wrong'] );
	}

	public function test_a_form_is_registered_apart_from_the_pages(): void {
		$this->assertSame( array(), $GLOBALS['__fyldo_test_wrong'] );
		$this->assertSame( array( 'book' ), array_keys( $this->instance->forms() ) );
		$this->assertSame( array( 'title', 'status', 'licence', 'source', 'chapters', 'cover' ), array_keys( $this->form()->fields() ), 'a notice owns no value' );
		$this->assertSame( array( 'book', 'contents' ), array_map( static fn( $section ): string => $section->id(), $this->form()->sections() ) );
		$this->assertNull( $this->instance->form( 'nope' ) );
		$this->assertSame( array(), $this->instance->pages() );

		// Forms have ids of their own: a page may be called "book" too.
		$this->instance->add_page( 'book', array( 'title' => 'Book', 'sections' => array( array( 'id' => 's', 'title' => 'S', 'fields' => array() ) ) ) );
		$this->assertSame( array(), $GLOBALS['__fyldo_test_wrong'] );
		$this->assertNotNull( $this->instance->page( 'book' ) );
	}

	public function test_the_browser_gets_the_sections_as_a_page_has_them_and_no_values(): void {
		$client = $this->form()->to_client();

		$this->assertSame( array( 'id', 'sections' ), array_keys( $client ) );
		$this->assertSame( 'book', $client['id'] );
		$this->assertSame( wp_json_encode( array_map( static fn( $section ): array => $section->to_client(), $this->form()->sections() ) ), wp_json_encode( $client['sections'] ) );
	}

	public function test_the_client_config_lists_the_forms_the_user_may_open(): void {
		$this->instance->add_form( 'author', $this->table->form( array( 'capability' => 'edit_posts' ) ) );

		$this->assertSame( array( 'book' ), array_column( \Fyldo\V1\Assets\ClientConfig::build( $this->instance )['forms'], 'id' ) );

		$GLOBALS['__fyldo_test_caps'] = array( 'manage_options', 'edit_posts' );
		$forms                        = \Fyldo\V1\Assets\ClientConfig::build( $this->instance )['forms'];
		$this->assertSame( array( 'book', 'author' ), array_column( $forms, 'id' ) );
		$this->assertSame( wp_json_encode( $this->form()->to_client() ), wp_json_encode( $forms[0] ) );
	}

	public function test_capability_is_the_form_override_else_the_instance_default(): void {
		$this->instance->add_form( 'author', $this->table->form( array( 'capability' => 'edit_posts' ) ) );

		$this->assertSame( 'manage_options', $this->instance->capability_for( $this->form() ) );
		$this->assertSame( 'edit_posts', $this->instance->capability_for( $this->instance->form( 'author' ) ) );
	}

	public function test_a_duplicate_or_broken_form_is_reported_and_skipped(): void {
		$this->instance->add_form( 'book', $this->table->form() );
		$this->instance->add_form( 'author', array( 'sections' => array() ) );

		$this->assertSame( array( 'book' ), array_keys( $this->instance->forms() ) );
		$this->assertCount( 2, $GLOBALS['__fyldo_test_wrong'] );
		$this->assertStringContainsString( 'Fyldo "acme-shop": Form "book" is already registered.', self::wrong()[0] );
		$this->assertStringContainsString( 'Form "author" needs `load`', self::wrong()[1] );
	}

	/**
	 * @dataProvider invalid
	 */
	public function test_config_errors( array $overrides, string $needle, string $id = 'book' ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessageMatches( '/' . preg_quote( $needle, '/' ) . '/i' );

		$config = array_merge( ( new BookTable() )->form(), $overrides );
		foreach ( array_keys( $overrides, null, true ) as $key ) {
			unset( $config[ $key ] );
		}

		new Form( 'acme-shop', $id, $config );
	}

	public function invalid(): array {
		$field = static fn( string $id ): array => array( 'id' => $id, 'type' => 'text', 'label' => 'X' );

		return array(
			'bad id'             => array( array(), 'Form id "Bad Id" is invalid', 'Bad Id' ),
			'unknown key'        => array( array( 'option_name' => 'x' ), 'Form "book" has unknown key(s): option_name' ),
			'no load'            => array( array( 'load' => null ), 'Form "book" needs `load`' ),
			'load not callable'  => array( array( 'load' => 'no_such_function' ), 'needs `load`' ),
			'no save'            => array( array( 'save' => null ), 'Form "book" needs `save`' ),
			'save not callable'  => array( array( 'save' => array( 1, 2 ) ), 'needs `save`' ),
			'no sections'        => array( array( 'sections' => array() ), 'Form "book" needs at least one section' ),
			'a tab'              => array( array( 'sections' => array( array( 'id' => 'a', 'tab' => 'main', 'title' => 'A', 'fields' => array() ) ) ), 'section "a" has a `tab`; a form has no tabs' ),
			'a danger section'   => array( array( 'sections' => array( array( 'id' => 'a', 'title' => 'A', 'tone' => 'danger', 'action' => array( 'id' => 'reset' ) ) ) ), 'section "a" is a danger section' ),
			'an action'          => array( array( 'sections' => array( array( 'id' => 'a', 'title' => 'A', 'action' => array( 'id' => 'reset' ) ) ) ), 'a form has none' ),
			'duplicate section'  => array( array( 'sections' => array( array( 'id' => 'a', 'title' => 'A' ), array( 'id' => 'a', 'title' => 'B' ) ) ), 'Form "book": duplicate section id "a"' ),
			'duplicate field'    => array( array( 'sections' => array( array( 'id' => 'a', 'title' => 'A', 'fields' => array( $field( 'x' ), $field( 'x' ) ) ) ) ), 'Form "book": duplicate field id "x" (field ids are the storage keys and must be unique per form)' ),
			'a bad field'        => array( array( 'sections' => array( array( 'id' => 'a', 'title' => 'A', 'fields' => array( array( 'id' => 'x', 'type' => 'nope' ) ) ) ) ), 'Unknown field type "nope"' ),
			'default_before'     => array( array( 'sections' => array( array( 'id' => 'a', 'title' => 'A', 'fields' => array( $field( 'x' ) + array( 'default_before' => array( '2.0.0' => 'old' ) ) ) ) ) ), '`default_before` is for settings pages' ),
		);
	}

	public function test_a_record_reads_its_values_with_defaults_and_unknown_or_invalid_values_dropped(): void {
		$this->table->rows['b7']['status'] = 'archived'; // An option the form no longer offers.
		$record                            = $this->record( 'b7' );
		$schema                            = $this->form()->schema();

		$this->assertFalse( $record->missing() );
		$this->assertSame(
			array( 'title' => 'Dune', 'status' => 'draft', 'licence' => 'secret-key', 'source' => 'import', 'chapters' => array(), 'cover' => 0 ),
			$record->values( $schema )
		);
		$this->assertNull( $record->client_values( $schema )['licence'], 'a write-only value is never sent' );
		$this->assertSame( array( 'cover' => null ), $record->client_media( $schema ) );
		$this->assertSame( array( 'b7' ), $this->table->loads, '`load` runs once per store' );
	}

	public function test_the_revision_is_the_md5_of_the_sorted_raw_record_and_a_new_record_has_none(): void {
		$raw = $this->table->rows['b7'];
		ksort( $raw );

		$this->assertSame( md5( (string) wp_json_encode( $raw ) ), $this->record( 'b7' )->revision( $this->form()->schema() ) );
		$this->assertSame( '', $this->record( '' )->revision( $this->form()->schema() ) );

		$this->table->rows['b7']['author'] = 'Someone else';
		$this->assertNotSame( md5( (string) wp_json_encode( $raw ) ), $this->record( 'b7' )->revision( $this->form()->schema() ), 'any column counts' );
	}

	public function test_a_new_record_reads_the_defaults_without_asking_load(): void {
		$record = $this->record( '' );

		$this->assertTrue( $record->is_new() );
		$this->assertFalse( $record->missing() );
		$this->assertSame( 'draft', $record->values( $this->form()->schema() )['status'] );
		$this->assertSame( array(), $this->table->loads );
	}

	public function test_a_key_load_finds_nothing_for_is_missing(): void {
		$this->assertTrue( $this->record( 'b404' )->missing() );
		$this->assertSame( array(), $this->record( 'b404' )->raw( $this->form()->schema() ) );
	}

	public function test_save_gets_the_complete_record_with_the_changes_on_top(): void {
		$result = $this->save( 'b7', array( 'title' => '  Dune Messiah ', 'licence' => null, 'source' => 'hacked', 'evil' => 'x' ) );

		$this->assertSame( 'ok', $result['status'] );
		$this->assertSame( 'b7', $result['key'] );
		$this->assertNull( $result['error'] );
		$this->assertSame(
			array(
				array(
					// Every field, in order; a write-only `null` keeps the stored value; a disabled field cannot change.
					array( 'title' => 'Dune Messiah', 'status' => 'published', 'licence' => 'secret-key', 'source' => 'import', 'chapters' => array(), 'cover' => 0 ),
					'b7',
				),
			),
			$this->table->saves
		);
		$this->assertSame( 'Dune Messiah', $result['values']['title'] );
		$this->assertNull( $result['values']['licence'] );
	}

	public function test_the_result_reads_the_saved_record_again(): void {
		$result = $this->save( 'b7', array( 'title' => 'Children of Dune' ) );
		$raw    = $this->table->rows['b7'];
		ksort( $raw );

		$this->assertSame( md5( (string) wp_json_encode( $raw ) ), $result['revision'], 'what the next request will see' );
		$this->assertSame( array( 'b7', 'b7' ), $this->table->loads );
	}

	public function test_a_new_record_gets_the_key_save_returns(): void {
		$result = $this->save( '', array( 'title' => 'Hyperion', 'chapters' => array( array( 'name' => 'The Priest' ) ) ) );

		$this->assertSame( 'ok', $result['status'] );
		$this->assertSame( 'b1', $result['key'] );
		$this->assertSame( '', $this->table->saves[0][1] );
		$this->assertSame( array( 'title' => 'Hyperion', 'status' => 'draft', 'licence' => '', 'source' => 'manual', 'chapters' => array( array( 'name' => 'The Priest' ) ), 'cover' => 0 ), $this->table->saves[0][0], 'defaults filled' );
		$this->assertSame( 'Hyperion', $result['values']['title'] );
		$this->assertNotSame( '', $result['revision'] );
	}

	public function test_a_new_record_ignores_the_revision(): void {
		$this->assertSame( 'ok', $this->save( '', array( 'title' => 'Hyperion' ), 'whatever' )['status'] );
	}

	public function test_invalid_values_block_the_save_and_report_per_field_like_a_page(): void {
		$result = $this->save( 'b7', array( 'title' => '', 'status' => 'archived', 'chapters' => array( array( 'name' => '' ) ) ) );

		$this->assertSame( 'invalid', $result['status'] );
		$this->assertSame( array( 'title', 'status', 'chapters.0.name' ), array_keys( $result['errors'] ) );
		$this->assertSame( array(), $this->table->saves );
		$this->assertSame( 'Dune', $result['values']['title'] );
	}

	public function test_a_stale_revision_is_a_conflict_and_nothing_is_saved(): void {
		$revision = $this->record( 'b7' )->revision( $this->form()->schema() );
		$this->assertSame( 'ok', $this->save( 'b7', array( 'title' => 'A' ), $revision )['status'] );

		$stale = $this->save( 'b7', array( 'title' => 'B' ), $revision );
		$this->assertSame( 'conflict', $stale['status'] );
		$this->assertSame( 'A', $stale['values']['title'] );
		$this->assertNotSame( $revision, $stale['revision'] );
		$this->assertCount( 1, $this->table->saves );

		$this->assertSame( 'ok', $this->save( 'b7', array( 'title' => 'C' ) )['status'], 'no revision: no check' );
	}

	public function test_a_missing_record_is_not_found_and_save_is_not_called(): void {
		$this->assertSame( 'not_found', $this->save( 'b404', array( 'title' => 'X' ) )['status'] );
		$this->assertSame( array(), $this->table->saves );
	}

	public function test_a_wp_error_from_save_aborts_and_is_passed_on(): void {
		$error               = new \WP_Error( 'acme_locked', 'This book is locked.', array( 'status' => 423 ) );
		$this->table->answer( $error );

		$result = $this->save( 'b7', array( 'title' => 'X' ) );

		$this->assertSame( 'error', $result['status'] );
		$this->assertSame( $error, $result['error'] );
		$this->assertSame( 'b7', $result['key'] );
		$this->assertSame( 'Dune', $result['values']['title'], 'nothing changed' );
		$this->assertNotContains( 'fyldo/acme-shop/form/book/saved', array_column( $GLOBALS['__fyldo_test_fired'], 0 ) );
	}

	public function test_an_auto_increment_id_is_a_key(): void {
		$this->table->answer( 42 );

		$this->assertSame( '42', $this->save( '', array( 'title' => 'X' ) )['key'] );
	}

	/**
	 * @dataProvider bad_keys
	 * @param mixed $answer What `save` returns.
	 */
	public function test_save_must_return_a_key_or_a_wp_error( $answer ): void {
		$this->table->answer( $answer );

		$result = $this->save( '', array( 'title' => 'X' ) );

		$this->assertSame( 'error', $result['status'] );
		$this->assertSame( 'fyldo_save_failed', $result['error']->get_error_code() );
		$this->assertSame( 500, $result['error']->get_error_data()['status'] );
		$this->assertStringContainsString( 'Form "book": `save` must return the record key', self::wrong()[0] );
	}

	public function bad_keys(): array {
		return array(
			'nothing'       => array( null ),
			'false'         => array( false ),
			'empty'         => array( '' ),
			'zero'          => array( 0 ),
			'"new"'         => array( 'new' ),
			'a space'       => array( 'b 1' ),
			'too long'      => array( str_repeat( 'x', 65 ) ),
			'a whole array' => array( array( 'id' => 3 ) ),
		);
	}

	public function test_the_form_hooks_fire_and_the_page_hooks_do_not(): void {
		$this->save( '', array( 'title' => 'Hyperion' ) );

		$this->assertSame( array( 'fyldo/acme-shop/form/book/sanitize', 'fyldo/acme-shop/form/book/validate' ), $GLOBALS['__fyldo_test_filtered'] );
		$this->assertSame( array( 'fyldo/acme-shop/form/book/saved' ), array_column( $GLOBALS['__fyldo_test_fired'], 0 ) );

		$saved = $GLOBALS['__fyldo_test_fired'][0];
		$this->assertSame( 'b1', $saved[1], 'the new key' );
		$this->assertSame( 'Hyperion', $saved[2]['title'] );
		$this->assertSame( array(), $saved[3], 'nothing was stored before' );

		$GLOBALS['__fyldo_test_fired'] = array();
		$this->save( 'b7', array( 'title' => 'Dune Messiah' ) );
		$this->assertSame( 'b7', $GLOBALS['__fyldo_test_fired'][0][1] );
		$this->assertSame( 'Frank Herbert', $GLOBALS['__fyldo_test_fired'][0][3]['author'], '$stored is what `load` returned' );
	}
}
