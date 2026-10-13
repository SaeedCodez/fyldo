<?php
/**
 * Field types `post`, `term` and `user`: config, sanitize against the (stubbed) lookups, validation, search, client export.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Fields\FieldFactory;
use Fyldo\V1\Fields\PostField;
use Fyldo\V1\Fields\TermField;
use Fyldo\V1\Fields\UserField;
use Fyldo\V1\Schema\ConfigException;
use PHPUnit\Framework\TestCase;

/** A post field whose posts come from a table instead of WordPress. */
final class StubbedPostField extends PostField {
	/** @var array<int,array{value:int,label:string,hint:string}> */
	public static $items = array();

	/** @var int[] Posts the current user may not read. */
	public static $unreadable = array();

	/** @var array<int,array{0:string,1:int}> The searches asked for. */
	public static $searches = array();

	protected function query( string $search, int $page ): array {
		self::$searches[] = array( $search, $page );
		$hits             = array_values( array_filter( self::$items, static fn( array $item ): bool => '' === $search || false !== stripos( $item['label'], $search ) ) );

		return array(
			'items' => array_slice( $hits, ( $page - 1 ) * 2, 2 ),
			'more'  => count( $hits ) > $page * 2,
		);
	}

	protected function lookup( array $ids, bool $check ): array {
		$found = array();
		foreach ( $ids as $id ) {
			if ( isset( self::$items[ $id ] ) && ( ! $check || ! in_array( $id, self::$unreadable, true ) ) ) {
				$found[ $id ] = self::$items[ $id ];
			}
		}

		return $found;
	}
}

final class RelationFieldsTest extends TestCase {

	protected function setUp(): void {
		StubbedPostField::$items      = array(
			3  => array( 'value' => 3, 'label' => 'Home', 'hint' => '' ),
			7  => array( 'value' => 7, 'label' => 'About us', 'hint' => '' ),
			9  => array( 'value' => 9, 'label' => 'Contact', 'hint' => '' ),
			12 => array( 'value' => 12, 'label' => 'Shop', 'hint' => '' ),
		);
		StubbedPostField::$unreadable = array();
		StubbedPostField::$searches   = array();
	}

	/**
	 * @param array<string,mixed> $extra Config.
	 */
	private function post( array $extra = array() ): StubbedPostField {
		return new StubbedPostField(
			array_merge(
				array(
					'id'    => 'homepage',
					'type'  => 'post',
					'label' => 'Homepage',
				),
				$extra
			)
		);
	}

	public function test_factory_knows_the_three_types(): void {
		$this->assertInstanceOf( PostField::class, FieldFactory::create( array( 'id' => 'p', 'type' => 'post', 'label' => 'P' ) ) );
		$this->assertInstanceOf( TermField::class, FieldFactory::create( array( 'id' => 't', 'type' => 'term', 'label' => 'T' ) ) );
		$this->assertInstanceOf( UserField::class, FieldFactory::create( array( 'id' => 'u', 'type' => 'user', 'label' => 'U' ) ) );
	}

	public function test_defaults_follow_multiple(): void {
		$this->assertSame( 0, $this->post()->default_value() );
		$this->assertSame( array(), $this->post( array( 'multiple' => true ) )->default_value() );
	}

	public function test_client_export(): void {
		$client = $this->post(
			array(
				'post_type'   => array( 'page', 'post' ),
				'multiple'    => true,
				'placeholder' => 'Select pages…',
				'validate'    => array( 'max' => 3 ),
			)
		)->to_client();

		$this->assertSame( 'post', $client['type'] );
		$this->assertSame( 'field', $client['layout'] );
		$this->assertTrue( $client['multiple'] );
		$this->assertSame( 'Select pages…', $client['placeholder'] );
		$this->assertEquals(
			(object) array(
				'max'      => 3,
				'relation' => true,
			),
			$client['validate']
		);
		// The source and the query stay on the server.
		$this->assertArrayNotHasKey( 'post_type', $client );
		$this->assertArrayNotHasKey( 'query_args', $client );
	}

	public function test_single_value_keeps_one_existing_id(): void {
		$field = $this->post();

		$this->assertSame( 7, $field->sanitize( 7 ) );
		$this->assertSame( 7, $field->sanitize( '7' ) );
		$this->assertSame( 3, $field->sanitize( array( 3, 7 ) ) );
		$this->assertSame( 0, $field->sanitize( 404 ), 'an unknown post is nothing chosen' );
		$this->assertSame( 0, $field->sanitize( 'seven' ) );
		$this->assertSame( 0, $field->sanitize( -7 ) );
		$this->assertSame( 0, $field->sanitize( null ) );
	}

	public function test_multiple_value_keeps_existing_ids_in_pick_order(): void {
		$field = $this->post( array( 'multiple' => true ) );

		$this->assertSame( array( 9, 3, 12 ), $field->sanitize( array( 9, '3', 404, 9, 'x', 12 ) ) );
		$this->assertSame( array( 7 ), $field->sanitize( 7 ) );
		$this->assertSame( array(), $field->sanitize( 'nothing' ) );
	}

	public function test_saving_drops_what_the_user_may_not_read_but_reading_keeps_it(): void {
		StubbedPostField::$unreadable = array( 9 );
		$field                        = $this->post( array( 'multiple' => true ) );

		$this->assertSame( array( 3 ), $field->sanitize( array( 3, 9 ) ), 'a save only keeps readable items' );
		$this->assertSame( array( 3, 9 ), $field->stored_value( array( 3, 9 ) ), 'the stored value does not change with the reader' );
		$this->assertSame( array( array( 'value' => 3, 'label' => 'Home', 'hint' => '' ) ), $field->items( array( 3, 9 ) ), 'the browser only gets readable titles' );
	}

	public function test_deleted_items_drop_out_of_a_stored_value(): void {
		$field = $this->post( array( 'multiple' => true ) );
		unset( StubbedPostField::$items[7] );

		$this->assertSame( array( 3, 12 ), $field->stored_value( array( 3, 7, 12 ) ) );
		$this->assertSame( 0, $this->post()->stored_value( 7 ) );
	}

	public function test_validation(): void {
		$required = $this->post( array( 'validate' => array( 'required' => true ) ) );
		$this->assertSame( 'required', $required->failure( $required->sanitize( 404 ) )['rule'] ?? null );
		$this->assertNull( $required->validate( $required->sanitize( 3 ) ) );

		$limited = $this->post(
			array(
				'multiple' => true,
				'validate' => array(
					'min' => 2,
					'max' => 3,
				),
			)
		);
		$this->assertSame( 'min', $limited->failure( $limited->sanitize( array( 3 ) ) )['rule'] ?? null );
		$this->assertSame( 'max', $limited->failure( $limited->sanitize( array( 3, 7, 9, 12 ) ) )['rule'] ?? null );
		$this->assertNull( $limited->failure( $limited->sanitize( array( 3, 7 ) ) ) );
	}

	public function test_items_keep_the_value_order(): void {
		$this->assertSame( array( 12, 3 ), array_column( $this->post( array( 'multiple' => true ) )->items( array( 12, 404, 3 ) ), 'value' ) );
		$this->assertSame( array(), $this->post()->items( 0 ) );
	}

	public function test_search_pages_and_include(): void {
		$field = $this->post();

		$first = $field->search( '  ', 1 );
		$this->assertSame( array( 3, 7 ), array_column( $first['items'], 'value' ) );
		$this->assertTrue( $first['more'] );
		$this->assertSame( array( '', 1 ), StubbedPostField::$searches[0], 'the words are trimmed' );

		$last = $field->search( '', 2 );
		$this->assertSame( array( 9, 12 ), array_column( $last['items'], 'value' ) );
		$this->assertFalse( $last['more'] );

		$this->assertSame( array( 9 ), array_column( $field->search( 'cont', 1 )['items'], 'value' ) );

		$included = $field->search( 'ignored', 1, array( 12, 3 ) );
		$this->assertSame( array( 12, 3 ), array_column( $included['items'], 'value' ) );
		$this->assertFalse( $included['more'] );
	}

	/**
	 * @return array<string,array{0:array<string,mixed>,1:string}>
	 */
	public function bad_configs(): array {
		return array(
			'multiple not a boolean'   => array( array( 'multiple' => 'yes' ), '`multiple` must be true or false' ),
			'post type not a name'     => array( array( 'post_type' => 'Not A Type' ), '`post_type` must be a name' ),
			'empty post type list'     => array( array( 'post_type' => array() ), '`post_type` cannot be empty' ),
			'query_args not an array'  => array( array( 'query_args' => 'author=3' ), '`query_args` must be an array' ),
			'min without multiple'     => array( array( 'validate' => array( 'min' => 1 ) ), '`min` only applies with `multiple`' ),
			'max not whole'            => array(
				array(
					'multiple' => true,
					'validate' => array( 'max' => 1.5 ),
				),
				'`max` must be a whole number',
			),
			'a text rule'              => array( array( 'validate' => array( 'min_length' => 2 ) ), 'the validation rules it takes are' ),
			'single default not an id' => array( array( 'default' => array( 3 ) ), '`default` must be an ID' ),
			'multi default not ids'    => array(
				array(
					'multiple' => true,
					'default'  => array( 3, 0 ),
				),
				'`default` must be a list of IDs',
			),
			'unknown key'              => array( array( 'options' => array() ), 'unknown key(s): options' ),
		);
	}

	/**
	 * @dataProvider bad_configs
	 *
	 * @param array<string,mixed> $extra   Config.
	 * @param string              $message Part of the expected message.
	 */
	public function test_bad_config_is_rejected( array $extra, string $message ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( $message );

		$this->post( $extra );
	}

	public function test_term_and_user_sources(): void {
		$term = new TermField(
			array(
				'id'       => 'cat',
				'type'     => 'term',
				'label'    => 'Category',
				'taxonomy' => 'product_cat',
			)
		);
		$this->assertSame( 0, $term->default_value() );

		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( 'User field "agent": `role` must be a name' );
		new UserField(
			array(
				'id'    => 'agent',
				'type'  => 'user',
				'label' => 'Agent',
				'role'  => array( 'editor', 42 ),
			)
		);
	}

	public function test_a_group_may_hold_a_relation_field(): void {
		$group = FieldFactory::create(
			array(
				'id'      => 'links',
				'type'    => 'group',
				'label'   => 'Links',
				'addable' => true,
				'fields'  => array(
					array(
						'id'    => 'page',
						'type'  => 'post',
						'label' => 'Page',
					),
				),
			)
		);

		$this->assertSame( 'post', $group->to_client()['fields'][0]['type'] );
	}
}
