<?php
/**
 * One settings page: sections → fields, one wp_option, one save pattern.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Schema;

use Fyldo\V1\Fields\AbstractField;
use Fyldo\V1\Support\Naming;

/**
 * Normalised page.
 */
final class Page {

	const KEYS = array( 'title', 'description', 'icon', 'group', 'save', 'tabs', 'sections', 'capability', 'option_name' );

	/** @var string */
	private $id;

	/** @var string */
	private $option_name;

	/** @var array<string,mixed> */
	private $config;

	/** @var Section[] */
	private $sections = array();

	/** @var AbstractField[] Fields that own a value, indexed by field id (display-only fields are not in here). */
	private $fields = array();

	/**
	 * @param string              $slug   Instance slug (for the default option name).
	 * @param string              $id     Page id.
	 * @param array<string,mixed> $config Raw page config.
	 * @throws ConfigException On invalid configuration.
	 */
	public function __construct( string $slug, string $id, array $config ) {
		if ( ! Naming::is_valid_page_id( $id ) ) {
			throw new ConfigException( sprintf( 'Page id "%s" is invalid: use lower-case letters, digits, "_" or "-" (max 40 characters).', $id ) );
		}

		$unknown = array_diff( array_keys( $config ), self::KEYS );
		if ( array() !== $unknown ) {
			throw new ConfigException( sprintf( 'Page "%1$s" has unknown key(s): %2$s.', $id, implode( ', ', $unknown ) ) );
		}

		if ( ! isset( $config['title'] ) || '' === trim( (string) $config['title'] ) ) {
			throw new ConfigException( sprintf( 'Page "%s" needs a title.', $id ) );
		}

		$save = isset( $config['save'] ) ? (string) $config['save'] : 'global';
		if ( ! in_array( $save, array( 'global', 'section' ), true ) ) {
			throw new ConfigException( sprintf( 'Page "%s": save must be "global" (Save Bar) or "section" (card footers) — one pattern per page.', $id ) );
		}

		$tabs = array();
		foreach ( (array) ( $config['tabs'] ?? array() ) as $tab_id => $label ) {
			$tabs[ (string) $tab_id ] = (string) $label;
		}

		$this->id          = $id;
		$this->option_name = isset( $config['option_name'] ) && '' !== (string) $config['option_name']
			? (string) $config['option_name']
			: Naming::option( $slug, $id );

		if ( strlen( $this->option_name ) > 191 ) {
			throw new ConfigException( sprintf( 'Page "%s": the option name is longer than 191 characters.', $id ) );
		}

		$this->config = array(
			'title'       => (string) $config['title'],
			'description' => isset( $config['description'] ) ? (string) $config['description'] : '',
			'icon'        => isset( $config['icon'] ) ? (string) $config['icon'] : '',
			'group'       => isset( $config['group'] ) ? (string) $config['group'] : '',
			'save'        => $save,
			'tabs'        => $tabs,
			'capability'  => isset( $config['capability'] ) ? (string) $config['capability'] : '',
		);

		$section_ids = array();
		$field_ids   = array();
		foreach ( (array) ( $config['sections'] ?? array() ) as $section_config ) {
			$section = new Section( (array) $section_config );

			if ( isset( $section_ids[ $section->id() ] ) ) {
				throw new ConfigException( sprintf( 'Page "%1$s": duplicate section id "%2$s".', $id, $section->id() ) );
			}
			$section_ids[ $section->id() ] = true;

			if ( '' !== $section->tab() && ! isset( $tabs[ $section->tab() ] ) ) {
				throw new ConfigException( sprintf( 'Page "%1$s": section "%2$s" refers to unknown tab "%3$s".', $id, $section->id(), $section->tab() ) );
			}

			foreach ( $section->fields() as $field ) {
				if ( isset( $field_ids[ $field->id() ] ) ) {
					throw new ConfigException( sprintf( 'Page "%1$s": duplicate field id "%2$s" (field ids are the storage keys and must be unique per page).', $id, $field->id() ) );
				}
				$field_ids[ $field->id() ] = true;

				if ( $field->is_stored() ) {
					$this->fields[ $field->id() ] = $field;
				}
			}

			$this->sections[] = $section;
		}

		if ( array() === $this->sections ) {
			throw new ConfigException( sprintf( 'Page "%s" needs at least one section.', $id ) );
		}

		$this->assert_danger_sections_last();
	}

	public function id(): string {
		return $this->id;
	}

	public function option_name(): string {
		return $this->option_name;
	}

	/** Capability override, or '' to use the instance default. */
	public function capability(): string {
		return (string) $this->config['capability'];
	}

	public function save_mode(): string {
		return (string) $this->config['save'];
	}

	/** @return Section[] */
	public function sections(): array {
		return $this->sections;
	}

	/**
	 * The fields that own a value: what is stored, sanitized and saved. A `notice` is in a section, not in here.
	 *
	 * @return array<string,AbstractField>
	 */
	public function fields(): array {
		return $this->fields;
	}

	public function field( string $id ): ?AbstractField {
		return $this->fields[ $id ] ?? null;
	}

	/**
	 * @param array<string,mixed> $values   Current sanitized values, keyed by field id.
	 * @param string              $revision Revision token of the stored value.
	 * @return array<string,mixed>
	 */
	public function to_client( array $values, string $revision ): array {
		$tabs = array();
		foreach ( (array) $this->config['tabs'] as $tab_id => $label ) {
			$tabs[] = array(
				'id'    => (string) $tab_id,
				'label' => (string) $label,
			);
		}

		return array(
			'id'          => $this->id,
			'title'       => (string) $this->config['title'],
			'description' => (string) $this->config['description'],
			'icon'        => (string) $this->config['icon'],
			'group'       => (string) $this->config['group'],
			'save'        => (string) $this->config['save'],
			'tabs'        => $tabs,
			'sections'    => array_map(
				static function ( Section $section ): array {
					return $section->to_client();
				},
				$this->sections
			),
			'values'      => (object) $values,
			'revision'    => $revision,
		);
	}

	/** A Danger Section Card always sits at the bottom of the page (design rule 2). */
	private function assert_danger_sections_last(): void {
		$seen_danger = false;
		foreach ( $this->sections as $section ) {
			$is_danger = 'danger' === $section->tone();
			if ( $seen_danger && ! $is_danger ) {
				throw new ConfigException( sprintf( 'Page "%s": danger sections must come last.', $this->id ) );
			}
			$seen_danger = $seen_danger || $is_danger;
		}
	}
}
