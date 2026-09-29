<?php
/**
 * Milestone 2 field types: textarea, checkbox, checkbox_group, radio.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Fields\FieldFactory;
use Fyldo\V1\Instance;
use Fyldo\V1\Schema\ConfigException;
use PHPUnit\Framework\TestCase;

final class FormFieldsTest extends TestCase {

	protected function setUp(): void {
		$GLOBALS['__fyldo_test_options']  = array();
		$GLOBALS['__fyldo_test_autoload'] = array();
		$GLOBALS['__fyldo_test_wrong']    = array();
	}

	private function textarea( array $extra = array() ) {
		return FieldFactory::create( array_merge( array( 'id' => 'meta_description', 'type' => 'textarea', 'label' => 'Meta description' ), $extra ) );
	}

	private function group( array $extra = array() ) {
		return FieldFactory::create(
			array_merge(
				array(
					'id'      => 'post_types',
					'type'    => 'checkbox_group',
					'label'   => 'Show on',
					'options' => array(
						'post'    => 'Posts',
						'page'    => 'Pages',
						'product' => 'Products',
					),
				),
				$extra
			)
		);
	}

	private function radio( array $extra = array() ) {
		return FieldFactory::create(
			array_merge(
				array(
					'id'      => 'robots',
					'type'    => 'radio',
					'label'   => 'Search engine visibility',
					'options' => array( 'index' => 'Index', 'noindex' => 'Discourage indexing' ),
					'default' => 'index',
				),
				$extra
			)
		);
	}

	// ── Textarea ───────────────────────────────────────────────────────────────────────────────────────

	public function test_textarea_keeps_line_breaks_and_strips_markup(): void {
		$field = $this->textarea();

		$this->assertSame( "Line one\nLine two bold", $field->sanitize( "  Line one\r\nLine two <b>bold</b>  " ) );
		$this->assertSame( '', $field->sanitize( array( 'x' ) ), 'Non-scalars become an empty string.' );
		$this->assertSame( 'stacked', $field->to_client()['layout'] );
		$this->assertSame( '', $field->default_value() );
	}

	public function test_textarea_over_the_limit_is_an_error_and_is_never_truncated(): void {
		$field = $this->textarea( array( 'validate' => array( 'max_length' => 160 ) ) );

		$long      = str_repeat( 'x', 172 );
		$sanitized = $field->sanitize( $long );

		$this->assertSame( $long, $sanitized, 'Sanitizing must not cut the text.' );
		$this->assertSame( 'Use no more than 160 characters.', $field->validate( $sanitized ) );
		$this->assertNull( $field->validate( str_repeat( 'x', 160 ) ) );
		$this->assertEquals( array( 'max_length' => 160 ), (array) $field->to_client()['validate'], 'The browser gets the limit, so it can draw the counter.' );
	}

	public function test_textarea_rows_and_resize_are_exported_with_defaults(): void {
		$this->assertSame( 4, $this->textarea()->to_client()['rows'] );
		$this->assertSame( 'vertical', $this->textarea()->to_client()['resize'] );

		$field = $this->textarea( array( 'rows' => 8, 'resize' => 'none', 'placeholder' => 'Describe…' ) );
		$this->assertSame( 8, $field->to_client()['rows'] );
		$this->assertSame( 'none', $field->to_client()['resize'] );
		$this->assertSame( 'Describe…', $field->to_client()['placeholder'] );
	}

	// ── Checkbox ───────────────────────────────────────────────────────────────────────────────────────

	public function test_checkbox_is_an_inline_boolean_that_defaults_to_unchecked(): void {
		$field = FieldFactory::create( array( 'id' => 'agree', 'type' => 'checkbox', 'label' => 'I agree' ) );

		$this->assertFalse( $field->default_value() );
		$this->assertSame( 'inline', $field->to_client()['layout'] );
		$this->assertTrue( $field->sanitize( 'true' ) );
		$this->assertTrue( $field->sanitize( 1 ) );
		$this->assertFalse( $field->sanitize( 'false' ) );
		$this->assertFalse( $field->sanitize( '0' ) );
	}

	public function test_a_required_checkbox_must_be_checked(): void {
		$field = FieldFactory::create( array( 'id' => 'agree', 'type' => 'checkbox', 'label' => 'I agree', 'validate' => array( 'required' => true ) ) );

		$this->assertSame( 'This field is required.', $field->validate( false ) );
		$this->assertNull( $field->validate( true ) );
	}

	// ── Checkbox group ─────────────────────────────────────────────────────────────────────────────────

	public function test_group_value_is_a_list_in_option_order_without_duplicates(): void {
		$field = $this->group();

		$this->assertSame( array( 'post', 'product' ), $field->sanitize( array( 'product', 'post', 'product' ) ) );
		$this->assertSame( array(), $field->sanitize( 'post' ), 'A scalar is not a list.' );
		$this->assertSame( array( 'page' ), $field->sanitize( array( 'page', array( 'nested' ), true, null ) ), 'Non-scalars and booleans are dropped.' );
		$this->assertSame( array(), $field->default_value() );
	}

	public function test_group_reports_unknown_values_instead_of_dropping_them(): void {
		$field = $this->group();

		$sanitized = $field->sanitize( array( 'post', 'attachment' ) );

		$this->assertSame( array( 'post', 'attachment' ), $sanitized );
		$this->assertSame( 'Choose one of the available options.', $field->validate( $sanitized ) );
	}

	public function test_group_disabled_options_stay_visible_but_cannot_be_chosen(): void {
		$field = $this->group(
			array(
				'options' => array(
					array( 'value' => 'post', 'label' => 'Posts' ),
					array( 'value' => 'page', 'label' => 'Pages', 'description' => 'Static pages.' ),
					array( 'value' => 'product', 'label' => 'Products', 'disabled' => true, 'description' => 'Available in Pro.' ),
				),
			)
		);

		$this->assertCount( 3, $field->to_client()['options'] );
		$this->assertTrue( $field->to_client()['options'][2]['disabled'] );
		$this->assertSame( 'Static pages.', $field->to_client()['options'][1]['description'] );
		$this->assertArrayNotHasKey( 'description', $field->to_client()['options'][0] );
		$this->assertSame( 'Choose one of the available options.', $field->validate( array( 'product' ) ) );
		$this->assertNull( $field->validate( array( 'post', 'page' ) ) );
	}

	public function test_group_min_and_max_count_the_selected_items(): void {
		$field = $this->group( array( 'validate' => array( 'min' => 1, 'max' => 2 ) ) );

		$this->assertSame( 'Select at least 1 option.', $field->validate( array() ) );
		$this->assertNull( $field->validate( array( 'post' ) ) );
		$this->assertNull( $field->validate( array( 'post', 'page' ) ) );
		$this->assertSame( 'Select no more than 2 options.', $field->validate( array( 'post', 'page', 'product' ) ) );
	}

	public function test_group_required_and_optional(): void {
		$this->assertNull( $this->group()->validate( array() ), 'Optional: nothing selected is fine.' );
		$this->assertSame( 'This field is required.', $this->group( array( 'validate' => array( 'required' => true ) ) )->validate( array() ) );
	}

	public function test_group_exports_parent_default_and_allowed_rule(): void {
		$field  = $this->group( array( 'parent' => 'All post types', 'default' => array( 'post', 'page' ) ) );
		$client = $field->to_client();

		$this->assertSame( 'All post types', $client['parent'] );
		$this->assertSame( array( 'post', 'page' ), $client['default'] );
		$this->assertEquals( array( 'allowed' => array( 'post', 'page', 'product' ) ), (array) $client['validate'] );
		$this->assertSame( '', $this->group()->to_client()['parent'] );
		$this->assertSame( '[]', wp_json_encode( $this->group()->to_client()['default'] ), 'An empty selection is a JSON list, not an object.' );
	}

	public function test_group_options_may_be_a_callable_resolved_lazily_once(): void {
		$calls = 0;
		$field = $this->group(
			array(
				'options' => static function () use ( &$calls ) {
					++$calls;
					return array( 'a' => 'A', 'b' => 'B' );
				},
			)
		);

		$this->assertSame( 0, $calls, 'Callable options are not resolved at registration.' );
		$this->assertSame( array( 'a' ), $field->sanitize( array( 'a' ) ) );
		$field->to_client();
		$this->assertSame( 1, $calls );
	}

	// ── Radio ──────────────────────────────────────────────────────────────────────────────────────────

	public function test_radio_accepts_only_enabled_options_and_is_never_empty(): void {
		$field = $this->radio();

		$this->assertNull( $field->validate( 'noindex' ) );
		$this->assertSame( 'Choose one of the available options.', $field->validate( 'follow' ) );
		$this->assertSame( 'This field is required.', $field->validate( '' ) );
		$this->assertSame( '', $field->sanitize( array( 'index' ) ) );
		$this->assertSame( 'index', $field->default_value() );
		$this->assertSame( 'stacked', $field->to_client()['layout'] );
		$this->assertEquals(
			array( 'required' => true, 'allowed' => array( 'index', 'noindex' ) ),
			(array) $field->to_client()['validate']
		);
	}

	public function test_radio_options_carry_descriptions_and_disabled_flags(): void {
		$field = $this->radio(
			array(
				'options' => array(
					array( 'value' => 'index', 'label' => 'Index', 'description' => 'Let search engines list the site.' ),
					array( 'value' => 'noindex', 'label' => 'Discourage', 'description' => 'Ask search engines to skip the site.' ),
					array( 'value' => 'private', 'label' => 'Private', 'description' => 'Available in Pro.', 'disabled' => true ),
				),
			)
		);

		$options = $field->to_client()['options'];
		$this->assertSame( 'Let search engines list the site.', $options[0]['description'] );
		$this->assertTrue( $options[2]['disabled'] );
		$this->assertSame( 'Choose one of the available options.', $field->validate( 'private' ) );
	}

	public function test_radio_with_more_than_five_options_asks_for_a_select_but_still_works(): void {
		$options = array();
		foreach ( range( 1, 6 ) as $n ) {
			$options[ 'o' . $n ] = 'Option ' . $n;
		}

		$field = $this->radio( array( 'options' => $options, 'default' => 'o1' ) );

		$this->assertNull( $field->validate( 'o6' ) );
		$this->assertCount( 1, $GLOBALS['__fyldo_test_wrong'] );
		$this->assertStringContainsString( 'use a `select` field', $GLOBALS['__fyldo_test_wrong'][0] );
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
		$radio = array( 'id' => 'r', 'type' => 'radio', 'label' => 'Radio', 'options' => array( 'a' => 'A', 'b' => 'B' ), 'default' => 'a' );
		$group = array( 'id' => 'g', 'type' => 'checkbox_group', 'label' => 'Group', 'options' => array( 'a' => 'A', 'b' => 'B' ) );
		$area  = array( 'id' => 't', 'type' => 'textarea', 'label' => 'Text' );

		return array(
			'radio without default'          => array( array_diff_key( $radio, array( 'default' => 1 ) ), 'needs a `default`' ),
			'radio with an empty default'    => array( array_merge( $radio, array( 'default' => '' ) ), 'needs a `default`' ),
			'radio default not an option'    => array( array_merge( $radio, array( 'default' => 'z' ) ), 'not one of its enabled options' ),
			'radio default is disabled'      => array( array_merge( $radio, array( 'options' => array( array( 'value' => 'a', 'label' => 'A', 'disabled' => true ), 'b' => 'B' ) ) ), 'not one of its enabled options' ),
			'radio with one option'          => array( array_merge( $radio, array( 'options' => array( 'a' => 'A' ) ) ), 'at least two options' ),
			'radio without options'          => array( array_diff_key( $radio, array( 'options' => 1 ) ), 'needs `options`' ),
			'radio duplicate values'         => array( array_merge( $radio, array( 'options' => array( array( 'value' => 'a', 'label' => 'A' ), array( 'value' => 'a', 'label' => 'Again' ) ) ) ), 'used twice' ),
			'radio bad option'               => array( array_merge( $radio, array( 'options' => array( array( 'label' => 'A' ) ) ) ), 'value` and `label' ),
			'group without options'          => array( array_diff_key( $group, array( 'options' => 1 ) ), 'needs `options`' ),
			'group empty options'            => array( array_merge( $group, array( 'options' => array() ) ), 'no options' ),
			'group default not a list'       => array( array_merge( $group, array( 'default' => 'a' ) ), 'list of option values' ),
			'group default not an option'    => array( array_merge( $group, array( 'default' => array( 'z' ) ) ), 'not enabled options' ),
			'textarea rows too small'        => array( array_merge( $area, array( 'rows' => 1 ) ), 'between 2 and 30' ),
			'textarea rows not an int'       => array( array_merge( $area, array( 'rows' => '4' ) ), 'between 2 and 30' ),
			'textarea bad resize'            => array( array_merge( $area, array( 'resize' => 'both' ) ), '"vertical" or "none"' ),
			'textarea unknown key'           => array( array_merge( $area, array( 'options' => array() ) ), 'unknown key' ),
			'checkbox unknown key'           => array( array( 'id' => 'c', 'type' => 'checkbox', 'label' => 'C', 'options' => array() ), 'unknown key' ),
		);
	}

	// ── Through the save pipeline ──────────────────────────────────────────────────────────────────────

	private function instance(): Instance {
		$instance = new Instance( 'acme-seo', array( 'title' => 'Acme SEO' ) );
		$instance->add_page(
			'general',
			array(
				'title'    => 'General',
				'sections' => array(
					array(
						'id'     => 'seo',
						'title'  => 'SEO',
						'fields' => array(
							array( 'id' => 'meta_description', 'type' => 'textarea', 'label' => 'Meta description', 'validate' => array( 'max_length' => 20 ) ),
							array( 'id' => 'agree', 'type' => 'checkbox', 'label' => 'I agree' ),
							array( 'id' => 'post_types', 'type' => 'checkbox_group', 'label' => 'Show on', 'options' => array( 'post' => 'Posts', 'page' => 'Pages', 'product' => 'Products' ), 'default' => array( 'post' ), 'validate' => array( 'min' => 1 ) ),
							array( 'id' => 'robots', 'type' => 'radio', 'label' => 'Visibility', 'options' => array( 'index' => 'Index', 'noindex' => 'Noindex' ), 'default' => 'index' ),
						),
					),
				),
			)
		);

		return $instance;
	}

	public function test_defaults_and_a_round_trip_through_the_saver(): void {
		$instance = $this->instance();

		$this->assertSame(
			array( 'meta_description' => '', 'agree' => false, 'post_types' => array( 'post' ), 'robots' => 'index' ),
			$instance->all( 'general' )
		);

		$result = $instance->update(
			'general',
			array(
				'meta_description' => "Two\nlines",
				'agree'            => 'true',
				'post_types'       => array( 'product', 'post' ),
				'robots'           => 'noindex',
			)
		);

		$this->assertSame( 'ok', $result['status'] );
		$this->assertSame(
			array( 'meta_description' => "Two\nlines", 'agree' => true, 'post_types' => array( 'post', 'product' ), 'robots' => 'noindex' ),
			$instance->all( 'general' )
		);
	}

	public function test_invalid_values_are_reported_per_field_and_nothing_is_saved(): void {
		$instance = $this->instance();

		$result = $instance->update(
			'general',
			array(
				'meta_description' => str_repeat( 'x', 21 ),
				'post_types'       => array(),
				'robots'           => 'follow',
			)
		);

		$this->assertSame( 'invalid', $result['status'] );
		$this->assertSame(
			array(
				'meta_description' => 'Use no more than 20 characters.',
				'post_types'       => 'Select at least 1 option.',
				'robots'           => 'Choose one of the available options.',
			),
			$result['errors']
		);
		$this->assertSame( array(), $GLOBALS['__fyldo_test_options'] );
	}

	public function test_a_stored_value_that_no_longer_validates_falls_back_to_the_default(): void {
		$GLOBALS['__fyldo_test_options']['acme-seo_general'] = array( 'post_types' => array( 'post', 'removed-type' ), 'robots' => 'removed-option' );

		$values = $this->instance()->all( 'general' );

		$this->assertSame( array( 'post' ), $values['post_types'] );
		$this->assertSame( 'index', $values['robots'] );
	}
}
