<?php
/**
 * A plugin's theme: the steps it may set (those of Figma's Theme collection), validation, and the root element's style.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Admin\Screen;
use Fyldo\V1\Demo\Demo;
use Fyldo\V1\Instance;
use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Support\Theme;
use PHPUnit\Framework\TestCase;

final class ThemeTest extends TestCase {

	public function test_the_steps_are_the_variables_of_the_figma_theme_collection(): void {
		$snapshot = json_decode( (string) file_get_contents( dirname( __DIR__, 3 ) . '/tokens/figma.tokens.json' ), true );
		$figma    = array();
		foreach ( $snapshot['tokens'] as $token ) {
			if ( 0 === strpos( $token['name'], 'theme.' ) ) {
				$figma[] = substr( $token['name'], strlen( 'theme.' ) );
			}
		}

		$php = array();
		foreach ( Theme::STEPS as $ramp => $steps ) {
			foreach ( $steps as $step ) {
				$php[] = $ramp . '.' . $step;
			}
		}
		sort( $figma );
		sort( $php );

		$this->assertSame( $figma, $php );
	}

	public function test_a_theme_becomes_custom_properties_on_the_root(): void {
		$instance = new Instance(
			'pelk',
			array(
				'title' => 'Pelk',
				'theme' => array(
					'brand'   => array(
						600   => '#FF6B4A', // integer key, upper case: both accepted.
						'700' => '#c8401f',
					),
					'neutral' => array(
						'1000'    => '#1c1a2b',
						'overlay' => '#15131f73',
					),
				),
			)
		);

		$this->assertSame(
			array(
				'--fyldo-theme-brand-600'       => '#ff6b4a',
				'--fyldo-theme-brand-700'       => '#c8401f',
				'--fyldo-theme-neutral-1000'    => '#1c1a2b',
				'--fyldo-theme-neutral-overlay' => '#15131f73',
			),
			$instance->theme()
		);

		ob_start();
		Screen::render( $instance );
		$html = (string) ob_get_clean();
		$this->assertStringContainsString(
			'class="fyldo-root" style="--fyldo-theme-brand-600:#ff6b4a;--fyldo-theme-brand-700:#c8401f;--fyldo-theme-neutral-1000:#1c1a2b;--fyldo-theme-neutral-overlay:#15131f73;"></div>',
			$html
		);
	}

	public function test_the_demo_sample_theme_sets_every_step(): void {
		require_once dirname( __DIR__, 3 ) . '/demo/demo.php'; // Not autoloaded (fyldo.php requires it).
		$this->assertCount( 26, Theme::normalize( 'fyldo-demo', Demo::SAMPLE_THEME ) );
	}

	public function test_without_a_theme_the_root_has_no_style(): void {
		$instance = new Instance( 'acme-seo', array() );

		ob_start();
		Screen::render( $instance );
		$html = (string) ob_get_clean();

		$this->assertSame( array(), $instance->theme() );
		$this->assertStringContainsString( 'class="fyldo-root"></div>', $html );
	}

	/**
	 * @return array<string,array{0:mixed,1:string}>
	 */
	public function invalid_themes(): array {
		return array(
			'not an array'   => array( '#ff6b4a', 'theme must be an array of ramps' ),
			'unknown ramp'   => array( array( 'accent' => array() ), 'unknown theme ramp(s): accent' ),
			'ramp not array' => array( array( 'brand' => '#ff6b4a' ), 'theme.brand must be an array' ),
			'unknown step'   => array( array( 'brand' => array( 1000 => '#000000' ) ), 'unknown theme.brand step(s): 1000' ),
			'not a hex'      => array( array( 'brand' => array( 600 => 'coral' ) ), 'theme.brand.600 must be a hex colour' ),
			'css injection'  => array( array( 'neutral' => array( 100 => '#fff;color:red' ) ), 'theme.neutral.100 must be a hex colour' ),
			'5 hex digits'   => array( array( 'neutral' => array( 100 => '#fffff' ) ), 'theme.neutral.100 must be a hex colour' ),
		);
	}

	/**
	 * @dataProvider invalid_themes
	 *
	 * @param mixed  $theme   Config value.
	 * @param string $message Expected part of the message.
	 */
	public function test_an_invalid_theme_is_a_config_error( $theme, string $message ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( $message );

		new Instance( 'pelk', array( 'theme' => $theme ) );
	}
}
