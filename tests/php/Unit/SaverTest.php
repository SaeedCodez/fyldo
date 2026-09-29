<?php
/**
 * sanitize → validate → merge → store.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Instance;
use PHPUnit\Framework\TestCase;

final class SaverTest extends TestCase {

	/** @var Instance */
	private $instance;

	protected function setUp(): void {
		$GLOBALS['__fyldo_test_options']  = array();
		$GLOBALS['__fyldo_test_autoload'] = array();
		$GLOBALS['__fyldo_test_fired']    = array();
		$GLOBALS['__fyldo_test_wrong']    = array();

		$this->instance = new Instance( 'acme-seo', array( 'title' => 'Acme SEO' ) );
		$this->instance->add_page(
			'general',
			array(
				'title'    => 'General',
				'sections' => array(
					array(
						'id'     => 'identity',
						'title'  => 'Site identity',
						'fields' => array(
							array( 'id' => 'site_title', 'type' => 'text', 'label' => 'Site title', 'default' => 'My site', 'validate' => array( 'required' => true, 'max_length' => 10 ) ),
							array( 'id' => 'maintenance', 'type' => 'toggle', 'label' => 'Maintenance' ),
							array( 'id' => 'language', 'type' => 'select', 'label' => 'Language', 'options' => array( 'en_US' => 'English', 'fa_IR' => 'فارسی' ), 'default' => 'en_US' ),
							array( 'id' => 'locked', 'type' => 'text', 'label' => 'Locked', 'default' => 'fixed', 'disabled' => 'Set in wp-config.php' ),
						),
					),
				),
			)
		);
	}

	public function test_values_fall_back_to_defaults(): void {
		$this->assertSame(
			array( 'site_title' => 'My site', 'maintenance' => false, 'language' => 'en_US', 'locked' => 'fixed' ),
			$this->instance->all( 'general' )
		);
		$this->assertSame( 'My site', $this->instance->get( 'general', 'site_title' ) );
		$this->assertSame( 'fallback', $this->instance->get( 'general', 'nope', 'fallback' ) );
		$this->assertSame( array(), $this->instance->all( 'missing-page' ) );
	}

	public function test_a_valid_partial_save_merges_and_persists_without_autoload(): void {
		$result = $this->instance->update( 'general', array( 'site_title' => '  New  ', 'maintenance' => 'true' ) );

		$this->assertSame( 'ok', $result['status'] );
		$this->assertSame( 'New', $result['values']['site_title'] );
		$this->assertTrue( $result['values']['maintenance'] );
		$this->assertSame( array( 'site_title' => 'New', 'maintenance' => true ), $GLOBALS['__fyldo_test_options']['acme-seo_general'] );
		$this->assertFalse( $GLOBALS['__fyldo_test_autoload']['acme-seo_general'], 'Options must not autoload.' );

		// A second, partial save keeps what was stored.
		$this->instance->update( 'general', array( 'language' => 'fa_IR' ) );
		$this->assertSame( 'New', $this->instance->get( 'general', 'site_title' ) );
		$this->assertSame( 'fa_IR', $this->instance->get( 'general', 'language' ) );
	}

	public function test_invalid_values_block_the_whole_save_and_report_per_field(): void {
		$result = $this->instance->update( 'general', array( 'site_title' => '', 'maintenance' => true, 'language' => 'de_DE' ) );

		$this->assertSame( 'invalid', $result['status'] );
		$this->assertSame( array( 'site_title', 'language' ), array_keys( $result['errors'] ) );
		$this->assertSame( 'This field is required.', $result['errors']['site_title'] );
		$this->assertArrayNotHasKey( 'acme-seo_general', $GLOBALS['__fyldo_test_options'], 'Nothing is stored when anything is invalid.' );
	}

	public function test_unknown_ids_are_dropped_and_disabled_fields_cannot_change(): void {
		$this->instance->update( 'general', array( 'site_title' => 'Ok', 'evil' => 'x', 'locked' => 'hacked' ) );

		$stored = $GLOBALS['__fyldo_test_options']['acme-seo_general'];
		$this->assertArrayNotHasKey( 'evil', $stored );
		$this->assertArrayNotHasKey( 'locked', $stored );
		$this->assertSame( 'fixed', $this->instance->get( 'general', 'locked' ) );
	}

	public function test_a_stored_value_that_no_longer_validates_reads_as_the_default(): void {
		$GLOBALS['__fyldo_test_options']['acme-seo_general'] = array( 'language' => 'removed_option', 'site_title' => 'Kept' );

		$this->assertSame( 'en_US', $this->instance->get( 'general', 'language' ) );
		$this->assertSame( 'Kept', $this->instance->get( 'general', 'site_title' ) );
	}

	public function test_stale_revision_is_a_conflict_and_nothing_is_written(): void {
		$page     = $this->instance->page( 'general' );
		$revision = $this->instance->store()->revision( $page );

		$saver = new \Fyldo\V1\Storage\Saver( $this->instance );
		$this->assertSame( 'ok', $saver->save( $page, array( 'site_title' => 'A' ), $revision )['status'] );

		$stale = $saver->save( $page, array( 'site_title' => 'B' ), $revision );
		$this->assertSame( 'conflict', $stale['status'] );
		$this->assertSame( 'A', $stale['values']['site_title'] );
		$this->assertSame( 'A', $GLOBALS['__fyldo_test_options']['acme-seo_general']['site_title'] );
		$this->assertNotSame( $revision, $stale['revision'] );
	}

	public function test_a_null_revision_skips_the_concurrency_check(): void {
		$page  = $this->instance->page( 'general' );
		$saver = new \Fyldo\V1\Storage\Saver( $this->instance );

		$this->assertSame( 'ok', $saver->save( $page, array( 'site_title' => 'A' ), null )['status'] );
		$this->assertSame( 'ok', $saver->save( $page, array( 'site_title' => 'B' ), null )['status'] );
	}

	public function test_revision_is_stable_for_equal_content_and_changes_with_it(): void {
		$page = $this->instance->page( 'general' );
		$a    = $this->instance->store()->revision( $page );
		$this->assertSame( $a, $this->instance->store()->revision( $page ) );

		$this->instance->update( 'general', array( 'site_title' => 'Changed' ) );
		$this->assertNotSame( $a, $this->instance->store()->revision( $page ) );
	}

	public function test_hooks_fire_with_slug_scoped_names(): void {
		$this->instance->update( 'general', array( 'site_title' => 'Hooked' ) );

		$names = array_column( $GLOBALS['__fyldo_test_fired'], 0 );
		$this->assertSame( array( 'fyldo/acme-seo/before_save', 'fyldo/acme-seo/saved' ), $names );
		$this->assertSame( 'general', $GLOBALS['__fyldo_test_fired'][0][1] );
	}

	public function test_updating_an_unknown_page_is_reported_not_fatal(): void {
		$result = $this->instance->update( 'nope', array() );

		$this->assertSame( 'invalid', $result['status'] );
	}
}
