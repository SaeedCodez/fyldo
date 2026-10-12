<?php
/**
 * `default_before`: a plugin update keeps the defaults a site already had (docs/default-history.md).
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Instance;
use Fyldo\V1\Fields\FieldFactory;
use Fyldo\V1\Schema\ConfigException;
use PHPUnit\Framework\TestCase;

final class DefaultHistoryTest extends TestCase {

	const STATE = 'my-blog__fyldo';
	const PAGE  = 'my-blog_general';

	protected function setUp(): void {
		$GLOBALS['__fyldo_test_options']  = array();
		$GLOBALS['__fyldo_test_autoload'] = array();
		$GLOBALS['__fyldo_test_fired']    = array();
		$GLOBALS['__fyldo_test_wrong']    = array();
	}

	/**
	 * The plugin as it is in `$version`, registered the way it is on every request.
	 *
	 * @param array<int,array<string,mixed>> $fields Field configs (default: the posts-per-page history 10 → 20 → 30).
	 */
	private function boot( string $version, array $fields = array() ): Instance {
		$instance = new Instance( 'my-blog', array( 'version' => $version ) );
		$instance->add_page(
			'general',
			array(
				'title'    => 'General',
				'sections' => array(
					array(
						'id'     => 'main',
						'title'  => 'Main',
						'fields' => array() !== $fields ? $fields : array( self::posts_per_page( $version ) ),
					),
				),
			)
		);

		return $instance;
	}

	/**
	 * `posts_per_page` as each release declares it: 10 in 1.x, 20 in 2.x, 30 from 3.0.
	 *
	 * @return array<string,mixed>
	 */
	private static function posts_per_page( string $version ): array {
		if ( version_compare( $version, '2.0.0', '<' ) ) {
			return array(
				'id'      => 'posts_per_page',
				'type'    => 'number',
				'label'   => 'Posts',
				'default' => 10,
			);
		}
		if ( version_compare( $version, '3.0.0', '<' ) ) {
			return array(
				'id'             => 'posts_per_page',
				'type'           => 'number',
				'label'          => 'Posts',
				'default'        => 20,
				'default_before' => array( '2.0.0' => 10 ),
			);
		}

		return array(
			'id'             => 'posts_per_page',
			'type'           => 'number',
			'label'          => 'Posts',
			'default'        => 30,
			'default_before' => array(
				'3.0.0' => 20,
				'2.0.0' => 10,
			),
		);
	}

	private function posts( string $version ): int {
		return (int) $this->boot( $version )->get( 'general', 'posts_per_page' );
	}

	public function test_a_new_site_gets_todays_default_and_only_the_version_is_recorded(): void {
		$this->assertSame( 30, $this->posts( '3.0.0' ) );
		$this->assertArrayNotHasKey( self::PAGE, $GLOBALS['__fyldo_test_options'] );
		$this->assertSame( array( 'pages' => array( 'general' => '3.0.0' ) ), $GLOBALS['__fyldo_test_options'][ self::STATE ] );
		$this->assertTrue( $GLOBALS['__fyldo_test_autoload'][ self::STATE ], 'The version is read on every request: autoloaded.' );
	}

	public function test_a_site_that_jumps_from_1_to_3_keeps_10(): void {
		$this->assertSame( 10, $this->posts( '1.0.0' ) );
		$this->assertSame( 10, $this->posts( '3.0.0' ) );
		$this->assertSame( array( 'posts_per_page' => 10 ), $GLOBALS['__fyldo_test_options'][ self::PAGE ] );
		$this->assertFalse( $GLOBALS['__fyldo_test_autoload'][ self::PAGE ], 'Page options stay off autoload.' );
	}

	public function test_a_site_installed_on_2_keeps_20(): void {
		$this->assertSame( 20, $this->posts( '2.0.0' ) );
		$this->assertSame( 20, $this->posts( '3.0.0' ) );
	}

	public function test_a_site_that_updates_step_by_step_keeps_10(): void {
		$this->assertSame( 10, $this->posts( '1.0.0' ) );
		$this->assertSame( 10, $this->posts( '2.0.0' ) );
		$this->assertSame( 10, $this->posts( '3.0.0' ) );
	}

	public function test_a_saved_value_is_never_touched(): void {
		$this->boot( '1.0.0' )->update( 'general', array( 'posts_per_page' => 15 ) );

		$this->assertSame( 15, $this->posts( '3.0.0' ) );
		$this->assertSame( array( 'posts_per_page' => 15 ), $GLOBALS['__fyldo_test_options'][ self::PAGE ] );
	}

	public function test_it_runs_once_per_version(): void {
		$this->posts( '1.0.0' );
		$this->posts( '3.0.0' );
		$GLOBALS['__fyldo_test_options'][ self::PAGE ] = array(); // Reset from the Danger card: today's default again.

		$this->assertSame( 30, $this->posts( '3.0.0' ), 'The same version again does nothing.' );
	}

	public function test_the_upgraded_hook_fires_with_both_versions_and_no_save_hooks(): void {
		$this->posts( '1.0.0' );
		$GLOBALS['__fyldo_test_fired'] = array();
		$this->posts( '3.0.0' );

		$this->assertSame( array( array( 'fyldo/my-blog/upgraded', 'general', '1.0.0', '3.0.0' ) ), $GLOBALS['__fyldo_test_fired'] );
	}

	public function test_a_downgrade_only_records_the_version(): void {
		$this->posts( '3.0.0' );
		$GLOBALS['__fyldo_test_fired'] = array();

		$this->assertSame( 20, $this->posts( '2.0.0' ) );
		$this->assertArrayNotHasKey( self::PAGE, $GLOBALS['__fyldo_test_options'] );
		$this->assertSame( '2.0.0', $GLOBALS['__fyldo_test_options'][ self::STATE ]['pages']['general'] );
		$this->assertSame( array(), $GLOBALS['__fyldo_test_fired'] );
	}

	public function test_a_default_changed_back_writes_nothing(): void {
		$field = array(
			'id'    => 'show_date',
			'type'  => 'toggle',
			'label' => 'Date',
		);

		$this->boot( '1.0.0', array( $field + array( 'default' => true ) ) );
		// 2.0 turned it off, 3.0 turned it on again; the site came from 1.0, where it was on.
		$instance = $this->boot(
			'3.0.0',
			array(
				$field + array(
					'default'        => true,
					'default_before' => array(
						'2.0.0' => true,
						'3.0.0' => false,
					),
				),
			)
		);

		$this->assertTrue( $instance->get( 'general', 'show_date' ) );
		$this->assertArrayNotHasKey( self::PAGE, $GLOBALS['__fyldo_test_options'] );
	}

	public function test_an_earlier_default_that_no_longer_validates_is_skipped(): void {
		$select = array(
			'id'      => 'layout',
			'type'    => 'select',
			'label'   => 'Layout',
			'options' => array(
				'grid' => 'Grid',
				'list' => 'List',
			),
		);

		$this->boot( '1.0.0', array( $select + array( 'default' => 'grid' ) ) );
		$instance = $this->boot(
			'2.0.0',
			array(
				$select + array(
					'default'        => 'list',
					'default_before' => array( '2.0.0' => 'masonry' ),
				),
			)
		);

		$this->assertSame( 'list', $instance->get( 'general', 'layout' ) );
		$this->assertArrayNotHasKey( self::PAGE, $GLOBALS['__fyldo_test_options'] );
	}

	public function test_only_the_fields_that_changed_are_stored_and_disabled_fields_too(): void {
		$fields = static function ( string $version ): array {
			$v2 = version_compare( $version, '2.0.0', '>=' );
			return array(
				array(
					'id'      => 'title',
					'type'    => 'text',
					'label'   => 'Title',
					'default' => 'Blog',
				),
				array(
					'id'       => 'mode',
					'type'     => 'text',
					'label'    => 'Mode',
					'disabled' => true,
					'default'  => $v2 ? 'b' : 'a',
				) + ( $v2 ? array( 'default_before' => array( '2.0.0' => 'a' ) ) : array() ),
			);
		};

		$this->boot( '1.0.0', $fields( '1.0.0' ) );
		$this->boot( '2.0.0', $fields( '2.0.0' ) );

		$this->assertSame( array( 'mode' => 'a' ), $GLOBALS['__fyldo_test_options'][ self::PAGE ] );
	}

	public function test_a_page_added_in_a_later_version_starts_fresh(): void {
		$this->boot( '1.0.0' );
		$instance = $this->boot( '2.0.0' );
		$instance->add_page(
			'extra',
			array(
				'title'    => 'Extra',
				'sections' => array(
					array(
						'id'     => 'main',
						'title'  => 'Main',
						'fields' => array(
							array(
								'id'             => 'size',
								'type'           => 'number',
								'label'          => 'Size',
								'default'        => 2,
								'default_before' => array( '2.0.0' => 1 ),
							),
						),
					),
				),
			)
		);

		$this->assertSame( 2, $instance->get( 'extra', 'size' ) );
		$this->assertSame(
			array(
				'general' => '2.0.0',
				'extra'   => '2.0.0',
			),
			$GLOBALS['__fyldo_test_options'][ self::STATE ]['pages']
		);
	}

	public function test_without_a_version_nothing_is_tracked(): void {
		$instance = new Instance( 'my-blog', array() );
		$instance->add_page(
			'general',
			array(
				'title'    => 'General',
				'sections' => array(
					array(
						'id'     => 'main',
						'title'  => 'Main',
						'fields' => array(
							array(
								'id'    => 'a',
								'type'  => 'text',
								'label' => 'A',
							),
						),
					),
				),
			)
		);

		$this->assertSame( array(), $GLOBALS['__fyldo_test_options'] );
	}

	public function test_default_at_reads_the_history(): void {
		$field = FieldFactory::create(
			array(
				'id'             => 'n',
				'type'           => 'number',
				'label'          => 'N',
				'default'        => 30,
				'default_before' => array(
					'3.0.0' => 20,
					'2.0.0' => 10,
				),
			)
		);

		$this->assertSame(
			array(
				'2.0.0' => 10,
				'3.0.0' => 20,
			),
			$field->default_before(),
			'Sorted oldest first.'
		);
		$this->assertSame( 10, $field->default_at( '1.9.9' ) );
		$this->assertSame( 20, $field->default_at( '2.0.0' ) );
		$this->assertSame( 20, $field->default_at( '3.0.0-beta.1' ) );
		$this->assertSame( 30, $field->default_at( '3.0.0' ) );
		$this->assertSame( 30, $field->default_at( '4.1' ) );
	}

	/**
	 * @return array<string,array{0:array<string,mixed>,1:string}>
	 */
	public static function invalid_fields(): array {
		return array(
			'not an array'         => array(
				array(
					'id'             => 'a',
					'type'           => 'text',
					'label'          => 'A',
					'default_before' => 'x',
				),
				'must be an array',
			),
			'key is not a version' => array(
				array(
					'id'             => 'a',
					'type'           => 'text',
					'label'          => 'A',
					'default_before' => array( 'next' => 'x' ),
				),
				'must be version numbers',
			),
			'password'             => array(
				array(
					'id'             => 'a',
					'type'           => 'password',
					'label'          => 'A',
					'default_before' => array( '2.0.0' => 'x' ),
				),
				'cannot have a `default` or `default_before`',
			),
			'group sub-field'      => array(
				array(
					'id'      => 'g',
					'type'    => 'group',
					'label'   => 'G',
					'addable' => true,
					'fields'  => array(
						array(
							'id'             => 'a',
							'type'           => 'text',
							'label'          => 'A',
							'default_before' => array( '2.0.0' => 'x' ),
						),
					),
				),
				'a sub-field cannot have `default_before`',
			),
			'notice'               => array(
				array(
					'id'             => 'a',
					'type'           => 'notice',
					'description'    => 'Hi',
					'default_before' => array( '2.0.0' => 'x' ),
				),
				'unknown key(s): default_before',
			),
		);
	}

	/**
	 * @dataProvider invalid_fields
	 * @param array<string,mixed> $config Field config.
	 */
	public function test_invalid_field_history_is_a_config_error( array $config, string $message ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( $message );

		FieldFactory::create( $config );
	}

	public function test_history_needs_a_version_and_no_later_entries(): void {
		$field = array(
			'id'      => 'n',
			'type'    => 'number',
			'label'   => 'N',
			'default' => 2,
		);

		$no_version = new Instance( 'my-blog', array() );
		$no_version->add_page(
			'general',
			array(
				'title'    => 'G',
				'sections' => array(
					array(
						'id'     => 'm',
						'title'  => 'M',
						'fields' => array( $field + array( 'default_before' => array( '2.0.0' => 1 ) ) ),
					),
				),
			)
		);
		$this->assertNull( $no_version->page( 'general' ) );
		$this->assertStringContainsString( 'needs the instance `version`', $GLOBALS['__fyldo_test_wrong'][0] );

		$this->boot( '2.0.0', array( $field + array( 'default_before' => array( '2.1.0' => 1 ) ) ) );
		$this->assertStringContainsString( 'which is later than the instance version', $GLOBALS['__fyldo_test_wrong'][1] );
		$this->assertArrayNotHasKey( self::STATE, $GLOBALS['__fyldo_test_options'], 'A skipped page records nothing.' );
	}

	public function test_a_group_keeps_its_earlier_items(): void {
		$group = array(
			'id'      => 'buttons',
			'type'    => 'group',
			'label'   => 'Buttons',
			'addable' => true,
			'fields'  => array(
				array(
					'id'    => 'label',
					'type'  => 'text',
					'label' => 'Label',
				),
			),
		);

		$this->boot( '1.0.0', array( $group + array( 'default' => array( array( 'label' => 'Docs' ) ) ) ) );
		$instance = $this->boot(
			'2.0.0',
			array(
				$group + array(
					'default'        => array(),
					'default_before' => array( '2.0.0' => array( array( 'label' => 'Docs' ) ) ),
				),
			)
		);

		$this->assertSame( array( array( 'label' => 'Docs' ) ), $instance->get( 'general', 'buttons' ) );
	}
}
