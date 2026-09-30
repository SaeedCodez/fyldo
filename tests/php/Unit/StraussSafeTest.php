<?php
/**
 * The rules that keep Fyldo safe to re-prefix with Strauss (docs/ARCHITECTURE.md §7), enforced on the real sources:
 *   - no global functions, no define()/global constants, no $GLOBALS, no class_alias
 *   - no class names built from strings, no hard-coded namespace strings
 *   - every file is namespaced
 *
 * A prefixed copy was verified end to end in the e2e suite (acme-omega); this test stops the sources from drifting.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use PHPUnit\Framework\TestCase;

final class StraussSafeTest extends TestCase {

	/** @return string[] */
	private function sources(): array {
		$root  = dirname( __DIR__, 3 );
		$files = array( $root . '/fyldo.php' );
		foreach ( array( '/src', '/demo' ) as $dir ) {
			$it = new \RecursiveIteratorIterator( new \RecursiveDirectoryIterator( $root . $dir, \FilesystemIterator::SKIP_DOTS ) );
			foreach ( $it as $file ) {
				if ( 'php' === $file->getExtension() ) {
					$files[] = $file->getPathname();
				}
			}
		}
		sort( $files );

		return $files;
	}

	/**
	 * @return array<string,array{0:string}>
	 */
	public function source_files(): array {
		$out = array();
		foreach ( $this->sources() as $file ) {
			$out[ substr( $file, strlen( dirname( __DIR__, 3 ) ) + 1 ) ] = array( $file );
		}

		return $out;
	}

	/**
	 * @dataProvider source_files
	 */
	public function test_no_global_symbols_no_string_class_names( string $file ): void {
		$tokens = token_get_all( (string) file_get_contents( $file ) );
		$depth  = 0;
		$found  = array();
		$count  = count( $tokens );
		$has_ns = false;

		for ( $i = 0; $i < $count; $i++ ) {
			$token = $tokens[ $i ];

			if ( '{' === $token || ( is_array( $token ) && in_array( $token[0], array( T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES ), true ) ) ) {
				++$depth;
			} elseif ( '}' === $token ) {
				--$depth;
			}

			if ( ! is_array( $token ) ) {
				continue;
			}

			list( $id, $text ) = $token;

			if ( T_NAMESPACE === $id ) {
				$has_ns = true;
			}

			// A named function declared outside any class/function body = a global symbol.
			if ( T_FUNCTION === $id && 0 === $depth ) {
				$next = $i + 1;
				while ( isset( $tokens[ $next ] ) && is_array( $tokens[ $next ] ) && T_WHITESPACE === $tokens[ $next ][0] ) {
					++$next;
				}
				if ( isset( $tokens[ $next ] ) && is_array( $tokens[ $next ] ) && T_STRING === $tokens[ $next ][0] ) {
					$found[] = 'global function ' . $tokens[ $next ][1];
				}
			}

			if ( T_STRING === $id && in_array( strtolower( $text ), array( 'define', 'class_alias' ), true ) ) {
				$found[] = $text . '()';
			}
			if ( T_CONST === $id && 0 === $depth ) {
				$found[] = 'global const';
			}
			if ( T_VARIABLE === $id && '$GLOBALS' === $text ) {
				$found[] = '$GLOBALS';
			}
			// `'Fyldo\\V1\\Foo'`-style namespace literals and class_exists( 'string' ).
			if ( T_CONSTANT_ENCAPSED_STRING === $id && 1 === preg_match( '/^[\'"]\\\\?\\\\*Fyldo\\\\+V\d/', $text ) ) {
				$found[] = 'hard-coded namespace string ' . $text;
			}
		}

		$this->assertTrue( $has_ns, 'Every file must declare a namespace.' );
		$this->assertSame( array(), $found, basename( $file ) );
	}

	public function test_class_lookups_use_class_constants_not_strings(): void {
		foreach ( $this->sources() as $file ) {
			$this->assertDoesNotMatchRegularExpression( '/class_exists\(\s*[\'"]/', (string) file_get_contents( $file ), basename( $file ) );
			$this->assertDoesNotMatchRegularExpression( '/new\s+\$[a-z_]+\s*\(/i', str_replace( 'new $class(', '', (string) file_get_contents( $file ) ), basename( $file ) . ': no `new $variable` except FieldFactory' );
		}
	}
}
