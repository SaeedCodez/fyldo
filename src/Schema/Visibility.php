<?php
/**
 * Which fields and sections of a page show for a set of values (their `dependency`).
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Schema;

use Fyldo\V1\Fields\AbstractField;

/**
 * A field shows when its section shows and its dependency holds; a section shows when its dependency holds. A condition
 * on a hidden field never holds. Page config rules out cycles. Mirror of `visibilityOf()` in app/lib/dependency.ts.
 */
final class Visibility {

	/** @var Page */
	private $page;

	/** @var array<string,mixed> */
	private $values;

	/** @var array<string,AbstractField> Every field of the page (notices too), by id. */
	private $fields = array();

	/** @var array<string,Section> The section of each field, by field id. */
	private $section_of = array();

	/** @var array<string,bool> Known answers, keyed `field:<id>` or `section:<id>`. */
	private $known = array();

	/**
	 * @param Page                $page   The page.
	 * @param array<string,mixed> $values Every value field's value (the stored or default values, with the request's on top).
	 */
	public function __construct( Page $page, array $values ) {
		$this->page   = $page;
		$this->values = $values;
		foreach ( $page->sections() as $section ) {
			foreach ( $section->fields() as $field ) {
				$this->fields[ $field->id() ]     = $field;
				$this->section_of[ $field->id() ] = $section;
			}
		}
	}

	/** Whether field (or notice) `$id` shows. */
	public function field( string $id ): bool {
		$field = $this->fields[ $id ] ?? null;
		if ( null === $field ) {
			return false;
		}

		return $this->remember(
			'field:' . $id,
			function () use ( $field, $id ): bool {
				return $this->section( $this->section_of[ $id ] ) && ( null === $field->dependency() || Dependency::matches( $field->dependency(), array( $this, 'resolve' ) ) );
			}
		);
	}

	public function section( Section $section ): bool {
		return $this->remember(
			'section:' . $section->id(),
			function () use ( $section ): bool {
				return null === $section->dependency() || Dependency::matches( $section->dependency(), array( $this, 'resolve' ) );
			}
		);
	}

	/**
	 * A field as a condition reads it: whether it shows, and its value.
	 *
	 * @param string $id Field id.
	 * @return array{visible:bool,value:mixed}
	 */
	public function resolve( string $id ): array {
		$field = $this->page->field( $id );
		if ( null === $field ) {
			return array(
				'visible' => false,
				'value'   => null,
			);
		}

		return array(
			'visible' => $this->field( $id ),
			'value'   => Dependency::subject( $field, array_key_exists( $id, $this->values ) ? $this->values[ $id ] : $field->default_value() ),
		);
	}

	/**
	 * The value fields that are hidden, as keys.
	 *
	 * @return array<string,true>
	 */
	public function hidden(): array {
		$hidden = array();
		foreach ( array_keys( $this->page->fields() ) as $id ) {
			if ( ! $this->field( (string) $id ) ) {
				$hidden[ (string) $id ] = true;
			}
		}

		return $hidden;
	}

	/**
	 * @param string   $key    Cache key.
	 * @param callable $answer Computes the answer.
	 */
	private function remember( string $key, callable $answer ): bool {
		if ( ! array_key_exists( $key, $this->known ) ) {
			$this->known[ $key ] = false; // A cycle (ruled out by the page config) would read "hidden", never loop.
			$this->known[ $key ] = (bool) $answer();
		}

		return $this->known[ $key ];
	}
}
