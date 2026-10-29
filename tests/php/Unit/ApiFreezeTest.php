<?php
/**
 * The API freeze (PHP): unique option names, the page hook names, bounds as field keys, what update() and reset()
 * return, and the registration checks.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Assets\ClientConfig;
use Fyldo\V1\Fields\FieldFactory;
use Fyldo\V1\Fyldo;
use Fyldo\V1\Instance;
use Fyldo\V1\Schema\ConfigException;
use PHPUnit\Framework\TestCase;

final class ApiFreezeTest extends TestCase {

	protected function setUp(): void {
		$this->reset_facade();
		$GLOBALS['__fyldo_test_options']  = array();
		$GLOBALS['__fyldo_test_autoload'] = array();
		$GLOBALS['__fyldo_test_fired']    = array();
		$GLOBALS['__fyldo_test_filtered'] = array();
		$GLOBALS['__fyldo_test_wrong']    = array();
		$GLOBALS['__fyldo_test_caps']     = array( 'manage_options' );
	}

	protected function tearDown(): void {
		$this->reset_facade();
	}

	/**
	 * @param array<int,array<string,mixed>> $fields Fields of the page's one section.
	 * @param array<string,mixed>            $extra  More page config.
	 * @return array<string,mixed>
	 */
	private static function page( array $fields = array(), array $extra = array() ): array {
		return array_merge(
			array(
				'title'    => 'General',
				'sections' => array(
					array(
						'id'     => 'main',
						'title'  => 'Main',
						'fields' => array() === $fields ? array( array( 'id' => 'a', 'type' => 'text', 'label' => 'A' ) ) : $fields,
					),
				),
			),
			$extra
		);
	}

	/** A reported mistake as text (the stub escapes quotes like esc_html() does). */
	private function wrong( int $index ): string {
		return html_entity_decode( (string) $GLOBALS['__fyldo_test_wrong'][ $index ], ENT_QUOTES );
	}

	private function reset_facade(): void {
		$reflection = new \ReflectionClass( Fyldo::class );
		$property   = $reflection->getProperty( 'instances' );
		$property->setAccessible( true );
		$property->setValue( null, array() );
	}

	/* An option name belongs to one page. */

	public function test_two_pages_of_one_instance_cannot_share_an_option(): void {
		$instance = Fyldo::create( 'freeze-one', array( 'title' => 'One' ) );
		$instance->add_page( 'general', self::page( array(), array( 'option_name' => 'shared_settings' ) ) );
		$instance->add_page( 'extra', self::page( array(), array( 'option_name' => 'shared_settings' ) ) );

		$this->assertSame( array( 'general' ), array_keys( $instance->pages() ) );
		$this->assertCount( 1, $GLOBALS['__fyldo_test_wrong'] );
		$this->assertStringContainsString( 'already used by page "general"', $this->wrong( 0 ) );
	}

	public function test_a_page_cannot_take_the_option_of_a_page_of_another_instance(): void {
		Fyldo::create( 'freeze-one', array( 'title' => 'One' ) )->add_page( 'general', self::page() );
		$two = Fyldo::create( 'freeze-two', array( 'title' => 'Two' ) );

		$two->add_page( 'adopted', self::page( array(), array( 'option_name' => 'freeze-one_general' ) ) );

		$this->assertNull( $two->page( 'adopted' ) );
		$this->assertStringContainsString( 'already used by page "general" of "freeze-one"', $this->wrong( 0 ) );

		$two->add_page( 'own', self::page() );
		$this->assertNotNull( $two->page( 'own' ), 'its own default name is free' );
	}

	public function test_a_page_cannot_take_the_state_option_of_any_instance(): void {
		Fyldo::create( 'freeze-one', array( 'title' => 'One' ) );
		$two = Fyldo::create( 'freeze-two', array( 'title' => 'Two' ) );

		$two->add_page( 'mine', self::page( array(), array( 'option_name' => 'freeze-two__fyldo' ) ) );
		$two->add_page( 'theirs', self::page( array(), array( 'option_name' => 'freeze-one__fyldo' ) ) );

		$this->assertSame( array(), $two->pages() );
		$this->assertCount( 2, $GLOBALS['__fyldo_test_wrong'] );
		$this->assertStringContainsString( 'bookkeeping of "freeze-two"', $this->wrong( 0 ) );
		$this->assertStringContainsString( 'bookkeeping of "freeze-one"', $this->wrong( 1 ) );
	}

	/* The page filters are named like the form's. */

	public function test_the_page_filters_are_page_slash_id_slash_event(): void {
		$instance = Fyldo::create( 'freeze-one', array( 'title' => 'One' ) );
		$instance->add_page( 'general', self::page() );

		$this->assertSame( 'ok', $instance->update( 'general', array( 'a' => 'x' ) )['status'] );

		$this->assertSame( array( 'fyldo/freeze-one/page/general/sanitize', 'fyldo/freeze-one/page/general/validate' ), $GLOBALS['__fyldo_test_filtered'] );
	}

	/* Bounds and counts are keys of the field. */

	public function test_number_takes_min_max_and_step_on_the_field(): void {
		$field = FieldFactory::create( array( 'id' => 'qty', 'type' => 'number', 'label' => 'Quantity', 'min' => 5, 'max' => 20, 'step' => 5 ) );

		$this->assertSame( 5, $field->rules()['min'] );
		$this->assertSame( 20, $field->rules()['max'] );
		$this->assertSame( 5, $field->rules()['step'] );
		$this->assertNull( $field->validate( 10 ) );
		$this->assertNotNull( $field->validate( 0 ), 'below min' );
		$this->assertNotNull( $field->validate( 25 ), 'above max' );
		$this->assertNotNull( $field->validate( 12 ), 'off the step' );
	}

	public function test_number_still_takes_them_in_validate(): void {
		$field = FieldFactory::create( array( 'id' => 'qty', 'type' => 'number', 'label' => 'Quantity', 'validate' => array( 'min' => 5, 'max' => 20, 'step' => 5 ) ) );

		$this->assertSame( 5, $field->rules()['min'] );
		$this->assertNotNull( $field->validate( 25 ) );
	}

	public function test_multi_select_and_checkbox_group_take_min_and_max_on_the_field(): void {
		$options = array( 'a' => 'A', 'b' => 'B', 'c' => 'C' );

		foreach ( array( 'multi_select', 'checkbox_group' ) as $type ) {
			$field = FieldFactory::create( array( 'id' => 'tags', 'type' => $type, 'label' => 'Tags', 'options' => $options, 'min' => 1, 'max' => 2 ) );

			$this->assertSame( 1, $field->rules()['min'], $type );
			$this->assertSame( 2, $field->rules()['max'], $type );
			$this->assertNull( $field->validate( array( 'a' ) ), $type );
			$this->assertNotNull( $field->validate( array() ), $type . ': fewer than min' );
			$this->assertNotNull( $field->validate( array( 'a', 'b', 'c' ) ), $type . ': more than max' );
		}
	}

	public function test_a_list_still_takes_its_counts_in_validate(): void {
		$field = FieldFactory::create( array( 'id' => 'tags', 'type' => 'multi_select', 'label' => 'Tags', 'options' => array( 'a' => 'A', 'b' => 'B' ), 'validate' => array( 'max' => 1 ) ) );

		$this->assertSame( 1, $field->rules()['max'] );
		$this->assertNotNull( $field->validate( array( 'a', 'b' ) ) );
	}

	public function test_a_relation_field_with_multiple_takes_its_counts_on_the_field(): void {
		foreach ( array( 'post', 'term', 'user' ) as $type ) {
			$field = FieldFactory::create( array( 'id' => 'items', 'type' => $type, 'label' => 'Items', 'multiple' => true, 'min' => 1, 'max' => 3 ) );

			$this->assertSame( 1, $field->rules()['min'], $type );
			$this->assertSame( 3, $field->rules()['max'], $type );
		}
	}

	public function test_counts_on_a_relation_field_need_multiple(): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( 'only applies with `multiple`' );

		FieldFactory::create( array( 'id' => 'items', 'type' => 'post', 'label' => 'Items', 'max' => 3 ) );
	}

	/**
	 * @dataProvider both_places
	 *
	 * @param array<string,mixed> $config Field config with a bound on the field and in `validate`.
	 */
	public function test_the_same_bound_in_both_places_is_a_config_error( array $config ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( 'is set on the field and in `validate`' );

		FieldFactory::create( $config );
	}

	public function both_places(): array {
		$options = array( 'a' => 'A', 'b' => 'B' );

		return array(
			'number'         => array( array( 'id' => 'f', 'type' => 'number', 'label' => 'F', 'min' => 1, 'validate' => array( 'min' => 1 ) ) ),
			'number step'    => array( array( 'id' => 'f', 'type' => 'number', 'label' => 'F', 'step' => 2, 'validate' => array( 'step' => 2 ) ) ),
			'multi_select'   => array( array( 'id' => 'f', 'type' => 'multi_select', 'label' => 'F', 'options' => $options, 'max' => 2, 'validate' => array( 'max' => 2 ) ) ),
			'checkbox_group' => array( array( 'id' => 'f', 'type' => 'checkbox_group', 'label' => 'F', 'options' => $options, 'min' => 1, 'validate' => array( 'min' => 1 ) ) ),
			'post'           => array( array( 'id' => 'f', 'type' => 'post', 'label' => 'F', 'multiple' => true, 'max' => 2, 'validate' => array( 'max' => 2 ) ) ),
		);
	}

	/* update() and reset() return what all() returns. */

	public function test_update_and_reset_return_the_values_all_returns(): void {
		$instance = Fyldo::create( 'freeze-one', array( 'title' => 'One' ) );
		$instance->add_page(
			'general',
			self::page(
				array(
					array( 'id' => 'name', 'type' => 'text', 'label' => 'Name', 'default' => 'Acme', 'validate' => array( 'max_length' => 8 ) ),
					array( 'id' => 'api_key', 'type' => 'password', 'label' => 'API key' ),
				)
			)
		);

		$saved = $instance->update( 'general', array( 'name' => 'Beta', 'api_key' => 's3cr3t' ) );

		$this->assertSame( array( 'status', 'errors', 'values', 'revision' ), array_keys( $saved ), 'no media key' );
		$this->assertSame( 'ok', $saved['status'] );
		$this->assertSame( $instance->all( 'general' ), $saved['values'] );
		$this->assertSame( 's3cr3t', $saved['values']['api_key'], 'a password as stored' );
		$this->assertSame( $instance->store()->revision( $instance->page( 'general' ) ), $saved['revision'] );

		$rejected = $instance->update( 'general', array( 'name' => 'Far too long' ) );
		$this->assertSame( 'invalid', $rejected['status'] );
		$this->assertArrayHasKey( 'name', $rejected['errors'] );
		$this->assertSame( $instance->all( 'general' ), $rejected['values'], 'a refused save returns what is stored' );
		$this->assertSame( 'Beta', $rejected['values']['name'] );

		$reset = $instance->reset( 'general' );
		$this->assertSame( array( 'status', 'errors', 'values', 'revision' ), array_keys( $reset ) );
		$this->assertSame( $instance->all( 'general' ), $reset['values'] );
		$this->assertSame( 'Acme', $reset['values']['name'] );
		$this->assertSame( '', $reset['values']['api_key'] );
	}

	public function test_an_unknown_page_gives_the_same_shape_from_update_and_reset(): void {
		$instance = Fyldo::create( 'freeze-one', array( 'title' => 'One' ) );
		$expected = array(
			'status'   => 'invalid',
			'errors'   => array( '_page' => 'Unknown page.' ),
			'values'   => array(),
			'revision' => '',
		);

		$this->assertSame( $expected, $instance->update( 'nope', array() ) );
		$this->assertSame( $expected, $instance->reset( 'nope' ) );
		$this->assertSame( array(), $instance->all( 'nope' ) );
	}

	/* Registration checks. */

	/**
	 * @dataProvider bad_groups
	 */
	public function test_a_bad_group_is_reported_and_skipped( string $id, string $label, string $needle ): void {
		$instance = new Instance( 'freeze-one', array( 'title' => 'One' ) );
		$instance->add_group( 'tools', 'Tools' );

		$instance->add_group( $id, $label );

		$this->assertSame( array( 'tools' ), array_column( $instance->groups(), 'id' ) );
		$this->assertCount( 1, $GLOBALS['__fyldo_test_wrong'] );
		$this->assertStringContainsString( $needle, $this->wrong( 0 ) );
	}

	public function bad_groups(): array {
		return array(
			'not URL-safe' => array( 'Bad Id', 'Label', 'is invalid' ),
			'too long'     => array( str_repeat( 'x', 41 ), 'Label', 'is invalid' ),
			'a duplicate'  => array( 'tools', 'Again', 'already registered' ),
			'no label'     => array( 'extra', '  ', 'needs a label' ),
		);
	}

	public function test_a_good_group_is_registered(): void {
		$instance = new Instance( 'freeze-one', array( 'title' => 'One' ) );
		$instance->add_group( 'settings', ' Settings ' )->add_group( 'tools_2', 'Tools' );

		$this->assertSame( array( array( 'id' => 'settings', 'label' => 'Settings' ), array( 'id' => 'tools_2', 'label' => 'Tools' ) ), $instance->groups() );
		$this->assertSame( array(), $GLOBALS['__fyldo_test_wrong'] );
	}

	public function test_a_page_in_a_group_nobody_registered_is_reported_when_screens_register_and_shows_ungrouped(): void {
		$instance = new Instance( 'freeze-one', array( 'title' => 'One' ) );
		$instance->add_group( 'settings', 'Settings' );
		$instance->add_page( 'general', self::page( array(), array( 'group' => 'settings' ) ) );
		$instance->add_page( 'lost', self::page( array(), array( 'group' => 'setings' ) ) );
		$instance->add_page( 'books', array( 'type' => 'custom', 'title' => 'Books', 'module' => '/books.js', 'group' => 'shop' ) );
		$instance->add_page( 'loose', self::page() );

		$this->assertSame( array(), $GLOBALS['__fyldo_test_wrong'], 'nothing is reported while pages are added' );

		$instance->check_groups();

		$this->assertCount( 2, $GLOBALS['__fyldo_test_wrong'] );
		$this->assertStringContainsString( 'page "lost" is in group "setings"', $this->wrong( 0 ) );
		$this->assertStringContainsString( 'page "books" is in group "shop"', $this->wrong( 1 ) );

		$client = ClientConfig::build( $instance );
		$groups = array_column( $client['pages'], 'group', 'id' );
		$this->assertSame( array( 'general' => 'settings', 'lost' => '', 'books' => '', 'loose' => '' ), $groups );
	}

	/**
	 * @dataProvider bad_instance_configs
	 *
	 * @param array<string,mixed> $config Instance config.
	 */
	public function test_unknown_instance_links_and_menu_keys_are_config_errors( array $config, string $needle ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessageMatches( '/' . preg_quote( $needle, '/' ) . '/' );

		new Instance( 'freeze-one', $config );
	}

	public function bad_instance_configs(): array {
		return array(
			'link key'          => array( array( 'links' => array( array( 'label' => 'Docs', 'url' => 'https://acme.test', 'target' => '_blank' ) ) ), 'a link has unknown key(s): target' ),
			'link key, header'  => array( array( 'links' => array( array( 'label' => 'Docs', 'url' => 'https://acme.test', 'placement' => 'header', 'color' => 'red' ) ) ), 'a link has unknown key(s): color' ),
			'link url'          => array( array( 'links' => array( array( 'label' => 'Docs', 'url' => 'javascript:alert(1)' ) ) ), 'the link URL "javascript:alert(1)" is not valid' ),
			'menu key'          => array( array( 'menu' => array( 'type' => 'top', 'slug' => 'x' ) ), 'unknown menu key(s): slug' ),
			'menu key, several' => array( array( 'menu' => array( 'parent' => 'tools.php', 'position' => 3, 'capability' => 'x', 'label' => 'y' ) ), 'unknown menu key(s): capability, label' ),
		);
	}

	public function test_the_known_menu_and_link_keys_are_accepted(): void {
		$config = ( new Instance(
			'freeze-one',
			array(
				'menu'  => array( 'type' => 'top', 'title' => 'One', 'icon' => 'dashicons-admin-tools', 'position' => 80 ),
				'links' => array( array( 'label' => 'Docs', 'url' => 'https://acme.test/docs', 'icon' => 'book', 'external' => true, 'placement' => 'header' ) ),
			)
		) )->config();

		$this->assertSame( 'top', $config['menu']['type'] );
		$this->assertSame( 'https://acme.test/docs', $config['links'][0]['url'] );
	}

	/**
	 * @dataProvider bad_badges
	 *
	 * @param mixed $badge A badge that is neither a string nor an int.
	 */
	public function test_a_field_badge_is_a_string_or_an_int( $badge ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( 'badge must be a short string or a number' );

		FieldFactory::create( array( 'id' => 'f', 'type' => 'text', 'label' => 'F', 'badge' => $badge ) );
	}

	public function bad_badges(): array {
		return array(
			'bool'  => array( true ),
			'array' => array( array( 'New' ) ),
			'float' => array( 1.5 ),
		);
	}

	public function test_a_field_badge_is_exported_as_text(): void {
		$text = FieldFactory::create( array( 'id' => 'f', 'type' => 'text', 'label' => 'F', 'badge' => 'New' ) )->to_client();
		$int  = FieldFactory::create( array( 'id' => 'f', 'type' => 'text', 'label' => 'F', 'badge' => 3 ) )->to_client();
		$none = FieldFactory::create( array( 'id' => 'f', 'type' => 'text', 'label' => 'F' ) )->to_client();

		$this->assertSame( 'New', $text['badge'] );
		$this->assertSame( '3', $int['badge'] );
		$this->assertArrayNotHasKey( 'badge', $none );
	}
}
