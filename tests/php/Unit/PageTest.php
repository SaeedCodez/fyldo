<?php
/**
 * Page/section normalisation and registration-time validation.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Schema\Page;
use PHPUnit\Framework\TestCase;

final class PageTest extends TestCase {

	private function config( array $overrides = array() ): array {
		return array_merge(
			array(
				'title'    => 'General',
				'sections' => array(
					array(
						'id'     => 'identity',
						'title'  => 'Site identity',
						'fields' => array(
							array( 'id' => 'site_title', 'type' => 'text', 'label' => 'Site title' ),
							array( 'id' => 'maintenance', 'type' => 'toggle', 'label' => 'Maintenance' ),
						),
					),
				),
			),
			$overrides
		);
	}

	public function test_default_option_name_is_slug_underscore_page_and_can_be_overridden(): void {
		$this->assertSame( 'acme-seo_general', ( new Page( 'acme-seo', 'general', $this->config() ) )->option_name() );
		$this->assertSame( 'acme_seo_general', ( new Page( 'acme-seo', 'general', $this->config( array( 'option_name' => 'acme_seo_general' ) ) ) )->option_name() );
	}

	public function test_defaults_and_client_export(): void {
		$page   = new Page( 'acme-seo', 'general', $this->config() );
		$client = $page->to_client( array( 'site_title' => 'X' ), 'rev1' );

		$this->assertSame( 'global', $page->save_mode() );
		$this->assertSame( 'rev1', $client['revision'] );
		$this->assertEquals( (object) array( 'site_title' => 'X' ), $client['values'] );
		$this->assertSame( 'identity', $client['sections'][0]['id'] );
		$this->assertSame( 'site_title', $client['sections'][0]['fields'][0]['id'] );
		$this->assertSame( array( 'site_title', 'maintenance' ), array_keys( $page->fields() ) );
	}

	/**
	 * @dataProvider invalid
	 */
	public function test_registration_errors( array $overrides, string $needle, string $id = 'general' ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessageMatches( '/' . preg_quote( $needle, '/' ) . '/i' );

		new Page( 'acme-seo', $id, $this->config( $overrides ) );
	}

	public function invalid(): array {
		$dup_field = array(
			array( 'id' => 'a', 'title' => 'A', 'fields' => array( array( 'id' => 'same', 'type' => 'text', 'label' => 'One' ) ) ),
			array( 'id' => 'b', 'title' => 'B', 'fields' => array( array( 'id' => 'same', 'type' => 'toggle', 'label' => 'Two' ) ) ),
		);
		$dup_section = array(
			array( 'id' => 'a', 'title' => 'A', 'fields' => array() ),
			array( 'id' => 'a', 'title' => 'A again', 'fields' => array() ),
		);
		$danger_first = array(
			array( 'id' => 'reset', 'title' => 'Reset', 'tone' => 'danger', 'fields' => array(), 'action' => array( 'id' => 'reset', 'label' => 'Reset settings' ) ),
			array( 'id' => 'other', 'title' => 'Other', 'fields' => array() ),
		);

		$danger_fields = array(
			array(
				'id'     => 'reset',
				'title'  => 'Reset',
				'tone'   => 'danger',
				'action' => array( 'id' => 'reset', 'label' => 'Reset' ),
				'fields' => array( array( 'id' => 'x', 'type' => 'toggle', 'label' => 'X' ) ),
			),
		);

		return array(
			'bad page id'        => array( array(), 'Page id', 'Bad Id' ),
			'missing title'      => array( array( 'title' => '' ), 'needs a title' ),
			'unknown key'        => array( array( 'colour' => 'red' ), 'unknown key' ),
			'bad save mode'      => array( array( 'save' => 'both' ), 'one pattern per page' ),
			'no sections'        => array( array( 'sections' => array() ), 'at least one section' ),
			'duplicate field id' => array( array( 'sections' => $dup_field ), 'duplicate field id' ),
			'duplicate section'  => array( array( 'sections' => $dup_section ), 'duplicate section id' ),
			'unknown tab'        => array( array( 'tabs' => array( 'reading' => 'Reading' ), 'sections' => array( array( 'id' => 'a', 'tab' => 'nope', 'title' => 'A', 'fields' => array() ) ) ), 'unknown tab' ),
			'danger not last'    => array( array( 'sections' => $danger_first ), 'danger sections must come last' ),
			'danger without action'  => array( array( 'sections' => array( array( 'id' => 'reset', 'title' => 'Reset', 'tone' => 'danger' ) ) ), 'needs an `action`' ),
			'danger with fields'     => array( array( 'sections' => $danger_fields ), 'not fields' ),
			'action on plain section' => array( array( 'sections' => array( array( 'id' => 'a', 'title' => 'A', 'action' => array( 'id' => 'reset' ) ) ) ), 'only a danger section' ),
			'unknown action id'      => array( array( 'sections' => array( array( 'id' => 'a', 'title' => 'A', 'tone' => 'danger', 'action' => array( 'id' => 'wipe', 'label' => 'Wipe' ) ) ) ), 'action id must be' ),
			'unknown action key'     => array( array( 'sections' => array( array( 'id' => 'a', 'title' => 'A', 'tone' => 'danger', 'action' => array( 'id' => 'reset', 'colour' => 'red' ) ) ) ), 'action has unknown' ),
			'unknown confirm key'    => array( array( 'sections' => array( array( 'id' => 'a', 'title' => 'A', 'tone' => 'danger', 'action' => array( 'id' => 'reset', 'confirm' => array( 'colour' => 'red' ) ) ) ) ), 'confirm has unknown' ),
			'keyword too long'       => array( array( 'sections' => array( array( 'id' => 'a', 'title' => 'A', 'tone' => 'danger', 'action' => array( 'id' => 'reset', 'confirm' => array( 'keyword' => str_repeat( 'x', 41 ) ) ) ) ) ), 'longer than 40' ),
			'option too long'    => array( array( 'option_name' => str_repeat( 'x', 192 ) ), '191' ),
			'bad tab id'         => array( array( 'tabs' => array( 'Site identity' => 'Site identity' ) ), 'tab id' ),
			'tab without label'  => array( array( 'tabs' => array( 'identity' => '' ) ), 'needs a label' ),
			'tab unknown key'    => array( array( 'tabs' => array( 'identity' => array( 'label' => 'Identity', 'colour' => 'red' ) ) ), 'unknown key' ),
			'tab badge array'    => array( array( 'tabs' => array( 'identity' => array( 'label' => 'Identity', 'badge' => array( 3 ) ) ) ), 'badge' ),
			'page badge bool'    => array( array( 'badge' => true ), 'badge' ),
		);
	}

	public function test_a_danger_section_exports_its_action_with_texts_left_for_the_browser_to_default(): void {
		$page = new Page(
			'acme-seo',
			'general',
			$this->config(
				array(
					'sections' => array(
						array( 'id' => 'a', 'title' => 'A', 'fields' => array( array( 'id' => 'x', 'type' => 'toggle', 'label' => 'X' ) ) ),
						array( 'id' => 'reset', 'title' => 'Reset settings', 'tone' => 'danger', 'action' => array( 'id' => 'reset', 'label' => ' Reset settings ', 'confirm' => array( 'keyword' => ' RESET ' ) ) ),
					),
				)
			)
		);

		$this->assertSame(
			array(
				'id'      => 'reset',
				'label'   => 'Reset settings',
				'confirm' => array( 'title' => '', 'description' => '', 'keyword' => 'RESET', 'label' => '' ),
			),
			$page->to_client( array(), '' )['sections'][1]['action']
		);
		$this->assertArrayNotHasKey( 'action', $page->to_client( array(), '' )['sections'][0] );
		$this->assertSame( 'reset', $page->danger_action( 'reset' )->id() );
		$this->assertNull( $page->danger_action( 'wipe' ) );
	}

	public function test_tabs_are_exported_in_order(): void {
		$page = new Page(
			'acme-seo',
			'general',
			$this->config(
				array(
					'tabs'     => array( 'identity' => 'Site identity', 'reading' => 'Reading' ),
					'sections' => array( array( 'id' => 'a', 'tab' => 'reading', 'title' => 'A', 'fields' => array() ) ),
				)
			)
		);

		$this->assertSame(
			array(
				array( 'id' => 'identity', 'label' => 'Site identity', 'icon' => '', 'badge' => '' ),
				array( 'id' => 'reading', 'label' => 'Reading', 'icon' => '', 'badge' => '' ),
			),
			$page->to_client( array(), '' )['tabs']
		);
	}

	public function test_a_tab_can_carry_an_icon_and_a_count_badge(): void {
		$page = new Page(
			'acme-seo',
			'general',
			$this->config(
				array(
					'tabs' => array(
						'identity' => 'Site identity',
						'alerts'   => array( 'label' => 'Alerts', 'icon' => 'notification', 'badge' => 3 ),
					),
				)
			)
		);

		$this->assertSame(
			array( 'id' => 'alerts', 'label' => 'Alerts', 'icon' => 'notification', 'badge' => '3' ),
			$page->to_client( array(), '' )['tabs'][1]
		);
	}

	public function test_the_nav_badge_is_exported_as_text(): void {
		$client = ( new Page( 'acme-seo', 'general', $this->config( array( 'badge' => 3 ) ) ) )->to_client( array(), '' );
		$this->assertSame( '3', $client['badge'] );

		$client = ( new Page( 'acme-seo', 'general', $this->config() ) )->to_client( array(), '' );
		$this->assertSame( '', $client['badge'], 'No badge by default.' );
	}
}
