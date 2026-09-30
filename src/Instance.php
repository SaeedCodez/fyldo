<?php
/**
 * One settings panel, identified by its slug. Holds groups and pages; everything runtime-global is derived
 * from the slug (Support\Naming).
 *
 * @package Fyldo
 */

namespace Fyldo\V1;

use Fyldo\V1\Admin\Notice;
use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Schema\Page;
use Fyldo\V1\Storage\OptionStore;
use Fyldo\V1\Storage\Saver;

/**
 * Public object returned by Fyldo::create().
 */
final class Instance {

	const KEYS = array( 'title', 'logo', 'version', 'capability', 'navigation', 'menu', 'links' );

	/** @var string */
	private $slug;

	/** @var array<string,mixed> */
	private $config;

	/** @var array<int,array{id:string,label:string}> */
	private $groups = array();

	/** @var array<string,array{page:Page,group:string}> */
	private $pages = array();

	/** @var OptionStore */
	private $store;

	/** @var array{icon:string}|array{url:string}|null The brand logo; null = the Fyldo mark. */
	private $logo;

	/** @var array<string,array<string,mixed>> Notices for the screen, by id (the same notice added twice is shown once). */
	private $notices = array();

	/** @var string Screen hook suffix returned by add_menu_page()/add_submenu_page(). */
	private $hook_suffix = '';

	/**
	 * @param string              $slug   Validated slug.
	 * @param array<string,mixed> $config Raw config.
	 * @throws ConfigException On invalid configuration.
	 */
	public function __construct( string $slug, array $config ) {
		$unknown = array_diff( array_keys( $config ), self::KEYS );
		if ( array() !== $unknown ) {
			throw new ConfigException( sprintf( 'Fyldo "%1$s": unknown config key(s): %2$s.', $slug, implode( ', ', $unknown ) ) );
		}

		// The brand: `title` (default "Fyldo", translated when shown) and `logo` (default: the Fyldo mark).
		if ( isset( $config['title'] ) && ( ! is_string( $config['title'] ) || '' === trim( $config['title'] ) ) ) {
			throw new ConfigException( sprintf( 'Fyldo "%s": title must be a non-empty string (omit it for "Fyldo").', $slug ) );
		}
		$logo = self::normalize_logo( $slug, $config['logo'] ?? null );

		$navigation = isset( $config['navigation'] ) ? (string) $config['navigation'] : 'sidebar';
		if ( ! in_array( $navigation, array( 'sidebar', 'top' ), true ) ) {
			throw new ConfigException( sprintf( 'Fyldo "%s": navigation must be "sidebar" or "top".', $slug ) );
		}

		$menu = array_merge(
			array(
				'type'     => 'submenu',
				'parent'   => 'options-general.php',
				'title'    => '', // '' = the instance title.
				'icon'     => 'dashicons-admin-generic', // WordPress menu icon (top-level only), not an Iconsax name.
				'position' => null,
			),
			(array) ( $config['menu'] ?? array() )
		);
		if ( ! in_array( $menu['type'], array( 'submenu', 'top' ), true ) ) {
			throw new ConfigException( sprintf( 'Fyldo "%s": menu.type must be "submenu" or "top".', $slug ) );
		}

		$links = array();
		foreach ( (array) ( $config['links'] ?? array() ) as $link ) {
			$link = (array) $link;
			if ( ! isset( $link['label'], $link['url'] ) ) {
				throw new ConfigException( sprintf( 'Fyldo "%s": every link needs `label` and `url`.', $slug ) );
			}
			// `footer`: the sidebar footer (top navigation: its utility buttons). `header`: the Page Header actions.
			$placement = isset( $link['placement'] ) ? (string) $link['placement'] : 'footer';
			if ( ! in_array( $placement, array( 'footer', 'header' ), true ) ) {
				throw new ConfigException( sprintf( 'Fyldo "%s": link placement must be "footer" or "header".', $slug ) );
			}
			$links[] = array(
				'label'     => (string) $link['label'],
				'url'       => (string) $link['url'],
				'icon'      => isset( $link['icon'] ) ? (string) $link['icon'] : '',
				'external'  => ! empty( $link['external'] ),
				'placement' => $placement,
			);
		}

		$this->slug   = $slug;
		$this->logo   = $logo;
		$this->store  = new OptionStore();
		$this->config = array(
			'title'      => isset( $config['title'] ) ? trim( (string) $config['title'] ) : '',
			'version'    => isset( $config['version'] ) ? (string) $config['version'] : '',
			'capability' => isset( $config['capability'] ) ? (string) $config['capability'] : 'manage_options',
			'navigation' => $navigation,
			'menu'       => $menu,
			'links'      => $links,
		);
	}

	public function slug(): string {
		return $this->slug;
	}

	/** The brand name: the configured title, or "Fyldo" (translated, so it is read when shown, not at `init`). */
	public function title(): string {
		return '' !== $this->config['title'] ? (string) $this->config['title'] : __( 'Fyldo', 'fyldo' );
	}

	/**
	 * The brand logo as the browser draws it: an Iconsax icon, an image URL, or null for the Fyldo mark.
	 *
	 * @return array{icon:string}|array{url:string}|null
	 */
	public function logo(): ?array {
		return $this->logo;
	}

	/** The admin menu label: `menu.title`, else the brand name. */
	public function menu_title(): string {
		$title = (string) $this->config['menu']['title'];

		return '' !== $title ? $title : $this->title();
	}

	/**
	 * @return array<string,mixed>
	 */
	public function config(): array {
		return $this->config;
	}

	public function add_group( string $id, string $label ): self {
		$this->groups[] = array(
			'id'    => $id,
			'label' => $label,
		);

		return $this;
	}

	/**
	 * Registers a page. Configuration mistakes are reported with _doing_it_wrong() and the page is skipped.
	 *
	 * @param string              $id     Page id.
	 * @param array<string,mixed> $config Page config.
	 */
	public function add_page( string $id, array $config ): self {
		try {
			if ( isset( $this->pages[ $id ] ) ) {
				throw new ConfigException( sprintf( 'Page "%s" is already registered.', $id ) );
			}

			$page               = new Page( $this->slug, $id, $config );
			$this->pages[ $id ] = array(
				'page'  => $page,
				'group' => isset( $config['group'] ) ? (string) $config['group'] : '',
			);
		} catch ( ConfigException $e ) {
			self::doing_it_wrong( __METHOD__, sprintf( 'Fyldo "%1$s": %2$s', $this->slug, $e->getMessage() ) );
		}

		return $this;
	}

	/** @return array<string,Page> */
	public function pages(): array {
		return array_map(
			static function ( array $entry ): Page {
				return $entry['page'];
			},
			$this->pages
		);
	}

	public function page( string $id ): ?Page {
		return isset( $this->pages[ $id ] ) ? $this->pages[ $id ]['page'] : null;
	}

	/** @return array<int,array{id:string,label:string}> */
	public function groups(): array {
		return $this->groups;
	}

	public function store(): OptionStore {
		return $this->store;
	}

	/** Capability required for a page (page override, else the instance default). */
	public function capability_for( Page $page ): string {
		return '' !== $page->capability() ? $page->capability() : (string) $this->config['capability'];
	}

	/**
	 * Current value of one field (defaults filled, sanitized).
	 *
	 * @param string $page_id  Page id.
	 * @param string $field_id Field id.
	 * @param mixed  $fallback Returned when the page or field doesn't exist.
	 * @return mixed
	 */
	public function get( string $page_id, string $field_id, $fallback = null ) {
		$values = $this->all( $page_id );

		return array_key_exists( $field_id, $values ) ? $values[ $field_id ] : $fallback;
	}

	/**
	 * All values of a page, keyed by field id (defaults filled, sanitized).
	 *
	 * @return array<string,mixed>
	 */
	public function all( string $page_id ): array {
		$page = $this->page( $page_id );

		return null === $page ? array() : $this->store->values( $page );
	}

	/**
	 * Programmatic save through the same sanitize → validate → store path as the REST API.
	 *
	 * @param array<string,mixed> $values Field values keyed by field id.
	 * @return array{status:string,errors:array<string,string>,values:array<string,mixed>,revision:string}
	 */
	public function update( string $page_id, array $values ): array {
		$page = $this->page( $page_id );
		if ( null === $page ) {
			return array(
				'status'   => 'invalid',
				'errors'   => array( '_page' => 'Unknown page.' ),
				'values'   => array(),
				'revision' => '',
			);
		}

		return ( new Saver( $this ) )->save( $page, $values, null );
	}

	/**
	 * Restores the defaults of a page (what the Danger Section Card's `reset` action does), through the same path as REST.
	 *
	 * @return array{status:string,errors:array<string,string>,values:array<string,mixed>,revision:string}
	 */
	public function reset( string $page_id ): array {
		$page = $this->page( $page_id );
		if ( null === $page ) {
			return array(
				'status'   => 'invalid',
				'errors'   => array( '_page' => 'Unknown page.' ),
				'values'   => array(),
				'revision' => '',
			);
		}

		return ( new Saver( $this ) )->reset( $page );
	}

	/**
	 * A notice for the Fyldo screen, shown under the Page Header. It is NOT a WordPress admin notice: it never gets the
	 * core `.notice` class (core JS would move it out of the screen); Fyldo draws it in its own slot with its own
	 * Notice component. Call it before the screen's assets are enqueued (e.g. on `load-{screen}` or `admin_init`).
	 *
	 * @param string              $message Plain text: what happened and what to do next.
	 * @param array<string,mixed> $args    See Admin\Notice::normalize(): `tone`, `title`, `dismissible`, `page`, `id`, `action`.
	 */
	public function admin_notice( string $message, array $args = array() ): self {
		try {
			$notice = Notice::normalize( $message, $args );
		} catch ( ConfigException $e ) {
			self::doing_it_wrong( __METHOD__, sprintf( 'Fyldo "%1$s": %2$s', $this->slug, $e->getMessage() ) );

			return $this;
		}

		$this->notices[ $notice['id'] ] = $notice;

		if ( count( $this->notices ) > 3 ) {
			// Design rule 6: one notice per message, a stack of at most 2–3. Still shown, but it is a design smell.
			self::doing_it_wrong( __METHOD__, sprintf( 'Fyldo "%s": more than 3 notices at once. Keep the stack to 2–3, most severe first.', $this->slug ) );
		}

		return $this;
	}

	/**
	 * The notices for the screen, most severe first.
	 *
	 * @return array<int,array<string,mixed>>
	 */
	public function notices(): array {
		return Notice::sort( array_values( $this->notices ) );
	}

	public function hook_suffix(): string {
		return $this->hook_suffix;
	}

	public function set_hook_suffix( string $hook_suffix ): void {
		$this->hook_suffix = $hook_suffix;
	}

	/**
	 * `logo`: an Iconsax icon name (drawn at 24px) or an image URL (drawn 24×24; only what `esc_url_raw()` accepts).
	 * Omitted or null: the Fyldo mark.
	 *
	 * @param string $slug Instance slug (for messages).
	 * @param mixed  $logo Raw value.
	 * @return array{icon:string}|array{url:string}|null
	 * @throws ConfigException On an invalid logo.
	 */
	private static function normalize_logo( string $slug, $logo ): ?array {
		if ( null === $logo ) {
			return null;
		}
		if ( ! is_string( $logo ) || '' === trim( $logo ) ) {
			throw new ConfigException( sprintf( 'Fyldo "%s": logo must be an Iconsax icon name or an image URL.', $slug ) );
		}

		$logo = trim( $logo );
		// Icon names are kebab-case words; anything with a slash or a colon is a URL.
		if ( 1 !== preg_match( '#[/:]#', $logo ) ) {
			return array( 'icon' => $logo );
		}

		$url = esc_url_raw( $logo );
		if ( '' === $url ) {
			throw new ConfigException( sprintf( 'Fyldo "%1$s": the logo URL "%2$s" is not valid.', $slug, $logo ) );
		}

		return array( 'url' => $url );
	}

	/**
	 * Reports a developer mistake without taking the site down.
	 */
	public static function doing_it_wrong( string $function_name, string $message ): void {
		if ( function_exists( '_doing_it_wrong' ) ) {
			_doing_it_wrong( esc_html( $function_name ), esc_html( $message ), '1.0.0' );
			return;
		}

		trigger_error( $message, E_USER_NOTICE ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_trigger_error, WordPress.Security.EscapeOutput.OutputNotEscaped -- only without WordPress (unit tests); not HTML output.
	}
}
