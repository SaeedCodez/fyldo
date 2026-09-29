<?php
/**
 * Every runtime-global identifier derives from the slug and the namespace.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Support\Naming;
use PHPUnit\Framework\TestCase;

final class NamingTest extends TestCase {

	public function test_namespace_and_major_come_from___NAMESPACE__(): void {
		$this->assertSame( 'Fyldo\\V1', Naming::ns() );
		$this->assertSame( 1, Naming::major() );
		$this->assertSame( 'fyldo-v1', Naming::vendor_slug() );
		$this->assertSame( 'data-fyldo-v1', Naming::root_attribute() );
	}

	public function test_identifiers_for_a_slug(): void {
		$this->assertSame( 'acme-seo_general', Naming::option( 'acme-seo', 'general' ) );
		$this->assertSame( 'fyldo-acme-seo/v1', Naming::rest_namespace( 'acme-seo' ) );
		$this->assertSame( 'fyldo-acme-seo-1.4.2', Naming::handle( 'acme-seo', '1.4.2' ) );
		$this->assertSame( 'fyldo-acme-seo-fonts-1.4.2', Naming::fonts_handle( 'acme-seo', '1.4.2' ) );
		$this->assertSame( '__fyldo_acme_seo__', Naming::config_var( 'acme-seo' ) );
		$this->assertSame( 'fyldo_acme-seo_rest', Naming::nonce_action( 'acme-seo' ) );
		$this->assertSame( 'fyldo/acme-seo/saved', Naming::hook( 'acme-seo', 'saved' ) );
		$this->assertSame( 'fyldo-acme-seo-root', Naming::dom_id( 'acme-seo' ) );
	}

	public function test_two_slugs_never_share_an_identifier(): void {
		$methods = array( 'rest_namespace', 'dom_id', 'config_var', 'nonce_action' );
		foreach ( $methods as $method ) {
			$this->assertNotSame( Naming::$method( 'acme-a' ), Naming::$method( 'acme-b' ), $method );
		}
		$this->assertNotSame( Naming::handle( 'acme-a', '1.0.0' ), Naming::handle( 'acme-b', '1.0.0' ) );
		$this->assertNotSame( Naming::hook( 'acme-a', 'saved' ), Naming::hook( 'acme-b', 'saved' ) );
	}

	/**
	 * @dataProvider slugs
	 */
	public function test_slug_validation( string $slug, bool $valid ): void {
		$this->assertSame( $valid, Naming::is_valid_slug( $slug ) );
	}

	public function slugs(): array {
		return array(
			'plain'             => array( 'acme-seo', true ),
			'digits'            => array( 'acme2-seo', true ),
			'min length'        => array( 'abc', true ),
			'too short'         => array( 'ab', false ),
			'max length'        => array( 'a' . str_repeat( 'b', 39 ), true ),
			'too long'          => array( 'a' . str_repeat( 'b', 40 ), false ),
			'uppercase'         => array( 'Acme-seo', false ),
			'underscore'        => array( 'acme_seo', false ),
			'starts with digit' => array( '1acme', false ),
			'space'             => array( 'acme seo', false ),
			'empty'             => array( '', false ),
			'slash'             => array( 'acme/seo', false ),
		);
	}

	public function test_page_id_validation(): void {
		$this->assertTrue( Naming::is_valid_page_id( 'general' ) );
		$this->assertTrue( Naming::is_valid_page_id( 'site_identity-2' ) );
		$this->assertFalse( Naming::is_valid_page_id( 'General' ) );
		$this->assertFalse( Naming::is_valid_page_id( '' ) );
		$this->assertFalse( Naming::is_valid_page_id( '../x' ) );
	}
}
