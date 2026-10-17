<?php
/**
 * `add_page( $id, array( 'type' => 'custom', … ) )`: a page drawn by the developer's module. Config, registration next
 * to the settings pages, and what the browser gets (Assets\ClientConfig).
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Assets\Assets;
use Fyldo\V1\Assets\ClientConfig;
use Fyldo\V1\Instance;
use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Schema\CustomPage;
use PHPUnit\Framework\TestCase;

final class CustomPageTest extends TestCase {

	protected function setUp(): void {
		$GLOBALS['__fyldo_test_options'] = array();
		$GLOBALS['__fyldo_test_wrong']   = array();
		$GLOBALS['__fyldo_test_caps']    = array( 'manage_options' );
	}

	/** The messages reported with _doing_it_wrong(), as the developer reads them (they are escaped for HTML). */
	private static function wrong(): array {
		return array_map( static fn( string $message ): string => html_entity_decode( $message, ENT_QUOTES ), $GLOBALS['__fyldo_test_wrong'] );
	}

	private static function custom( array $overrides = array() ): array {
		return array_merge(
			array(
				'type'   => 'custom',
				'title'  => 'Books',
				'module' => 'https://example.com/wp-content/plugins/acme/books.js',
			),
			$overrides
		);
	}

	private static function settings( string $title ): array {
		return array(
			'title'    => $title,
			'sections' => array( array( 'id' => 's', 'title' => 'S', 'fields' => array( array( 'id' => 'x', 'type' => 'toggle', 'label' => 'X' ) ) ) ),
		);
	}

	public function test_the_browser_gets_the_navigation_entry_the_module_and_the_props(): void {
		$page = new CustomPage(
			'books',
			self::custom(
				array(
					'description' => 'Every book in the shop.',
					'icon'        => 'book',
					'group'       => 'shop',
					'badge'       => 12,
					'capability'  => 'edit_posts',
					'style'       => '/wp-content/plugins/acme/books.css',
					'props'       => array( 'perPage' => 20, 'columns' => array( 'title', 'author' ) ),
				)
			)
		);

		$this->assertSame(
			'{"type":"custom","id":"books","title":"Books","description":"Every book in the shop.","icon":"book","group":"shop","badge":"12","module":"https://example.com/wp-content/plugins/acme/books.js","props":{"perPage":20,"columns":["title","author"]}}',
			wp_json_encode( $page->to_client(), JSON_UNESCAPED_SLASHES )
		);
		$this->assertSame( '/wp-content/plugins/acme/books.css', $page->style(), 'the stylesheet is enqueued by PHP, not sent' );
		$this->assertSame( 'edit_posts', $page->capability() );
	}

	public function test_defaults_no_style_and_props_as_an_empty_object(): void {
		$page   = new CustomPage( 'books', self::custom( array( 'module' => '/wp-content/plugins/acme/books.js' ) ) );
		$client = $page->to_client();

		$this->assertSame( '/wp-content/plugins/acme/books.js', $page->module() );
		$this->assertSame( '', $page->style() );
		$this->assertSame( '', $page->capability() );
		$this->assertSame( '{}', wp_json_encode( $client['props'] ), 'no props: an object, never []' );
		$this->assertSame( array( '', '', '', '' ), array( $client['description'], $client['icon'], $client['group'], $client['badge'] ) );
	}

	/**
	 * @dataProvider invalid
	 */
	public function test_config_errors( array $overrides, string $needle, string $id = 'books' ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessageMatches( '/' . preg_quote( $needle, '/' ) . '/i' );

		new CustomPage( $id, self::custom( $overrides ) );
	}

	public function invalid(): array {
		return array(
			'bad id'               => array( array(), 'Page id', 'Bad Id' ),
			'sections'             => array( array( 'sections' => array() ), 'custom pages draw their own content: remove `sections`' ),
			'several page keys'    => array( array( 'tabs' => array(), 'save' => 'global', 'option_name' => 'x' ), 'remove `tabs`, `save`, `option_name`' ),
			'unknown key'          => array( array( 'colour' => 'red' ), 'unknown key(s): colour' ),
			'no title'             => array( array( 'title' => ' ' ), 'needs a title' ),
			'no module'            => array( array( 'module' => '' ), '`module` must be the URL' ),
			'module not a URL'     => array( array( 'module' => 'books.js' ), '`module` must be the URL' ),
			'protocol-relative'    => array( array( 'module' => '//cdn.example.com/books.js' ), '`module` must be the URL' ),
			'javascript: module'   => array( array( 'module' => 'javascript:alert(1)' ), '`module` must be the URL' ),
			'bad style'            => array( array( 'style' => 'ftp://example.com/books.css' ), '`style` must be the URL' ),
			'props a list'         => array( array( 'props' => array( 'a', 'b' ) ), '`props` must be an array keyed by name' ),
			'props with an object' => array( array( 'props' => array( 'when' => new \DateTime() ) ), '`props` must be an array keyed by name' ),
			'props not an array'   => array( array( 'props' => 'x' ), '`props` must be an array keyed by name' ),
			'badge bool'           => array( array( 'badge' => true ), 'badge' ),
			'media not a boolean'  => array( array( 'media' => 1 ), '`media` must be true (the module opens the media library) or false' ),
		);
	}

	public function test_the_screen_loads_the_media_library_only_when_something_opens_it(): void {
		$custom_field = static function ( bool $media ): array {
			return array( 'id' => 'cover', 'type' => 'custom', 'label' => 'Cover', 'module' => '/cover.js', 'media' => $media );
		};
		$page         = static function ( array $field ): array {
			return array(
				'title'    => 'General',
				'sections' => array( array( 'id' => 's', 'title' => 'S', 'fields' => array( $field ) ) ),
			);
		};
		$screen       = static function ( callable $register ): bool {
			$instance = new Instance( 'acme-shop', array( 'title' => 'Acme Shop' ) );
			$register( $instance );
			return Assets::needs_media( $instance );
		};

		$this->assertFalse( $screen( static fn( Instance $i ) => $i->add_page( 'books', self::custom() ) ), 'a custom page without `media`' );
		$this->assertFalse( $screen( static fn( Instance $i ) => $i->add_page( 'general', $page( $custom_field( false ) ) ) ) );
		$this->assertTrue( $screen( static fn( Instance $i ) => $i->add_page( 'books', self::custom( array( 'media' => true ) ) ) ) );
		$this->assertTrue( $screen( static fn( Instance $i ) => $i->add_page( 'general', $page( $custom_field( true ) ) ) ) );
		$this->assertTrue(
			$screen(
				static fn( Instance $i ) => $i->add_page(
					'general',
					$page( array( 'id' => 'slides', 'type' => 'group', 'label' => 'Slides', 'addable' => true, 'fields' => array( $custom_field( true ) ) ) )
				)
			),
			'a custom field inside a group'
		);
		$this->assertTrue( $screen( static fn( Instance $i ) => $i->add_page( 'general', $page( array( 'id' => 'logo', 'type' => 'image', 'label' => 'Logo' ) ) ) ) );
		$this->assertSame( array(), $GLOBALS['__fyldo_test_wrong'] );
	}

	public function test_custom_pages_are_kept_apart_from_the_settings_pages_in_registration_order(): void {
		$instance = new Instance( 'acme-shop', array( 'title' => 'Acme Shop' ) );
		$instance->add_page( 'general', self::settings( 'General' ) );
		$instance->add_page( 'books', self::custom() );
		$instance->add_page( 'advanced', self::settings( 'Advanced' ) );

		$this->assertSame( array(), $GLOBALS['__fyldo_test_wrong'] );
		$this->assertSame( array( 'general', 'advanced' ), array_keys( $instance->pages() ), 'pages(): settings pages only' );
		$this->assertSame( array( 'books' ), array_keys( $instance->custom_pages() ) );
		$this->assertSame( array( 'general', 'books', 'advanced' ), array_keys( $instance->all_pages() ) );
		$this->assertNull( $instance->page( 'books' ) );
		$this->assertInstanceOf( CustomPage::class, $instance->custom_page( 'books' ) );
		$this->assertNull( $instance->custom_page( 'general' ) );
		$this->assertSame( array(), $instance->all( 'books' ), 'a custom page has no values' );
	}

	public function test_type_settings_is_the_default_and_anything_else_is_refused(): void {
		$instance = new Instance( 'acme-shop', array( 'title' => 'Acme Shop' ) );
		$instance->add_page( 'general', array_merge( array( 'type' => 'settings' ), self::settings( 'General' ) ) );
		$instance->add_page( 'report', array_merge( self::custom(), array( 'type' => 'report' ) ) );

		$this->assertNotNull( $instance->page( 'general' ) );
		$this->assertNull( $instance->custom_page( 'report' ) );
		$this->assertCount( 1, $GLOBALS['__fyldo_test_wrong'] );
		$this->assertStringContainsString( 'type must be "settings" (the default) or "custom"', self::wrong()[0] );
	}

	public function test_page_ids_are_unique_across_both_kinds(): void {
		$instance = new Instance( 'acme-shop', array( 'title' => 'Acme Shop' ) );
		$instance->add_page( 'general', self::settings( 'General' ) );
		$instance->add_page( 'general', self::custom() );
		$instance->add_page( 'books', self::custom() );
		$instance->add_page( 'books', self::settings( 'Books' ) );

		$this->assertCount( 2, $GLOBALS['__fyldo_test_wrong'] );
		$this->assertStringContainsString( 'Page "general" is already registered', self::wrong()[0] );
		$this->assertStringContainsString( 'Page "books" is already registered', self::wrong()[1] );
		$this->assertNotNull( $instance->page( 'general' ) );
		$this->assertNotNull( $instance->custom_page( 'books' ) );
	}

	public function test_a_broken_custom_page_is_reported_and_skipped(): void {
		$instance = new Instance( 'acme-shop', array( 'title' => 'Acme Shop' ) );
		$instance->add_page( 'books', self::custom( array( 'sections' => array() ) ) );

		$this->assertSame( array(), $instance->all_pages() );
		$this->assertStringContainsString( 'Fyldo "acme-shop": Custom page "books": custom pages draw their own content', self::wrong()[0] );
	}

	public function test_capability_is_the_page_override_else_the_instance_default(): void {
		$instance = new Instance( 'acme-shop', array( 'title' => 'Acme Shop', 'capability' => 'manage_woocommerce' ) );
		$instance->add_page( 'books', self::custom() );
		$instance->add_page( 'authors', self::custom( array( 'capability' => 'edit_posts' ) ) );

		$this->assertSame( 'manage_woocommerce', $instance->capability_for( $instance->custom_page( 'books' ) ) );
		$this->assertSame( 'edit_posts', $instance->capability_for( $instance->custom_page( 'authors' ) ) );
	}

	public function test_the_client_config_mixes_both_kinds_in_order_and_only_what_the_user_may_open(): void {
		$instance = new Instance( 'acme-shop', array( 'title' => 'Acme Shop' ) );
		$instance->add_page( 'books', self::custom() );
		$instance->add_page( 'general', self::settings( 'General' ) );
		$instance->add_page( 'authors', self::custom( array( 'title' => 'Authors', 'capability' => 'edit_posts' ) ) );
		$instance->add_page( 'advanced', array_merge( self::settings( 'Advanced' ), array( 'capability' => 'edit_posts' ) ) );

		$client = ClientConfig::build( $instance );

		$this->assertSame( array( 'books', 'general' ), array_column( $client['pages'], 'id' ) );
		$this->assertSame( array( 'custom', 'settings' ), array_column( $client['pages'], 'type' ) );
		$this->assertArrayNotHasKey( 'values', $client['pages'][0], 'a custom page has no values' );
		$this->assertArrayHasKey( 'values', $client['pages'][1] );
		$this->assertSame( 'https://example.com/wp-json/', $client['rest']['base'], 'the site REST root, for the plugin\'s own routes' );
		$this->assertSame( 'https://example.com/wp-json/fyldo-acme-shop/v1/', $client['rest']['root'] );
		$this->assertSame( array(), $client['forms'] );

		$GLOBALS['__fyldo_test_caps'] = array( 'manage_options', 'edit_posts' );
		$this->assertSame( array( 'books', 'general', 'authors', 'advanced' ), array_column( ClientConfig::build( $instance )['pages'], 'id' ) );
	}
}
