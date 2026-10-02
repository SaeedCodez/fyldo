<?php
/**
 * Field type `icon`.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Fields\FieldFactory;
use Fyldo\V1\Fields\IconField;
use Fyldo\V1\Schema\ConfigException;
use PHPUnit\Framework\TestCase;

final class IconFieldTest extends TestCase {

	private function icon( array $extra = array() ) {
		return FieldFactory::create( array_merge( array( 'id' => 'menu_icon', 'type' => 'icon', 'label' => 'Menu icon' ), $extra ) );
	}

	public function test_the_defaults_are_empty_in_the_field_layout_and_offer_every_icon(): void {
		$field  = $this->icon();
		$client = $field->to_client();

		$this->assertSame( array( 'icon' ), $field::types() );
		$this->assertSame( '', $field->default_value() );
		$this->assertSame( 'field', $client['layout'] );
		$this->assertNull( $client['icons'], 'null = every Iconsax icon; the names are not known to PHP' );
		$this->assertEquals( (object) array( 'pattern' => IconField::PATTERN ), $client['validate'] );
	}

	public function test_icons_restricts_the_picker_and_the_server(): void {
		$field = $this->icon( array( 'icons' => array( 'home-2', 'setting-2', 'home-2' ), 'default' => 'home-2' ) );

		$this->assertSame( array( 'home-2', 'setting-2' ), $field->to_client()['icons'], 'de-duplicated, in the given order' );
		$this->assertSame( 'home-2', $field->default_value() );
		$this->assertEquals( (object) array( 'pattern' => IconField::PATTERN, 'allowed' => array( 'home-2', 'setting-2' ) ), $field->to_client()['validate'] );

		$this->assertNull( $field->validate( $field->sanitize( 'setting-2' ) ) );
		$this->assertNull( $field->validate( $field->sanitize( '' ) ), 'optional' );
		$this->assertSame( 'Choose one of the available options.', $field->validate( $field->sanitize( 'user' ) ) );
	}

	public function test_without_icons_any_well_formed_name_is_accepted_and_malformed_ones_are_not(): void {
		$field = $this->icon();

		$this->assertNull( $field->validate( $field->sanitize( ' setting-2 ' ) ), 'trimmed' );
		$this->assertNull( $field->validate( $field->sanitize( 'not-an-icon-the-browser-knows' ) ) );
		$this->assertSame( 'This value is not in the expected format.', $field->validate( $field->sanitize( 'Setting-2' ) ) );
		$this->assertSame( 'This value is not in the expected format.', $field->validate( $field->sanitize( 'a--b' ) ) );
		$this->assertSame( 'This value is not in the expected format.', $field->validate( $field->sanitize( '<svg onload=x>' ) ) );
		$this->assertSame( '', $field->sanitize( array( 'home-2' ) ), 'not text is nothing' );
		$this->assertSame( '', $field->sanitize( null ) );
	}

	public function test_required_rejects_an_empty_value(): void {
		$field = $this->icon( array( 'validate' => array( 'required' => true ) ) );

		$this->assertSame( 'This field is required.', $field->validate( $field->sanitize( '' ) ) );
		$this->assertSame( 'This field is required.', $field->validate( $field->sanitize( null ) ) );
		$this->assertNull( $field->validate( $field->sanitize( 'home-2' ) ) );
		$this->assertEquals( (object) array( 'required' => true, 'pattern' => IconField::PATTERN ), $field->to_client()['validate'] );
	}

	/**
	 * @dataProvider invalid_configs
	 *
	 * @param array<string,mixed> $config  Field config.
	 * @param string              $message Expected fragment of the exception message.
	 */
	public function test_bad_config_fails_loudly( array $config, string $message ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( $message );
		$this->icon( $config );
	}

	public function invalid_configs(): array {
		return array(
			'icons empty'                => array( array( 'icons' => array() ), '`icons` must be a non-empty list' ),
			'icons a string'             => array( array( 'icons' => 'home-2' ), '`icons` must be a non-empty list' ),
			'icons with a bad name'      => array( array( 'icons' => array( 'home-2', 'Home 2' ) ), '"Home 2" in `icons` is not an icon name' ),
			'icons with a double hyphen' => array( array( 'icons' => array( 'home--2' ) ), '"home--2" in `icons` is not an icon name' ),
			'icons with a non-string'    => array( array( 'icons' => array( 5 ) ), '"5" in `icons` is not an icon name' ),
			'default not a name'         => array( array( 'default' => 'Home 2' ), '`default` must be an icon name' ),
			'default not text'           => array( array( 'default' => 5 ), '`default` must be an icon name' ),
			'default outside icons'      => array( array( 'icons' => array( 'home-2' ), 'default' => 'user' ), '`default` "user" is not in `icons`' ),
			'unknown key'                => array( array( 'size' => 'lg' ), 'unknown key(s): size' ),
		);
	}
}
