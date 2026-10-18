<?php
/**
 * Conditional display (`dependency`): conditions, config checks, which fields show, and what a save does with the hidden ones.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Instance;
use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Schema\Dependency;
use Fyldo\V1\Schema\Page;
use PHPUnit\Framework\TestCase;

final class DependencyTest extends TestCase {

	protected function setUp(): void {
		$GLOBALS['__fyldo_test_options']  = array();
		$GLOBALS['__fyldo_test_autoload'] = array();
		$GLOBALS['__fyldo_test_fired']    = array();
	}

	/** @return array<string,array{string,mixed,mixed,bool}> */
	public static function shared_cases(): array {
		$json  = json_decode( (string) file_get_contents( dirname( __DIR__, 2 ) . '/fixtures/dependency-cases.json' ), true );
		$cases = array();
		foreach ( $json['holds'] as $i => $case ) {
			$cases[ sprintf( '#%d %s %s %s', $i, wp_json_encode( $case['value'] ), $case['operator'], wp_json_encode( $case['target'] ) ) ] = array( $case['operator'], $case['value'], $case['target'], $case['expected'] );
		}
		return $cases;
	}

	/**
	 * @dataProvider shared_cases
	 * @param mixed $value  Field value.
	 * @param mixed $target Condition value.
	 */
	public function test_shared_condition_cases( string $operator, $value, $target, bool $expected ): void {
		$this->assertSame( $expected, Dependency::holds( $operator, $value, $target ) );
	}

	public function test_normalize_accepts_one_condition_a_list_and_a_relation(): void {
		$this->assertSame(
			array(
				'relation'   => 'and',
				'conditions' => array(
					array(
						'field'    => 'cache',
						'operator' => '==',
						'value'    => true,
					),
				),
			),
			Dependency::normalize( array( 'cache', '==', true ), 'host' )
		);

		$or = Dependency::normalize(
			array(
				'relation' => 'OR',
				array( 'mode', 'any', 'redis' ),
				array( 'logo', 'not-empty' ),
			),
			'host'
		);
		$this->assertSame( 'or', $or['relation'] );
		$this->assertSame(
			array(
				array(
					'field'    => 'mode',
					'operator' => 'any',
					'value'    => array( 'redis' ),
				),
				array(
					'field'    => 'logo',
					'operator' => 'not-empty',
					'value'    => null,
				),
			),
			$or['conditions']
		);
	}

	/** @return array<string,array{mixed,string}> */
	public static function invalid_dependencies(): array {
		return array(
			'not an array'       => array( 'cache', 'must be a condition' ),
			'empty'              => array( array(), 'must be a condition' ),
			'unknown operator'   => array( array( 'cache', '===', true ), 'unknown dependency operator "==="' ),
			'missing value'      => array( array( 'cache', '==' ), 'needs a value' ),
			'value on empty'     => array( array( 'logo', 'empty', true ), 'takes no value' ),
			'codestar global'    => array( array( 'cache', '==', true, true ), 'no 4th element' ),
			'bad relation'       => array( array( 'relation' => 'xor', array( 'a', '==', 1 ) ), '"and" or "or"' ),
			'any without values' => array( array( 'mode', 'any', array() ), 'takes a list of values' ),
			'object value'       => array( array( 'n', '>', array( 1 ) ), 'must be text, a number or a boolean' ),
			'nested list'        => array( array( array( 'cache' ) ), 'must be a condition' ),
		);
	}

	/**
	 * @dataProvider invalid_dependencies
	 * @param mixed $dependency Raw dependency.
	 */
	public function test_invalid_dependencies_are_refused( $dependency, string $message ): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( $message );
		Dependency::normalize( $dependency, 'host' );
	}

	/**
	 * A page with a cache toggle, a mode select that shows with it, a host that shows for some modes, a notice, a second
	 * section that shows for the file mode, and a group whose `url` sub-field shows for its item's `kind`.
	 *
	 * @param array<int,array<string,mixed>> $extra More sections.
	 * @return array<string,mixed>
	 */
	private function config( array $extra = array() ): array {
		return array(
			'title'    => 'Cache',
			'sections' => array_merge(
				array(
					array(
						'id'     => 'main',
						'title'  => 'Main',
						'fields' => array(
							array( 'id' => 'cache', 'type' => 'toggle', 'label' => 'Cache' ),
							array(
								'id'         => 'mode',
								'type'       => 'select',
								'label'      => 'Mode',
								'options'    => array(
									'file'  => 'File',
									'redis' => 'Redis',
								),
								'default'    => 'file',
								'dependency' => array( 'cache', '==', true ),
							),
							array(
								'id'         => 'host',
								'type'       => 'text',
								'label'      => 'Host',
								'validate'   => array( 'required' => true ),
								'dependency' => array( 'mode', 'any', array( 'redis' ) ),
							),
							array(
								'id'          => 'tip',
								'type'        => 'notice',
								'description' => 'Redis needs a host.',
								'dependency'  => array( 'mode', '==', 'redis' ),
							),
							array(
								'id'     => 'links',
								'type'   => 'group',
								'label'  => 'Links',
								'addable' => true,
								'fields' => array(
									array(
										'id'      => 'kind',
										'type'    => 'select',
										'label'   => 'Kind',
										'options' => array(
											'page' => 'Page',
											'url'  => 'URL',
										),
										'default' => 'page',
									),
									array(
										'id'         => 'url',
										'type'       => 'url',
										'label'      => 'URL',
										'validate'   => array( 'required' => true ),
										'dependency' => array(
											array( 'kind', '==', 'url' ),
											array( 'cache', '==', true ),
										),
									),
								),
							),
						),
					),
					array(
						'id'         => 'files',
						'title'      => 'Files',
						'dependency' => array( 'mode', '==', 'file' ),
						'fields'     => array(
							array(
								'id'       => 'path',
								'type'     => 'text',
								'label'    => 'Path',
								'validate' => array( 'required' => true ),
							),
						),
					),
				),
				$extra
			),
		);
	}

	public function test_visibility_cascades_from_fields_and_sections(): void {
		$page = new Page( 'acme', 'cache', $this->config() );

		// Cache off: the mode hides, so the host (which reads the mode) and the file section (too) hide.
		$off = $page->visibility( array( 'cache' => false ) );
		$this->assertFalse( $off->field( 'mode' ) );
		$this->assertFalse( $off->field( 'host' ) );
		$this->assertFalse( $off->field( 'tip' ) );
		$this->assertFalse( $off->field( 'path' ), 'a hidden mode never satisfies the section' );
		$this->assertSame( array( 'mode', 'host', 'path' ), array_keys( $off->hidden() ) );

		$file = $page->visibility( array( 'cache' => true ) );
		$this->assertSame( array( 'host' ), array_keys( $file->hidden() ), 'the default mode is file' );

		$redis = $page->visibility(
			array(
				'cache' => true,
				'mode'  => 'redis',
			)
		);
		$this->assertTrue( $redis->field( 'host' ) );
		$this->assertTrue( $redis->field( 'tip' ) );
		$this->assertSame( array( 'path' ), array_keys( $redis->hidden() ) );
	}

	public function test_the_client_gets_the_normalised_dependency(): void {
		$client = ( new Page( 'acme', 'cache', $this->config() ) )->to_client( array(), 'rev' );

		$this->assertArrayNotHasKey( 'dependency', $client['sections'][0]['fields'][0] );
		$this->assertSame(
			array(
				'relation'   => 'and',
				'conditions' => array(
					array(
						'field'    => 'cache',
						'operator' => '==',
						'value'    => true,
					),
				),
			),
			$client['sections'][0]['fields'][1]['dependency']
		);
		$this->assertSame( 'redis', $client['sections'][0]['fields'][3]['dependency']['conditions'][0]['value'], 'a notice too' );
		$this->assertSame( 'url', $client['sections'][0]['fields'][4]['fields'][1]['dependency']['conditions'][0]['value'], 'a sub-field too' );
		$this->assertSame( 'file', $client['sections'][1]['dependency']['conditions'][0]['value'], 'a section too' );
		$this->assertArrayNotHasKey( 'dependency', $client['sections'][0] );
	}

	/** @return array<string,array{array<string,mixed>,string}> */
	public static function invalid_references(): array {
		$text = static function ( string $id, $dependency ): array {
			return array(
				'id'         => $id,
				'type'       => 'text',
				'label'      => 'X',
				'dependency' => $dependency,
			);
		};
		return array(
			'unknown field'   => array( $text( 'x', array( 'nope', '==', 1 ) ), 'depends on "nope", which is not a field of page "cache"' ),
			'itself'          => array( $text( 'x', array( 'x', '==', 1 ) ), 'cannot depend on itself' ),
			'a notice'        => array( $text( 'x', array( 'tip', '==', 1 ) ), 'depends on "tip"' ),
			'a sub-field'     => array( $text( 'x', array( 'kind', '==', 'url' ) ), 'depends on "kind"' ),
			'a password'      => array(
				array(
					'id'    => 'secret',
					'type'  => 'password',
					'label' => 'Secret',
				),
				'',
			),
			'a circle'        => array( $text( 'x', array( 'y', '==', 1 ) ), 'go round in a circle' ),
		);
	}

	/**
	 * @dataProvider invalid_references
	 * @param array<string,mixed> $field   A field added to a section of its own.
	 * @param string              $message Expected message part.
	 */
	public function test_references_are_checked_when_the_page_is_registered( array $field, string $message ): void {
		$fields = array( $field );
		if ( 'secret' === $field['id'] ) {
			$fields[] = array(
				'id'         => 'x',
				'type'       => 'text',
				'label'      => 'X',
				'dependency' => array( 'secret', 'not-empty' ),
			);
			$message  = 'cannot depend on password field "secret"';
		}
		if ( 'go round in a circle' === $message ) {
			$fields[] = array(
				'id'         => 'y',
				'type'       => 'text',
				'label'      => 'Y',
				'dependency' => array( 'x', '==', 1 ),
			);
		}

		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( $message );
		new Page(
			'acme',
			'cache',
			$this->config(
				array(
					array(
						'id'     => 'more',
						'title'  => 'More',
						'fields' => $fields,
					),
				)
			)
		);
	}

	public function test_a_section_cannot_depend_on_its_own_field(): void {
		$this->expectException( ConfigException::class );
		$this->expectExceptionMessage( 'Section "more" cannot depend on its own field "flag"' );
		new Page(
			'acme',
			'cache',
			$this->config(
				array(
					array(
						'id'         => 'more',
						'title'      => 'More',
						'dependency' => array( 'flag', '==', true ),
						'fields'     => array(
							array(
								'id'    => 'flag',
								'type'  => 'toggle',
								'label' => 'Flag',
							),
						),
					),
				)
			)
		);
	}

	public function test_group_sub_fields_are_checked_too(): void {
		$group = static function ( array $url_dependency ): array {
			return array(
				'title'    => 'G',
				'sections' => array(
					array(
						'id'     => 's',
						'title'  => 'S',
						'fields' => array(
							array(
								'id'     => 'links',
								'type'   => 'group',
								'label'  => 'Links',
								'addable' => true,
								'fields' => array(
									array(
										'id'         => 'kind',
										'type'       => 'text',
										'label'      => 'Kind',
										'dependency' => array( 'url', 'not-empty' ),
									),
									array(
										'id'         => 'url',
										'type'       => 'url',
										'label'      => 'URL',
										'dependency' => $url_dependency,
									),
								),
							),
						),
					),
				),
			);
		};

		foreach (
			array(
				'go round in a circle'                   => array( 'kind', 'not-empty' ),
				'cannot depend on its own group'         => array( 'links', 'not-empty' ),
				'A sub-field of group "links" depends on "nope"' => array( 'nope', 'empty' ),
			) as $message => $dependency
		) {
			try {
				new Page( 'acme', 'g', $group( $dependency ) );
				$this->fail( 'Expected: ' . $message );
			} catch ( ConfigException $e ) {
				$this->assertStringContainsString( $message, $e->getMessage() );
			}
		}
	}

	private function instance(): Instance {
		$instance = new Instance( 'acme', array( 'title' => 'Acme' ) );
		$instance->add_page( 'cache', $this->config() );
		return $instance;
	}

	public function test_a_hidden_required_field_does_not_block_the_save_and_keeps_what_is_stored(): void {
		$instance = $this->instance();
		$GLOBALS['__fyldo_test_options']['acme_cache'] = array(
			'cache' => true,
			'mode'  => 'redis',
			'host'  => 'old.example',
		);

		// Turning the cache off hides the mode and the host: an empty host (required) is not checked, and is not saved.
		$result = $instance->update(
			'cache',
			array(
				'cache' => false,
				'host'  => '',
				'path'  => '',
			)
		);

		$this->assertSame( 'ok', $result['status'] );
		$this->assertSame(
			array(
				'cache' => false,
				'mode'  => 'redis',
				'host'  => 'old.example',
			),
			$GLOBALS['__fyldo_test_options']['acme_cache']
		);
	}

	public function test_a_field_shown_by_the_same_save_is_checked(): void {
		$result = $this->instance()->update(
			'cache',
			array(
				'cache' => true,
				'mode'  => 'redis',
				'host'  => '',
			)
		);

		$this->assertSame( 'invalid', $result['status'] );
		$this->assertSame( array( 'host' ), array_keys( $result['errors'] ) );
	}

	public function test_a_hidden_section_hides_its_fields(): void {
		$instance = $this->instance();

		$this->assertSame( 'invalid', $instance->update( 'cache', array( 'cache' => true, 'path' => '' ) )['status'], 'mode file: the Files section shows' );
		$this->assertSame( 'ok', $instance->update( 'cache', array( 'cache' => true, 'mode' => 'redis', 'host' => 'h', 'path' => '' ) )['status'] );
	}

	public function test_a_group_item_skips_the_sub_fields_it_hides(): void {
		$instance = $this->instance();
		$links    = array(
			array(
				'kind' => 'page',
				'url'  => '',
			),
			array(
				'kind' => 'url',
				'url'  => '',
			),
		);

		// Cache off: no item shows its URL (a condition on a page field).
		$this->assertSame( 'ok', $instance->update( 'cache', array( 'links' => $links ) )['status'] );

		// Cache on: the second item (kind url) shows its URL, which is required.
		$result = $instance->update(
			'cache',
			array(
				'cache' => true,
				'links' => $links,
				'path'  => '/tmp',
			)
		);
		$this->assertSame( 'invalid', $result['status'] );
		$this->assertSame( array( 'links.1.url' ), array_keys( $result['errors'] ) );
	}
}
