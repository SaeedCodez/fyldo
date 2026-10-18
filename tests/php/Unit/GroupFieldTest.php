<?php
/**
 * Field type `group`: a list of items that share the same sub-fields.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Fields\FieldFactory;
use Fyldo\V1\Fields\GroupField;
use Fyldo\V1\Instance;
use Fyldo\V1\Schema\ConfigException;
use PHPUnit\Framework\TestCase;

final class GroupFieldTest extends TestCase {

	protected function setUp(): void {
		$GLOBALS['__fyldo_test_options'] = array();
	}

	protected function tearDown(): void {
		unset( $GLOBALS['__fyldo_test_caps'], $GLOBALS['__fyldo_test_posts'] );
	}

	/** Sub-fields of the header-buttons example: a required label, an icon, a link. */
	private const SUBS = array(
		array(
			'id'       => 'label',
			'type'     => 'text',
			'label'    => 'Label',
			'validate' => array( 'required' => true ),
		),
		array(
			'id'      => 'icon',
			'type'    => 'icon',
			'label'   => 'Icon',
			'default' => 'star',
		),
		array(
			'id'    => 'link',
			'type'  => 'url',
			'label' => 'Link',
		),
	);

	private function group( array $extra = array() ): GroupField {
		$field = FieldFactory::create(
			array_merge(
				array(
					'id'      => 'header_buttons',
					'type'    => 'group',
					'label'   => 'Header buttons',
					'fields'  => self::SUBS,
					'addable' => true,
				),
				$extra
			)
		);
		$this->assertInstanceOf( GroupField::class, $field );

		return $field;
	}

	public function test_the_client_gets_the_sub_fields_and_the_options(): void {
		$client = $this->group( array( 'item_title' => 'label', 'item_icon' => 'icon', 'sortable' => true, 'max' => 5 ) )->to_client();

		$this->assertSame( 'group', $client['type'] );
		$this->assertSame( 'stacked', $client['layout'] );
		$this->assertSame( array(), $client['default'] );
		$this->assertSame( array( 'label', 'icon', 'link' ), array_column( $client['fields'], 'id' ) );
		$this->assertSame( 'url', $client['fields'][2]['type'] );
		$this->assertSame( 'label', $client['item_title'] );
		$this->assertSame( 'icon', $client['item_icon'] );
		$this->assertTrue( $client['sortable'] );
		$this->assertTrue( $client['addable'] );
		$this->assertNull( $client['min'] );
		$this->assertSame( 5, $client['max'] );
		$this->assertSame( '', $client['add_label'] );
		$this->assertEquals( (object) array(), $client['validate'] );
	}

	public function test_default_items_are_completed_with_the_sub_field_defaults(): void {
		$field = $this->group( array( 'default' => array( array( 'label' => ' Docs ' ) ) ) );

		$this->assertSame( array( array( 'label' => 'Docs', 'icon' => 'star', 'link' => '' ) ), $field->default_value() );
	}

	public function test_sanitize_keeps_a_list_of_complete_items_and_drops_everything_else(): void {
		$field = $this->group();
		$value = $field->sanitize(
			array(
				'x' => array(
					'label' => ' Pricing ',
					'evil'  => '<script>',
				),
				'not an item',
				array( 'link' => 'https://example.com/docs' ),
			)
		);

		$this->assertSame(
			array(
				array( 'label' => 'Pricing', 'icon' => 'star', 'link' => '' ),
				array( 'label' => '', 'icon' => 'star', 'link' => 'https://example.com/docs' ),
			),
			$value
		);
		$this->assertSame( array(), $field->sanitize( 'text' ) );
		$this->assertSame( array(), $field->sanitize( null ) );
	}

	public function test_a_fixed_group_keeps_exactly_its_default_items(): void {
		$field = $this->group(
			array(
				'addable' => false,
				'default' => array( array( 'label' => 'A' ), array( 'label' => 'B' ) ),
			)
		);

		$this->assertCount( 2, $field->sanitize( array( array( 'label' => 'X' ), array( 'label' => 'Y' ), array( 'label' => 'Z' ) ) ), 'no item can be added' );
		$this->assertSame( array( 'X', 'B' ), array_column( $field->sanitize( array( array( 'label' => 'X' ) ) ), 'label' ), 'a missing item comes back as declared' );
	}

	public function test_errors_are_keyed_by_item_and_sub_field_and_the_count_waits_for_valid_items(): void {
		$field = $this->group( array( 'min' => 3 ) );

		$this->assertSame(
			array(
				'header_buttons.1.label' => 'This field is required.',
				'header_buttons.1.link'  => 'Enter a valid URL.',
			),
			$field->errors( $field->sanitize( array( array( 'label' => 'A' ), array( 'link' => 'nope' ) ) ) )
		);
		$this->assertSame( array( 'header_buttons' => 'Add at least 3 items.' ), $field->errors( $field->sanitize( array( array( 'label' => 'A' ) ) ) ) );
		$this->assertSame( 'Add at least 3 items.', $field->validate( array() ) );
		$this->assertSame( array(), $field->errors( $field->sanitize( array( array( 'label' => 'A' ), array( 'label' => 'B' ), array( 'label' => 'C' ) ) ) ) );
	}

	public function test_max_and_required_limit_the_number_of_items(): void {
		$max = $this->group( array( 'max' => 1 ) );
		$this->assertSame( array( 'header_buttons' => 'Use no more than 1 item.' ), $max->errors( $max->sanitize( array( array( 'label' => 'A' ), array( 'label' => 'B' ) ) ) ) );

		$required = $this->group( array( 'validate' => array( 'required' => true ) ) );
		$this->assertSame( array( 'header_buttons' => 'This field is required.' ), $required->errors( array() ) );
	}

	public function test_a_developer_callback_checks_the_whole_list_once_the_items_are_valid(): void {
		$field = $this->group(
			array(
				'validate_cb' => static function ( array $items ) {
					return count( array_unique( array_column( $items, 'label' ) ) ) === count( $items ) ? true : 'Each button needs its own label.';
				},
			)
		);

		$this->assertSame( array( 'header_buttons' => 'Each button needs its own label.' ), $field->errors( $field->sanitize( array( array( 'label' => 'A' ), array( 'label' => 'A' ) ) ) ) );
	}

	/**
	 * @dataProvider shared_cases
	 *
	 * @param array<string,mixed> $group  The group's own rules.
	 * @param array<int,mixed>    $items  Raw items.
	 * @param array<string,string> $expect Error key => message.
	 */
	public function test_shared_fixture( array $group, array $items, array $expect ): void {
		$json  = json_decode( (string) file_get_contents( dirname( __DIR__, 2 ) . '/fixtures/validation-cases.json' ), true );
		$extra = array_filter(
			array(
				'min'      => $group['min'] ?? null,
				'max'      => $group['max'] ?? null,
				'validate' => empty( $group['required'] ) ? null : array( 'required' => true ),
			),
			static function ( $v ): bool {
				return null !== $v;
			}
		);
		$field = FieldFactory::create(
			array_merge(
				array(
					'id'      => 'g',
					'type'    => 'group',
					'label'   => 'Group',
					'fields'  => $json['groupFields'],
					'addable' => true,
				),
				$extra
			)
		);

		$this->assertSame( $expect, $field->errors( $field->sanitize( $items ) ) );
	}

	public function shared_cases(): array {
		$json  = json_decode( (string) file_get_contents( dirname( __DIR__, 2 ) . '/fixtures/validation-cases.json' ), true );
		$cases = array();
		foreach ( $json['groups'] as $case ) {
			$cases[ $case['name'] ] = array( (array) $case['group'], (array) $case['items'], (array) $case['expect'] );
		}

		return $cases;
	}

	public function test_a_stored_sub_field_value_that_no_longer_validates_falls_back_on_its_own(): void {
		$field = $this->group( array( 'fields' => array_merge( self::SUBS, array( array( 'id' => 'size', 'type' => 'select', 'label' => 'Size', 'options' => array( 's' => 'Small', 'm' => 'Medium' ), 'default' => 'm' ) ) ) ) );

		$this->assertSame(
			array( array( 'label' => '', 'icon' => 'star', 'link' => '', 'size' => 'm' ) ),
			$field->stored_value( array( array( 'size' => 'xl' ) ) ),
			'the removed option reads as the sub-field default; the empty required label stays (the item is not thrown away)'
		);
	}

	public function test_saving_through_the_instance_reports_sub_field_errors_and_stores_the_list(): void {
		$instance = new Instance( 'acme-groups', array( 'title' => 'Acme' ) );
		$instance->add_page(
			'header',
			array(
				'title'    => 'Header',
				'sections' => array(
					array(
						'id'     => 'buttons',
						'title'  => 'Buttons',
						'fields' => array(
							array(
								'id'      => 'header_buttons',
								'type'    => 'group',
								'label'   => 'Header buttons',
								'fields'  => self::SUBS,
								'addable' => true,
								'max'     => 3,
								'default' => array( array( 'label' => 'Docs' ) ),
							),
						),
					),
				),
			)
		);

		$this->assertSame( array( array( 'label' => 'Docs', 'icon' => 'star', 'link' => '' ) ), $instance->get( 'header', 'header_buttons' ) );

		$invalid = $instance->update( 'header', array( 'header_buttons' => array( array( 'label' => 'A' ), array( 'label' => '' ) ) ) );
		$this->assertSame( 'invalid', $invalid['status'] );
		$this->assertSame( array( 'header_buttons.1.label' => 'This field is required.' ), $invalid['errors'] );

		$ok = $instance->update( 'header', array( 'header_buttons' => array( array( 'label' => 'B', 'link' => 'https://example.com' ), array( 'label' => 'A' ) ) ) );
		$this->assertSame( 'ok', $ok['status'] );
		$this->assertSame( array( 'B', 'A' ), array_column( $instance->get( 'header', 'header_buttons' ), 'label' ), 'stored in the order sent' );
	}

	/** A page of story sections, each picking stories of a post type that is not public (Pelk's `pelk_story`). */
	private function stories_instance(): Instance {
		$GLOBALS['__fyldo_test_posts'] = array(
			4 => new \WP_Post( array( 'ID' => 4, 'post_type' => 'story', 'post_title' => 'Launch' ) ),
			8 => new \WP_Post( array( 'ID' => 8, 'post_type' => 'story', 'post_title' => 'Recap' ) ),
		);

		$instance = new Instance( 'acme-stories', array( 'title' => 'Acme' ) );
		$instance->add_page(
			'sections',
			array(
				'title'    => 'Sections',
				'sections' => array(
					array(
						'id'     => 'main',
						'title'  => 'Sections',
						'fields' => array(
							array(
								'id'      => 'sections',
								'type'    => 'group',
								'label'   => 'Sections',
								'addable' => true,
								'fields'  => array(
									array(
										'id'    => 'title',
										'type'  => 'text',
										'label' => 'Title',
									),
									array(
										'id'        => 'stories',
										'type'      => 'post',
										'label'     => 'Stories',
										'post_type' => 'story',
										'multiple'  => true,
									),
								),
							),
						),
					),
				),
			)
		);

		return $instance;
	}

	public function test_a_relation_sub_field_reads_the_same_for_a_logged_out_visitor(): void {
		$instance                     = $this->stories_instance();
		$GLOBALS['__fyldo_test_caps'] = array( 'manage_options', 'read_post' );
		$saved                        = array( array( 'title' => 'New', 'stories' => array( 8, 4 ) ) );

		$this->assertSame( 'ok', $instance->update( 'sections', array( 'sections' => $saved ) )['status'] );
		$this->assertSame( $saved, $instance->get( 'sections', 'sections' ), 'the admin reads what was saved' );

		$GLOBALS['__fyldo_test_caps'] = array(); // User 0: may read no post of a non-public type.
		$this->assertSame( $saved, $instance->all( 'sections' )['sections'], 'a visitor reads the same IDs' );

		unset( $GLOBALS['__fyldo_test_posts'][4] );
		$this->assertSame( array( array( 'title' => 'New', 'stories' => array( 8 ) ) ), $instance->get( 'sections', 'sections' ), 'a deleted story still drops out' );
	}

	public function test_a_save_still_drops_the_items_the_user_may_not_read(): void {
		$group                        = $this->stories_instance()->page( 'sections' )->fields()['sections'];
		$GLOBALS['__fyldo_test_caps'] = array( 'manage_options' );

		$this->assertSame( array( array( 'title' => 'New', 'stories' => array() ) ), $group->sanitize( array( array( 'title' => 'New', 'stories' => array( 8, 4 ) ) ) ), 'the REST path checks read_post' );
	}

	public function test_a_programmatic_update_with_no_user_keeps_the_relation_items(): void {
		$instance                     = $this->stories_instance();
		$GLOBALS['__fyldo_test_caps'] = array(); // Cron or WP-CLI: no current user.

		$result = $instance->update( 'sections', array( 'sections' => array( array( 'title' => 'Cron', 'stories' => array( 4, 99 ) ) ) ) );

		$this->assertSame( 'ok', $result['status'] );
		$this->assertSame( array( array( 'title' => 'Cron', 'stories' => array( 4 ) ) ), $instance->get( 'sections', 'sections' ), 'kept without a user; a post that does not exist still drops out' );

		$group = $instance->page( 'sections' )->fields()['sections'];
		$this->assertSame( array( array( 'title' => 'Cron', 'stories' => array() ) ), $group->sanitize( array( array( 'title' => 'Cron', 'stories' => array( 4 ) ) ) ), 'the user check is back after update()' );
	}

	/**
	 * @dataProvider invalid_configs
	 *
	 * @param array<string,mixed> $config  Extra config.
	 * @param string              $message Expected fragment of the exception message.
	 */
	public function test_bad_config_fails_loudly( array $config, string $message ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( $message );
		$this->group( $config );
	}

	public function invalid_configs(): array {
		return array(
			'no sub-fields'             => array( array( 'fields' => array() ), '`fields` must be a non-empty list' ),
			'a nested group'            => array( array( 'fields' => array( array( 'id' => 'inner', 'type' => 'group', 'label' => 'Inner' ) ) ), 'cannot be of type "group"' ),
			'an image sub-field'        => array( array( 'fields' => array( array( 'id' => 'logo', 'type' => 'image', 'label' => 'Logo' ) ) ), 'cannot be of type "image"' ),
			'duplicate sub-field ids'   => array( array( 'fields' => array( self::SUBS[0], self::SUBS[0] ) ), 'duplicate sub-field id "label"' ),
			'item_title unknown'        => array( array( 'item_title' => 'title' ), '`item_title` must be the id of one of its sub-fields' ),
			'item_icon not an icon'     => array( array( 'item_icon' => 'label' ), '`item_icon` must be the id of an `icon` sub-field' ),
			'sortable not a bool'       => array( array( 'sortable' => 'yes' ), '`sortable` must be true or false' ),
			'a rule other than required' => array( array( 'validate' => array( 'max' => 3 ) ), 'the only validation rule a group takes is `required`' ),
			'min negative'              => array( array( 'min' => -1 ), '`min` must be a whole number' ),
			'min above max'             => array( array( 'min' => 3, 'max' => 2 ), '`min` is greater than `max`' ),
			'max on a fixed group'      => array( array( 'addable' => false, 'max' => 2, 'default' => array( array() ) ), '`max` only applies when `addable` is true' ),
			'fixed without items'       => array( array( 'addable' => false ), 'needs its items in `default`' ),
			'default not a list'        => array( array( 'default' => array( 'a' => array() ) ), '`default` must be a list of items' ),
			'default item unknown key'  => array( array( 'default' => array( array( 'title' => 'x' ) ) ), 'default item 1 has unknown key(s): title' ),
			'more defaults than max'    => array( array( 'max' => 1, 'default' => array( array(), array() ) ), '`default` has more items than `max`' ),
		);
	}
}
