<?php
/**
 * Fyldo::icon() / Fyldo::is_icon(): one icon's SVG on the server.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Fyldo;
use Fyldo\V1\Support\IconNames;
use Fyldo\V1\Support\Icons;
use PHPUnit\Framework\TestCase;

final class IconsTest extends TestCase {

	/** The modules are built into assets/dist (not in git): the tests read a few copied from a build. */
	private const FIXTURES = __DIR__ . '/../../fixtures/icons';

	protected function setUp(): void {
		Icons::use_directory( self::FIXTURES );
	}

	protected function tearDown(): void {
		Icons::use_directory( null );
	}

	public function test_is_icon_knows_the_iconsax_names_only(): void {
		$this->assertTrue( Fyldo::is_icon( 'home-2' ) );
		$this->assertTrue( Fyldo::is_icon( 'setting-2' ) );
		$this->assertTrue( Fyldo::is_icon( '3d-cube-scan' ) );
		$this->assertFalse( Fyldo::is_icon( 'home2' ), 'the module key is not the name' );
		$this->assertFalse( Fyldo::is_icon( 'Home-2' ) );
		$this->assertFalse( Fyldo::is_icon( 'no-such-icon' ) );
		$this->assertFalse( Fyldo::is_icon( '' ) );
		$this->assertGreaterThan( 900, count( IconNames::ALL ) );
		$this->assertSame( IconNames::ALL, array_values( array_unique( IconNames::ALL ) ) );
	}

	public function test_icon_is_one_safe_svg_in_current_color(): void {
		$svg = Fyldo::icon( 'heart' );

		$this->assertStringStartsWith( '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path ', $svg );
		$this->assertStringEndsWith( '</svg>', $svg );
		$this->assertStringContainsString( 'stroke="currentColor"', $svg );
		$this->assertStringContainsString( 'stroke-width="1.5"', $svg, 'attributes in kebab case' );
		$this->assertStringContainsString( 'stroke-linecap="round"', $svg );
		$this->assertStringNotContainsString( 'strokeWidth', $svg );
	}

	public function test_size_class_and_label(): void {
		$svg = Fyldo::icon(
			'home-2',
			array(
				'size'  => 20,
				'class' => 'menu-icon "x"',
				'label' => 'Home',
			)
		);

		$this->assertStringStartsWith( '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="menu-icon &quot;x&quot;" role="img" aria-label="Home" focusable="false">', $svg );
		$this->assertStringNotContainsString( 'aria-hidden', $svg );
	}

	public function test_groups_keep_their_children(): void {
		$svg = Fyldo::icon( 'pen-close' );

		$this->assertMatchesRegularExpression( '#<g><path [^>]*stroke-miterlimit="10"[^>]*/>.*</g>#', $svg );
	}

	public function test_unknown_names_and_paths_are_empty(): void {
		$this->assertSame( '', Fyldo::icon( 'no-such-icon' ) );
		$this->assertSame( '', Fyldo::icon( 'home2' ) );
		$this->assertSame( '', Fyldo::icon( '../../../wp-config' ), 'a path is not an icon name' );
		$this->assertSame( '', Fyldo::icon( 'setting-2' ), 'an icon whose module is missing draws nothing' );
	}

	public function test_only_known_elements_and_attributes_survive(): void {
		Icons::use_directory( self::FIXTURES . '/hostile' );
		$svg = Fyldo::icon( 'heart' );

		$this->assertSame( '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M1 1&quot; onload=&quot;alert(1)" stroke-width="1.5"><path d="M2 2"/></path></svg>', $svg );
	}
}
