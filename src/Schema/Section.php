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

	/** Built-in danger actions (`POST …/pages/{page}/actions/{id}`). */
	const ACTIONS = array( 'reset' );

	const ACTION_KEYS  = array( 'id', 'label', 'confirm' );
	const CONFIRM_KEYS = array( 'title', 'description', 'keyword', 'label' );

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

		$action = self::normalize_action( $id, $tone, $config );

		$this->id     = $id;
		$this->config = array(
			'tab'         => isset( $config['tab'] ) ? (string) $config['tab'] : '',
			'title'       => (string) $config['title'],
			'description' => isset( $config['description'] ) ? (string) $config['description'] : '',
			'tone'        => $tone,
			'action'      => $action,
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

	/**
	 * The danger action (`reset`), or null for an ordinary section.
	 *
	 * @return array{id:string,label:string,confirm:array{title:string,description:string,keyword:string,label:string}}|null
	 */
	public function action(): ?array {
		return $this->config['action'];
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

	/**
	 * A Danger Section Card owns exactly one action (built-in `reset`: restore the page's defaults) and no fields; an
	 * ordinary section has none. Texts left empty are filled in by the browser, translated (PHP runs before
	 * Fyldo's own text domain is guaranteed to be loaded).
	 *
	 * @param string              $id     Section id (for messages).
	 * @param string              $tone   Section tone.
	 * @param array<string,mixed> $config Raw section config.
	 * @return array{id:string,label:string,confirm:array{title:string,description:string,keyword:string,label:string}}|null
	 * @throws ConfigException On an invalid action.
	 */
	private static function normalize_action( string $id, string $tone, array $config ): ?array {
		if ( 'danger' !== $tone ) {
			if ( isset( $config['action'] ) ) {
				throw new ConfigException( sprintf( 'Section "%s": only a danger section (tone "danger") can have an action.', $id ) );
			}

			return null;
		}

		if ( ! isset( $config['action'] ) || ! is_array( $config['action'] ) ) {
			throw new ConfigException( sprintf( 'Section "%s": a danger section needs an `action` (id "reset").', $id ) );
		}
		if ( array() !== (array) ( $config['fields'] ?? array() ) ) {
			throw new ConfigException( sprintf( 'Section "%s": a danger section shows its header and one action, not fields.', $id ) );
		}

		$action  = $config['action'];
		$unknown = array_diff( array_keys( $action ), self::ACTION_KEYS );
		if ( array() !== $unknown ) {
			throw new ConfigException( sprintf( 'Section "%1$s": action has unknown key(s): %2$s.', $id, implode( ', ', $unknown ) ) );
		}

		$action_id = isset( $action['id'] ) ? (string) $action['id'] : '';
		if ( ! in_array( $action_id, self::ACTIONS, true ) ) {
			throw new ConfigException( sprintf( 'Section "%1$s": action id must be one of: %2$s.', $id, implode( ', ', self::ACTIONS ) ) );
		}

		$confirm = isset( $action['confirm'] ) ? $action['confirm'] : array();
		if ( ! is_array( $confirm ) ) {
			throw new ConfigException( sprintf( 'Section "%s": action.confirm must be an array.', $id ) );
		}
		$unknown = array_diff( array_keys( $confirm ), self::CONFIRM_KEYS );
		if ( array() !== $unknown ) {
			throw new ConfigException( sprintf( 'Section "%1$s": action.confirm has unknown key(s): %2$s.', $id, implode( ', ', $unknown ) ) );
		}

		$keyword = isset( $confirm['keyword'] ) ? trim( (string) $confirm['keyword'] ) : '';
		if ( strlen( $keyword ) > 40 ) {
			throw new ConfigException( sprintf( 'Section "%s": the confirmation keyword is longer than 40 characters.', $id ) );
		}

		return array(
			'id'      => $action_id,
			'label'   => isset( $action['label'] ) ? trim( (string) $action['label'] ) : '',
			'confirm' => array(
				'title'       => isset( $confirm['title'] ) ? trim( (string) $confirm['title'] ) : '',
				'description' => isset( $confirm['description'] ) ? trim( (string) $confirm['description'] ) : '',
				'keyword'     => $keyword,
				'label'       => isset( $confirm['label'] ) ? trim( (string) $confirm['label'] ) : '',
			),
		);
	}
}
