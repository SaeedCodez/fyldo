<?php
/**
 * Stored values stay readable inside 1.x: tests/fixtures/stored-values-v1.json holds one page's option value with a
 * stored value for every field type, as Fyldo stores it; this test declares the matching schema and reads it back.
 * The file is append-only inside 1.x (see its `_readme`): a change that breaks it is a breaking change.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Fields\FieldFactory;
use Fyldo\V1\Instance;
use Fyldo\V1\Support\Attachments;
use Fyldo\V1\Support\Relations;
use PHPUnit\Framework\TestCase;

final class StoredValuesTest extends TestCase {

	const FILE = __DIR__ . '/../../fixtures/stored-values-v1.json';

	/** The attachments, posts, terms and users the stored IDs point at. */
	const ATTACHMENTS = array(
		7 => array( 'id' => 7, 'filename' => 'logo-mark.png', 'filesize' => 38912, 'mime' => 'image/png', 'extension' => 'png', 'width' => 512, 'height' => 512, 'thumbnail' => 'https://example.com/logo-150x150.png', 'image' => true ),
		9 => array( 'id' => 9, 'filename' => 'guide.pdf', 'filesize' => 1258291, 'mime' => 'application/pdf', 'extension' => 'pdf', 'width' => null, 'height' => null, 'thumbnail' => null, 'image' => false ),
	);
	const POSTS       = array(
		3  => 'Home',
		7  => 'About us',
		12 => 'Shop',
	);

	protected function setUp(): void {
		$GLOBALS['__fyldo_test_options']  = array();
		$GLOBALS['__fyldo_test_autoload'] = array();
		$GLOBALS['__fyldo_test_wrong']    = array();
		$GLOBALS['__fyldo_test_terms']    = array(
			2 => array( 'category', 'News' ),
			5 => array( 'category', 'Releases' ),
		);
		$GLOBALS['__fyldo_test_users']    = array( 1 => array( 'admin', 'Site Admin' ) );

		Attachments::pin(
			static fn( int $id ): ?array => self::ATTACHMENTS[ $id ] ?? null,
			static fn( int $id ): bool => true
		);
		Relations::pin(
			null,
			static function ( array $source, array $ids, bool $check ): array {
				$found = array();
				foreach ( $ids as $id ) {
					if ( isset( self::POSTS[ $id ] ) ) {
						$found[ $id ] = array(
							'value' => $id,
							'label' => self::POSTS[ $id ],
							'hint'  => '',
						);
					}
				}
				return $found;
			}
		);
	}

	protected function tearDown(): void {
		Attachments::pin();
		Relations::pin();
		unset( $GLOBALS['__fyldo_test_terms'], $GLOBALS['__fyldo_test_users'] );
	}

	/** @return array{option:string,stored:array<string,mixed>} */
	private static function golden(): array {
		$golden = json_decode( (string) file_get_contents( self::FILE ), true );
		self::assertIsArray( $golden, 'stored-values-v1.json is valid JSON' );

		return $golden;
	}

	/**
	 * The schema of the stored page: one field per stored value (the field types in brackets are the point).
	 *
	 * @return array<int,array<string,mixed>>
	 */
	private static function fields(): array {
		$options = array(
			array( 'value' => 'post', 'label' => 'Posts' ),
			array( 'value' => 'page', 'label' => 'Pages' ),
			array( 'value' => 'product', 'label' => 'Products' ),
			array( 'value' => 'tag', 'label' => 'Tags' ),
		);

		return array(
			array( 'id' => 'site_title', 'type' => 'text', 'label' => 'Site title', 'default' => 'Fyldo' ),
			array( 'id' => 'home_url', 'type' => 'url', 'label' => 'Home' ),
			array( 'id' => 'contact_email', 'type' => 'email', 'label' => 'Contact email' ),
			array( 'id' => 'api_key', 'type' => 'password', 'label' => 'API key' ),
			array( 'id' => 'per_page', 'type' => 'number', 'label' => 'Per page', 'default' => 10 ),
			array( 'id' => 'ratio', 'type' => 'number', 'label' => 'Ratio' ),
			array( 'id' => 'intro', 'type' => 'textarea', 'label' => 'Intro' ),
			array( 'id' => 'custom_css', 'type' => 'code', 'label' => 'Custom CSS', 'language' => 'css' ),
			array( 'id' => 'maintenance', 'type' => 'toggle', 'label' => 'Maintenance', 'default' => false ),
			array( 'id' => 'agree', 'type' => 'checkbox', 'label' => 'Agree', 'default' => true ),
			array( 'id' => 'post_types', 'type' => 'checkbox_group', 'label' => 'Show on', 'default' => array( 'post' ), 'options' => array_slice( $options, 0, 3 ) ),
			array(
				'id'      => 'layout',
				'type'    => 'radio',
				'label'   => 'Layout',
				'default' => 'full',
				'options' => array(
					array( 'value' => 'full', 'label' => 'Full width' ),
					array( 'value' => 'boxed', 'label' => 'Boxed' ),
				),
			),
			array(
				'id'      => 'language',
				'type'    => 'select',
				'label'   => 'Language',
				'default' => 'en_US',
				'options' => array(
					'en_US' => 'English (United States)',
					'fa_IR' => 'فارسی',
				),
			),
			array( 'id' => 'sitemap_types', 'type' => 'multi_select', 'label' => 'Sitemap', 'options' => $options ),
			array(
				'id'      => 'density',
				'type'    => 'choice',
				'label'   => 'Density',
				'default' => 'comfortable',
				'options' => array(
					array( 'value' => 'compact', 'label' => 'Compact' ),
					array( 'value' => 'comfortable', 'label' => 'Comfortable' ),
				),
			),
			array(
				'id'      => 'sort_by',
				'type'    => 'segmented',
				'label'   => 'Sort',
				'default' => 'product',
				'options' => array(
					'product' => 'By product',
					'simple'  => 'Simple',
				),
			),
			array( 'id' => 'image_quality', 'type' => 'slider', 'label' => 'Image quality', 'default' => 75, 'min' => 0, 'max' => 100, 'step' => 5 ),
			array( 'id' => 'accent_color', 'type' => 'color', 'label' => 'Accent', 'default' => '#2271b1' ),
			array( 'id' => 'menu_icon', 'type' => 'icon', 'label' => 'Menu icon', 'icons' => array( 'home-2', 'setting-2', 'star', 'user' ), 'default' => 'home-2' ),
			array( 'id' => 'start_date', 'type' => 'date', 'label' => 'Start date' ),
			array( 'id' => 'report_at', 'type' => 'time', 'label' => 'Report at' ),
			array( 'id' => 'publish_at', 'type' => 'datetime', 'label' => 'Publish at' ),
			array( 'id' => 'offer_period', 'type' => 'date_range', 'label' => 'Offer period' ),
			array( 'id' => 'support_hours', 'type' => 'time_range', 'label' => 'Support hours' ),
			array( 'id' => 'campaign_window', 'type' => 'datetime_range', 'label' => 'Campaign window' ),
			array( 'id' => 'site_logo', 'type' => 'image', 'label' => 'Site logo' ),
			array( 'id' => 'brand_guidelines', 'type' => 'file', 'label' => 'Brand guidelines' ),
			array( 'id' => 'og_image', 'type' => 'image', 'label' => 'Social image' ),
			array( 'id' => 'homepage', 'type' => 'post', 'label' => 'Homepage', 'post_type' => 'page' ),
			array( 'id' => 'related_pages', 'type' => 'post', 'label' => 'Related pages', 'post_type' => 'page', 'multiple' => true ),
			array( 'id' => 'topics', 'type' => 'term', 'label' => 'Topics', 'taxonomy' => 'category', 'multiple' => true ),
			array( 'id' => 'author', 'type' => 'user', 'label' => 'Author' ),
			array(
				'id'         => 'header_buttons',
				'type'       => 'group',
				'label'      => 'Header buttons',
				'item_title' => 'label',
				'addable'    => true,
				'fields'     => array(
					array( 'id' => 'label', 'type' => 'text', 'label' => 'Label' ),
					array( 'id' => 'link', 'type' => 'url', 'label' => 'Link' ),
				),
			),
			array( 'id' => 'opening_hours', 'type' => 'custom', 'label' => 'Opening hours', 'module' => 'https://example.com/wp-content/plugins/acme/hours.js' ),
		);
	}

	private static function instance(): Instance {
		$instance = new Instance( 'golden', array() );
		$instance->add_page(
			'settings',
			array(
				'title'    => 'Settings',
				'sections' => array(
					array(
						'id'     => 'main',
						'title'  => 'Main',
						'fields' => self::fields(),
					),
				),
			)
		);

		return $instance;
	}

	public function test_every_field_type_that_stores_a_value_has_an_entry(): void {
		$types = array();
		foreach ( FieldFactory::classes() as $class ) {
			foreach ( $class::types() as $type ) {
				if ( 'notice' !== $type ) { // Display only: never stored.
					$types[] = $type;
				}
			}
		}

		$covered = array_values( array_unique( array_column( self::fields(), 'type' ) ) );
		sort( $types );
		sort( $covered );
		$this->assertSame( $types, $covered, 'A new field type needs a stored value in stored-values-v1.json and a field here.' );

		$ids = array_column( self::fields(), 'id' );
		sort( $ids );
		$stored = array_keys( self::golden()['stored'] );
		sort( $stored );
		$this->assertSame( $ids, $stored, 'Every stored entry has its field, and every field its entry.' );
	}

	public function test_all_returns_every_stored_value_unchanged(): void {
		$golden = self::golden();
		update_option( $golden['option'], $golden['stored'] );

		$values = self::instance()->all( 'settings' );

		$this->assertSame( array(), $GLOBALS['__fyldo_test_wrong'], 'the schema registers without errors' );
		$this->assertSame( count( $golden['stored'] ), count( $values ) );
		foreach ( $golden['stored'] as $id => $stored ) {
			$this->assertArrayHasKey( $id, $values );
			$this->assertSame( $stored, $values[ $id ], sprintf( 'Field "%s" no longer reads its stored 1.x value (option "%s").', $id, $golden['option'] ) );
		}
	}
}
