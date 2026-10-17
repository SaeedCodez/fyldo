<?php
/**
 * A plugin's own storage for the form tests: books in memory, read and written through a form's `load` and `save`.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

/**
 * Keys are "b1", "b2"…; every saved row gets an `updated` column the form does not know (as a real table would).
 */
final class BookTable {

	/** @var array<string,array<string,mixed>> */
	public $rows = array();

	/** @var string[] The keys `load` was asked for. */
	public $loads = array();

	/** @var array<int,array{0:array<string,mixed>,1:string}> What `save` got: the values and the key. */
	public $saves = array();

	/** @var array{0:mixed}|null What `save` returns instead of the key, when set (a WP_Error, a bad key). */
	private $answer = null;

	/** @var int */
	private $next = 1;

	/** @return array<string,mixed>|null */
	public function load( string $key ): ?array {
		$this->loads[] = $key;

		return $this->rows[ $key ] ?? null;
	}

	/**
	 * @param array<string,mixed> $values The complete record.
	 * @param string              $key    '' for a new book.
	 * @return mixed
	 */
	public function save( array $values, string $key ) {
		$this->saves[] = array( $values, $key );
		if ( null !== $this->answer ) {
			return $this->answer[0];
		}

		$key                = '' === $key ? 'b' . $this->next++ : $key;
		$this->rows[ $key ] = $values + array( 'updated' => 'now' );

		return $key;
	}

	/**
	 * From now on `save` returns this instead of the key.
	 *
	 * @param mixed $answer A WP_Error, a bad key…
	 */
	public function answer( $answer ): void {
		$this->answer = array( $answer );
	}

	/**
	 * The book form's config.
	 *
	 * @param array<string,mixed> $extra Overrides.
	 * @return array<string,mixed>
	 */
	public function form( array $extra = array() ): array {
		return array_merge(
			array(
				'sections' => array(
					array(
						'id'     => 'book',
						'title'  => 'Book',
						'fields' => array(
							array( 'id' => 'title', 'type' => 'text', 'label' => 'Title', 'validate' => array( 'required' => true, 'max_length' => 40 ) ),
							array( 'id' => 'status', 'type' => 'select', 'label' => 'Status', 'options' => array( 'draft' => 'Draft', 'published' => 'Published' ), 'default' => 'draft' ),
							array( 'id' => 'licence', 'type' => 'password', 'label' => 'Licence key' ),
							array( 'id' => 'source', 'type' => 'text', 'label' => 'Source', 'default' => 'manual', 'disabled' => 'Set by the importer' ),
							array( 'id' => 'heads_up', 'type' => 'notice', 'tone' => 'amber', 'label' => 'Heads up', 'description' => 'Books are public once published.' ),
						),
					),
					array(
						'id'     => 'contents',
						'title'  => 'Contents',
						'fields' => array(
							array( 'id' => 'chapters', 'type' => 'group', 'label' => 'Chapters', 'addable' => true, 'fields' => array( array( 'id' => 'name', 'type' => 'text', 'label' => 'Name', 'validate' => array( 'required' => true ) ) ) ),
							array( 'id' => 'cover', 'type' => 'image', 'label' => 'Cover' ),
						),
					),
				),
				'load'     => array( $this, 'load' ),
				'save'     => array( $this, 'save' ),
			),
			$extra
		);
	}
}
