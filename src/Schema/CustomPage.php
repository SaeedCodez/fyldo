<?php
/**
 * A page the developer draws with their own JavaScript module: a list of records, a record editor, a report.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Schema;

use Fyldo\V1\Support\Module;
use Fyldo\V1\Support\Naming;

/**
 * Registered with `add_page( $id, array( 'type' => 'custom', … ) )`. Fyldo draws the navigation and the Page Header
 * and loads `module`, an ES module whose default export draws the content. It has no option, no values and no REST
 * routes of its own: the module reads and writes through the plugin's routes (and Fyldo's forms).
 */
final class CustomPage implements Guarded {

	const KEYS = array( 'type', 'title', 'description', 'icon', 'group', 'badge', 'links', 'capability', 'module', 'style', 'props', 'media' );

	/** @var string */
	private $id;

	/** @var array{title:string,description:string,icon:string,group:string,badge:string,links:array<int,array<string,mixed>>,capability:string,module:string,style:string,props:array<string,mixed>,media:bool} */
	private $config;

	/**
	 * @param string              $id     Page id.
	 * @param array<string,mixed> $config Raw page config (`type` is "custom").
	 * @throws ConfigException On invalid configuration.
	 */
	public function __construct( string $id, array $config ) {
		if ( ! Naming::is_valid_page_id( $id ) ) {
			throw new ConfigException( sprintf( 'Page id "%s" is invalid: use lower-case letters, digits, "_" or "-" (max 40 characters).', $id ) );
		}

		// A settings page's keys are a likely slip (a page turned custom): say what to do, not just "unknown".
		$settings_only = array_values( array_intersect( array_keys( $config ), array_diff( Page::KEYS, self::KEYS ) ) );
		if ( array() !== $settings_only ) {
			throw new ConfigException( sprintf( 'Custom page "%1$s": custom pages draw their own content: remove `%2$s`.', $id, implode( '`, `', $settings_only ) ) );
		}

		$unknown = array_diff( array_keys( $config ), self::KEYS );
		if ( array() !== $unknown ) {
			throw new ConfigException( sprintf( 'Custom page "%1$s" has unknown key(s): %2$s.', $id, implode( ', ', $unknown ) ) );
		}

		if ( ! isset( $config['title'] ) || '' === trim( (string) $config['title'] ) ) {
			throw new ConfigException( sprintf( 'Custom page "%s" needs a title.', $id ) );
		}

		$badge = $config['badge'] ?? '';
		if ( ! is_string( $badge ) && ! is_int( $badge ) ) {
			throw new ConfigException( sprintf( 'Custom page "%s": badge must be a short string or a number.', $id ) );
		}

		$module = Module::url( $config['module'] ?? '' );
		if ( '' === $module ) {
			throw new ConfigException( sprintf( 'Custom page "%s": `module` must be the URL of its JavaScript module (http(s), or a path starting with "/").', $id ) );
		}

		$style = $config['style'] ?? '';
		if ( '' !== $style ) {
			$style = Module::url( $style );
			if ( '' === $style ) {
				throw new ConfigException( sprintf( 'Custom page "%s": `style` must be the URL of a stylesheet (http(s), or a path starting with "/").', $id ) );
			}
		}

		$props = $config['props'] ?? array();
		if ( ! Module::is_props( $props ) ) {
			throw new ConfigException( sprintf( 'Custom page "%s": `props` must be an array keyed by name, holding only text, numbers, booleans, null and arrays.', $id ) );
		}

		$media = $config['media'] ?? false;
		if ( ! is_bool( $media ) ) {
			throw new ConfigException( sprintf( 'Custom page "%s": `media` must be true (the module opens the media library) or false.', $id ) );
		}

		$this->id     = $id;
		$this->config = array(
			'title'       => (string) $config['title'],
			'description' => isset( $config['description'] ) ? (string) $config['description'] : '',
			'icon'        => isset( $config['icon'] ) ? (string) $config['icon'] : '',
			'group'       => isset( $config['group'] ) ? (string) $config['group'] : '',
			'badge'       => (string) $badge,
			'links'       => Links::parse( $config['links'] ?? array(), sprintf( 'Custom page "%s"', $id ), false ),
			'capability'  => isset( $config['capability'] ) ? (string) $config['capability'] : '',
			'module'      => $module,
			'style'       => $style,
			'props'       => $props,
			'media'       => $media,
		);
	}

	public function id(): string {
		return $this->id;
	}

	public function capability(): string {
		return $this->config['capability'];
	}

	/** URL of the ES module that draws the page. */
	public function module(): string {
		return $this->config['module'];
	}

	/** URL of the stylesheet to enqueue with the screen; '' = none. */
	public function style(): string {
		return $this->config['style'];
	}

	/** Whether the module opens the media library (`ui.MediaPicker`): the screen then loads `wp.media`. */
	public function media(): bool {
		return $this->config['media'];
	}

	/**
	 * What the browser gets: the navigation entry and the module. No `style` (PHP enqueues it), no capability.
	 *
	 * @return array<string,mixed>
	 */
	public function to_client(): array {
		return array(
			'type'        => 'custom',
			'id'          => $this->id,
			'title'       => $this->config['title'],
			'description' => $this->config['description'],
			'icon'        => $this->config['icon'],
			'group'       => $this->config['group'],
			'badge'       => $this->config['badge'],
			'links'       => $this->config['links'],
			'module'      => $this->config['module'],
			// An object even when empty, so the browser always gets `{}`, never `[]`.
			'props'       => (object) $this->config['props'],
		);
	}
}
