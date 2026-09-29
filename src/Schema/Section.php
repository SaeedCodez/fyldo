<?php
/**
 * A titled group of fields (rendered as a Section Card). Sections are layout, not storage.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Schema;

use Fyldo\V1\Fields\AbstractField;
use Fyldo\V1\Fields\FieldFactory;

/**
 * Normalised section.
 */
final class Section {

	const KEYS = array( 'id', 'tab', 'title', 'description', 'tone', 'fields', 'action' );

	/** @var string */
	private $id;

	/** @var array<string,mixed> */
	private $config;

	/** @var AbstractField[] */
	private $fields = array();

	/**
	 * @param array<string,mixed> $config Raw section config.
	 * @throws ConfigException On invalid configuration.
	 */
	public function __construct( array $config ) {
		$id = isset( $config['id'] ) ? (string) $config['id'] : '';
		if ( 1 !== preg_match( '/^[a-z0-9][a-z0-9_-]{0,63}$/', $id ) ) {
			throw new ConfigException( sprintf( 'Section id "%s" is invalid: use lower-case letters, digits, "_" or "-".', $id ) );
		}

		$unknown = array_diff( array_keys( $config ), self::KEYS );
		if ( array() !== $unknown ) {
			throw new ConfigException( sprintf( 'Section "%1$s" has unknown key(s): %2$s.', $id, implode( ', ', $unknown ) ) );
		}

		$tone = isset( $config['tone'] ) ? (string) $config['tone'] : 'default';
		if ( ! in_array( $tone, array( 'default', 'danger' ), true ) ) {
			throw new ConfigException( sprintf( 'Section "%s": tone must be "default" or "danger".', $id ) );
		}

		if ( ! isset( $config['title'] ) || '' === trim( (string) $config['title'] ) ) {
			throw new ConfigException( sprintf( 'Section "%s" needs a title.', $id ) );
		}

		$this->id     = $id;
		$this->config = array(
			'tab'         => isset( $config['tab'] ) ? (string) $config['tab'] : '',
			'title'       => (string) $config['title'],
			'description' => isset( $config['description'] ) ? (string) $config['description'] : '',
			'tone'        => $tone,
			'action'      => isset( $config['action'] ) ? (array) $config['action'] : null,
		);

		foreach ( (array) ( $config['fields'] ?? array() ) as $field_config ) {
			$this->fields[] = FieldFactory::create( (array) $field_config );
		}
	}

	public function id(): string {
		return $this->id;
	}

	public function tab(): string {
		return (string) $this->config['tab'];
	}

	public function tone(): string {
		return (string) $this->config['tone'];
	}

	/** @return AbstractField[] */
	public function fields(): array {
		return $this->fields;
	}

	/** @return array<string,mixed> */
	public function to_client(): array {
		$out = array(
			'id'          => $this->id,
			'tab'         => (string) $this->config['tab'],
			'title'       => (string) $this->config['title'],
			'description' => (string) $this->config['description'],
			'tone'        => (string) $this->config['tone'],
			'fields'      => array_map(
				static function ( AbstractField $field ): array {
					return $field->to_client();
				},
				$this->fields
			),
		);

		if ( null !== $this->config['action'] ) {
			$out['action'] = $this->config['action'];
		}

		return $out;
	}
}
