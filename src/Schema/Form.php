<?php
/**
 * A field schema whose records belong to the plugin: a row in its own table, a post, anything.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Schema;

use Fyldo\V1\Fields\AbstractField;
use Fyldo\V1\Instance;
use Fyldo\V1\Support\Naming;

/**
 * Registered with `$instance->add_form( $id, array( 'sections' => …, 'load' => …, 'save' => … ) )`. Fyldo sanitizes,
 * validates, reports errors and checks the revision exactly like on a settings page; the plugin's callbacks read and
 * write the record. A custom page opens it over REST (`…/forms/{form}/records/{key}`).
 */
final class Form implements Guarded {

	const KEYS = array( 'sections', 'load', 'save', 'capability' );

	/** The key the browser asks for to open an empty record; `save` never returns it, so it names no record. */
	const NEW_KEY = 'new';

	/** A record key: what `save` returns and the REST route matches. */
	const KEY_REGEX = '[A-Za-z0-9_-]{1,64}';

	/** @var string */
	private $id;

	/** @var Page The fields, as a page's schema (it has no option: the records are the plugin's). */
	private $schema;

	/** @var callable The plugin's reader: ( string $key ) → array|null. */
	private $load;

	/** @var callable The plugin's writer: ( array $values, string $key ) → string|\WP_Error. */
	private $save;

	/** @var string */
	private $capability;

	/**
	 * @param string              $slug   Instance slug.
	 * @param string              $id     Form id.
	 * @param array<string,mixed> $config Raw form config.
	 * @throws ConfigException On invalid configuration.
	 */
	public function __construct( string $slug, string $id, array $config ) {
		if ( ! Naming::is_valid_page_id( $id ) ) {
			throw new ConfigException( sprintf( 'Form id "%s" is invalid: use lower-case letters, digits, "_" or "-" (max 40 characters).', $id ) );
		}

		$unknown = array_diff( array_keys( $config ), self::KEYS );
		if ( array() !== $unknown ) {
			throw new ConfigException( sprintf( 'Form "%1$s" has unknown key(s): %2$s.', $id, implode( ', ', $unknown ) ) );
		}

		if ( ! isset( $config['load'] ) || ! is_callable( $config['load'] ) ) {
			throw new ConfigException( sprintf( 'Form "%s" needs `load`: a callable that returns the stored values of a record by its key, or null when there is no such record.', $id ) );
		}
		if ( ! isset( $config['save'] ) || ! is_callable( $config['save'] ) ) {
			throw new ConfigException( sprintf( 'Form "%s" needs `save`: a callable that stores a record and returns its key (or a WP_Error).', $id ) );
		}

		// One card after another: no tabs, and no danger section (its `reset` acts on a page's option).
		foreach ( (array) ( $config['sections'] ?? array() ) as $section ) {
			$section    = (array) $section;
			$section_id = isset( $section['id'] ) ? (string) $section['id'] : '';
			if ( isset( $section['tab'] ) ) {
				throw new ConfigException( sprintf( 'Form "%1$s": section "%2$s" has a `tab`; a form has no tabs.', $id, $section_id ) );
			}
			if ( isset( $section['action'] ) || 'danger' === ( $section['tone'] ?? '' ) ) {
				throw new ConfigException( sprintf( 'Form "%1$s": section "%2$s" is a danger section; a form has none (no `tone => danger`, no `action`).', $id, $section_id ) );
			}
		}

		$this->schema = new Page(
			$slug,
			$id,
			array(
				'title'    => $id,
				'sections' => $config['sections'] ?? array(),
			),
			'Form'
		);

		foreach ( $this->schema->fields() as $field ) {
			if ( array() !== $field->default_before() ) {
				throw new ConfigException( sprintf( 'Form "%1$s", field "%2$s": `default_before` is for settings pages; Fyldo never rewrites a form\'s records.', $id, $field->id() ) );
			}
		}

		$this->id         = $id;
		$this->load       = $config['load'];
		$this->save       = $config['save'];
		$this->capability = isset( $config['capability'] ) ? (string) $config['capability'] : '';
	}

	public function id(): string {
		return $this->id;
	}

	public function capability(): string {
		return $this->capability;
	}

	/** The fields as a page's schema: what the record store and the Saver read. */
	public function schema(): Page {
		return $this->schema;
	}

	/** @return Section[] */
	public function sections(): array {
		return $this->schema->sections();
	}

	/**
	 * The fields that own a value (what a record holds), indexed by field id.
	 *
	 * @return array<string,AbstractField>
	 */
	public function fields(): array {
		return $this->schema->fields();
	}

	/**
	 * The plugin's `load`: the raw stored values of a record, or null when there is no such record (anything but an
	 * array counts as none).
	 *
	 * @return array<string,mixed>|null
	 */
	public function load( string $key ): ?array {
		$record = call_user_func( $this->load, $key );

		return is_array( $record ) ? $record : null;
	}

	/**
	 * The plugin's `save`: stores the complete record and returns its key (a new key for a new record). Its WP_Error is
	 * passed on as it is; a key that is not one (empty, "new", too long) is a developer mistake and fails the save.
	 *
	 * @param array<string,mixed> $values Every field of the form, sanitized and validated.
	 * @param string              $key    Record key; '' for a new record.
	 * @return string|\WP_Error
	 */
	public function save( array $values, string $key ) {
		$saved = call_user_func( $this->save, $values, $key );
		if ( $saved instanceof \WP_Error ) {
			return $saved;
		}

		// An auto-increment id is a key too.
		$saved = is_int( $saved ) && $saved > 0 ? (string) $saved : $saved;
		if ( is_string( $saved ) && self::NEW_KEY !== $saved && 1 === preg_match( '/^' . self::KEY_REGEX . '$/', $saved ) ) {
			return $saved;
		}

		Instance::doing_it_wrong( __METHOD__, sprintf( 'Form "%s": `save` must return the record key (letters, digits, "_" or "-", at most 64 characters, not "new") or a WP_Error.', $this->id ) );

		return new \WP_Error( 'fyldo_save_failed', __( 'The record could not be saved.', 'fyldo' ), array( 'status' => 500 ) );
	}

	/**
	 * What the browser gets: the sections, as a page has them. No values: it reads a record over REST.
	 *
	 * @return array{id:string,sections:array<int,array<string,mixed>>}
	 */
	public function to_client(): array {
		return array(
			'id'       => $this->id,
			'sections' => array_map(
				static function ( Section $section ): array {
					return $section->to_client();
				},
				$this->schema->sections()
			),
		);
	}
}
