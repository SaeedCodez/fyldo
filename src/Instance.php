<?php
/**
 * One settings panel, identified by its slug. Holds groups and pages; everything runtime-global is derived
 * from the slug (Support\Naming).
 *
 * @package Fyldo
 */

namespace Fyldo\V1;

use Fyldo\V1\Admin\Notice;
use Fyldo\V1\Fields\AbstractField;
use Fyldo\V1\Schema\ConfigException;
use Fyldo\V1\Schema\CustomPage;
use Fyldo\V1\Schema\Form;
use Fyldo\V1\Schema\Guarded;
use Fyldo\V1\Schema\Links;
use Fyldo\V1\Schema\Page;
use Fyldo\V1\Storage\DefaultHistory;
use Fyldo\V1\Storage\OptionStore;
use Fyldo\V1\Storage\Saver;
use Fyldo\V1\Support\Naming;
use Fyldo\V1\Support\Theme;
use Fyldo\V1\Support\Version;

/**
 * Public object returned by Fyldo::create().
 */
final class Instance {

	/** @internal */
	const KEYS = array( 'title', 'logo', 'theme', 'version', 'capability', 'navigation', 'menu', 'links' );

	/** @var string */
	private $slug;

	/** @var array<string,mixed> */
	private $config;

	/** @var array<int,array{id:string,label:string}> */
	private $groups = array();

	/** @var array<string,Page|CustomPage> Both kinds of page, in registration order (the navigation's); ids are unique across them. */
	private $pages = array();

	/** @var array<string,Form> Forms have ids of their own: a form may share an id with a page. */
	private $forms = array();

	/** @var OptionStore */
	private $store;

	/** @var array{icon:string}|array{url:string}|null The brand logo; null = the Fyldo mark. */
	private $logo;

	/** @var array<string,string> The plugin's colours: custom property → hex (Theme::normalize()); empty = Fyldo's. */
	private $theme;

	/** @var array<string,array<string,mixed>> Notices for the screen, by id (the same notice added twice is shown once). */
	private $notices = array();

	/** @var string Screen hook suffix returned by add_menu_page()/add_submenu_page(). */
	private $hook_suffix = '';

	/**
	 * @param string              $slug   Validated slug.
	 * @param array<string,mixed> $config Raw config.
	 * @throws ConfigException On invalid configuration.
	 * @internal
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
		// The plugin's colours (docs/theming.md).
		$theme = Theme::normalize( $slug, $config['theme'] ?? null );

		$navigation = isset( $config['navigation'] ) ? (string) $config['navigation'] : 'sidebar';
		if ( ! in_array( $navigation, array( 'sidebar', 'top' ), true ) ) {
			throw new ConfigException( sprintf( 'Fyldo "%s": navigation must be "sidebar" or "top".', $slug ) );
		}

		$menu_defaults = array(
			'type'     => 'submenu',
			'parent'   => 'options-general.php',
			'title'    => '', // '' = the instance title.
			'icon'     => 'dashicons-admin-generic', // WordPress menu icon (top-level only), not an Iconsax name.
			'position' => null,
		);

		$menu_config  = (array) ( $config['menu'] ?? array() );
		$unknown_menu = array_diff( array_keys( $menu_config ), array_keys( $menu_defaults ) );
		if ( array() !== $unknown_menu ) {
			throw new ConfigException( sprintf( 'Fyldo "%1$s": unknown menu key(s): %2$s. Use %3$s.', $slug, implode( ', ', $unknown_menu ), implode( ', ', array_keys( $menu_defaults ) ) ) );
		}
		$menu = array_merge( $menu_defaults, $menu_config );
		if ( ! in_array( $menu['type'], array( 'submenu', 'top' ), true ) ) {
			throw new ConfigException( sprintf( 'Fyldo "%s": menu.type must be "submenu" or "top".', $slug ) );
		}

		$links = Links::parse( $config['links'] ?? array(), sprintf( 'Fyldo "%s"', $slug ), true );

		$this->slug   = $slug;
		$this->logo   = $logo;
		$this->theme  = $theme;
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

	/**
	 * The plugin's colours as custom properties for the root element (empty = Fyldo's own).
	 *
	 * @return array<string,string>
	 * @internal
	 */
	public function theme(): array {
		return $this->theme;
	}

	/**
	 * The brand name: the configured title, or "Fyldo" (translated, so it is read when shown, not at `init`).
	 *
	 * @internal
	 */
	public function title(): string {
		return '' !== $this->config['title'] ? (string) $this->config['title'] : __( 'Fyldo', 'fyldo' );
	}

	/**
	 * The brand logo as the browser draws it: an Iconsax icon, an image URL, or null for the Fyldo mark.
	 *
	 * @return array{icon:string}|array{url:string}|null
	 * @internal
	 */
	public function logo(): ?array {
		return $this->logo;
	}

	/**
	 * The admin menu label: `menu.title`, else the brand name.
	 *
	 * @internal
	 */
	public function menu_title(): string {
		$title = (string) $this->config['menu']['title'];

		return '' !== $title ? $title : $this->title();
	}

	/**
	 * @return array<string,mixed>
	 * @internal
	 */
	public function config(): array {
		return $this->config;
	}

	/**
	 * Registers a navigation group: pages name it with their `group`. Configuration mistakes are reported with
	 * _doing_it_wrong() and the group is skipped.
	 *
	 * @param string $id    Group id (the rules of a page id).
	 * @param string $label Heading shown in the navigation.
	 */
	public function add_group( string $id, string $label ): self {
		try {
			if ( ! Naming::is_valid_page_id( $id ) ) {
				throw new ConfigException( sprintf( 'Group id "%s" is invalid: use lower-case letters, digits, "_" or "-" (max 40 characters).', $id ) );
			}
			foreach ( $this->groups as $group ) {
				if ( $group['id'] === $id ) {
					throw new ConfigException( sprintf( 'Group "%s" is already registered.', $id ) );
				}
			}
			if ( '' === trim( $label ) ) {
				throw new ConfigException( sprintf( 'Group "%s" needs a label.', $id ) );
			}
		} catch ( ConfigException $e ) {
			self::doing_it_wrong( __METHOD__, sprintf( 'Fyldo "%1$s": %2$s', $this->slug, $e->getMessage() ) );

			return $this;
		}

		$this->groups[] = array(
			'id'    => $id,
			'label' => trim( $label ),
		);

		return $this;
	}

	/**
	 * Reports each page whose `group` was never registered with add_group(). Called when the screens are registered
	 * (`admin_menu`), after every plugin has had its `init`; the navigation shows such a page ungrouped.
	 *
	 * @internal
	 */
	public function check_groups(): void {
		$known = array_column( $this->groups, 'id' );
		foreach ( $this->pages as $id => $page ) {
			$group = $page->group();
			if ( '' !== $group && ! in_array( $group, $known, true ) ) {
				self::doing_it_wrong( __METHOD__, sprintf( 'Fyldo "%1$s": page "%2$s" is in group "%3$s", which is not registered with add_group(); it is shown ungrouped.', $this->slug, $id, $group ) );
			}
		}
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

			$page = $this->make_page( $id, $config );
			if ( $page instanceof Page ) {
				$this->assert_option_free( $page );
			}
		} catch ( ConfigException $e ) {
			self::doing_it_wrong( __METHOD__, sprintf( 'Fyldo "%1$s": %2$s', $this->slug, $e->getMessage() ) );

			return $this;
		}

		$this->pages[ $id ] = $page;

		// Before anything reads the page: a plugin update keeps the defaults this site already had.
		if ( $page instanceof Page ) {
			( new DefaultHistory( $this ) )->apply( $page );
		}

		return $this;
	}

	/**
	 * `type`: "settings" (the default: sections → fields, stored in an option) or "custom" (drawn by the developer's
	 * module; see Schema\CustomPage).
	 *
	 * @param string              $id     Page id.
	 * @param array<string,mixed> $config Page config.
	 * @return Page|CustomPage
	 * @throws ConfigException On invalid configuration.
	 */
	private function make_page( string $id, array $config ) {
		$type = $config['type'] ?? 'settings';
		if ( 'custom' === $type ) {
			return new CustomPage( $id, $config );
		}
		if ( 'settings' !== $type ) {
			throw new ConfigException( sprintf( 'Page "%s": type must be "settings" (the default) or "custom".', $id ) );
		}

		unset( $config['type'] );
		$page = new Page( $this->slug, $id, $config );
		$this->assert_default_history( $page );

		return $page;
	}

	/**
	 * Registers a form: a field schema whose records the plugin stores (a row in its own table, a post…). Fyldo
	 * sanitizes, validates and checks the revision like on a settings page; `load` and `save` read and write. A custom
	 * page opens a record over REST. Configuration mistakes are reported with _doing_it_wrong() and the form is skipped.
	 *
	 * @param string              $id     Form id (the rules of a page id; forms have ids of their own).
	 * @param array<string,mixed> $config `sections` (as on a page: no tabs, no danger section), `load`
	 *                                    ( string $key ): ?array, `save` ( array $values, string $key ): string|WP_Error,
	 *                                    `capability` (default: the instance's).
	 */
	public function add_form( string $id, array $config ): self {
		try {
			if ( isset( $this->forms[ $id ] ) ) {
				throw new ConfigException( sprintf( 'Form "%s" is already registered.', $id ) );
			}

			$this->forms[ $id ] = new Form( $this->slug, $id, $config );
		} catch ( ConfigException $e ) {
			self::doing_it_wrong( __METHOD__, sprintf( 'Fyldo "%1$s": %2$s', $this->slug, $e->getMessage() ) );
		}

		return $this;
	}

	/**
	 * Two pages on one option overwrite each other's data, and Fyldo's own `{slug}__fyldo` holds the default history.
	 * An option name may belong to one page of one instance (any instance on the site) and is never a state option.
	 *
	 * @throws ConfigException On an option name that is taken.
	 */
	private function assert_option_free( Page $page ): void {
		$name      = $page->option_name();
		$instances = array_merge( Fyldo::instances(), array( $this->slug => $this ) ); // This slug is this instance, wherever else it is held.

		foreach ( $instances as $slug => $instance ) {
			if ( Naming::state_option( (string) $slug ) === $name ) {
				throw new ConfigException( sprintf( 'Page "%1$s": the option "%2$s" is Fyldo\'s own bookkeeping of "%3$s"; choose another `option_name`.', $page->id(), $name, $slug ) );
			}
			foreach ( $instance->pages() as $other ) {
				if ( $other->option_name() === $name ) {
					throw new ConfigException( sprintf( 'Page "%1$s": the option "%2$s" is already used by page "%3$s" of "%4$s"; two pages cannot share an option.', $page->id(), $name, $other->id(), $slug ) );
				}
			}
		}
	}

	/**
	 * `default_before` needs the instance `version` (to know which version a site came from), and lists only versions up
	 * to it.
	 *
	 * @throws ConfigException On a history that cannot apply.
	 */
	private function assert_default_history( Page $page ): void {
		$version = (string) $this->config['version'];

		foreach ( $page->fields() as $field ) {
			foreach ( array_keys( $field->default_before() ) as $before ) {
				if ( ! Version::is_valid( $version ) ) {
					throw new ConfigException( sprintf( 'Page "%1$s", field "%2$s": `default_before` needs the instance `version` (your plugin\'s version number, such as "2.0.0").', $page->id(), $field->id() ) );
				}
				if ( version_compare( (string) $before, $version, '>' ) ) {
					throw new ConfigException( sprintf( 'Page "%1$s", field "%2$s": `default_before` lists "%3$s", which is later than the instance version "%4$s".', $page->id(), $field->id(), $before, $version ) );
				}
			}
		}
	}

	/**
	 * The settings pages (the ones with values). Custom pages: custom_pages(); both, in order: all_pages().
	 *
	 * @return array<string,Page>
	 * @internal
	 */
	public function pages(): array {
		$pages = array();
		foreach ( $this->pages as $id => $page ) {
			if ( $page instanceof Page ) {
				$pages[ $id ] = $page;
			}
		}

		return $pages;
	}

	/** @internal */
	public function page( string $id ): ?Page {
		$page = $this->pages[ $id ] ?? null;

		return $page instanceof Page ? $page : null;
	}

	/**
	 * @return array<string,CustomPage>
	 * @internal
	 */
	public function custom_pages(): array {
		$pages = array();
		foreach ( $this->pages as $id => $page ) {
			if ( $page instanceof CustomPage ) {
				$pages[ $id ] = $page;
			}
		}

		return $pages;
	}

	/** @internal */
	public function custom_page( string $id ): ?CustomPage {
		$page = $this->pages[ $id ] ?? null;

		return $page instanceof CustomPage ? $page : null;
	}

	/**
	 * Every page, settings and custom, in registration order: the navigation.
	 *
	 * @return array<string,Page|CustomPage>
	 * @internal
	 */
	public function all_pages(): array {
		return $this->pages;
	}

	/**
	 * @return array<string,Form>
	 * @internal
	 */
	public function forms(): array {
		return $this->forms;
	}

	/** @internal */
	public function form( string $id ): ?Form {
		return $this->forms[ $id ] ?? null;
	}

	/**
	 * @return array<int,array{id:string,label:string}>
	 * @internal
	 */
	public function groups(): array {
		return $this->groups;
	}

	/** @internal */
	public function store(): OptionStore {
		return $this->store;
	}

	/**
	 * Capability required for a page of either kind or a form (its override, else the instance default).
	 *
	 * @internal
	 */
	public function capability_for( Guarded $target ): string {
		return '' !== $target->capability() ? $target->capability() : (string) $this->config['capability'];
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
	 * Programmatic save through the same sanitize → validate → store path as the REST API, with one difference: the
	 * caller is the plugin's own code, not a request, so the checks that depend on the current user are off. A `post`,
	 * `term`, `user`, `image` or `file` value (on its own or in a group) only has to exist and fit the field, whoever
	 * is logged in, so a save from cron or WP-CLI (no user) keeps it. Values that come from a request must be checked by
	 * the plugin first (`current_user_can( 'read_post', $id )`), or saved through the REST route instead.
	 *
	 * `values` is what all() returns for the page after the save (a password as stored, and no `media` key: that is for the browser).
	 *
	 * @param string              $page_id Page id.
	 * @param array<string,mixed> $values  Field values keyed by field id.
	 * @return array{status:string,errors:array<string,string>,values:array<string,mixed>,revision:string}
	 *         status: `ok` | `invalid` (also an unknown page: `errors['_page']`, `values` empty).
	 */
	public function update( string $page_id, array $values ): array {
		$page = $this->page( $page_id );
		if ( null === $page ) {
			return self::unknown_page();
		}

		return $this->outcome( $page, AbstractField::trusted( fn() => ( new Saver( $this ) )->save( $page, $values, null ) ) );
	}

	/**
	 * Restores the defaults of a page (what the Danger Section Card's `reset` action does), through the same path as REST.
	 * Same result as update(): `values` is what all() returns for the page afterwards.
	 *
	 * @param string $page_id Page id.
	 * @return array{status:string,errors:array<string,string>,values:array<string,mixed>,revision:string}
	 */
	public function reset( string $page_id ): array {
		$page = $this->page( $page_id );
		if ( null === $page ) {
			return self::unknown_page();
		}

		return $this->outcome( $page, ( new Saver( $this ) )->reset( $page ) );
	}

	/**
	 * @return array{status:string,errors:array<string,string>,values:array<string,mixed>,revision:string}
	 */
	private static function unknown_page(): array {
		return array(
			'status'   => 'invalid',
			'errors'   => array( '_page' => 'Unknown page.' ),
			'values'   => array(),
			'revision' => '',
		);
	}

	/**
	 * What update() and reset() return: the Saver's status, errors and revision, and the values as all() reads them.
	 *
	 * @param Page                $page   The page that was saved.
	 * @param array<string,mixed> $result The Saver's result.
	 * @return array{status:string,errors:array<string,string>,values:array<string,mixed>,revision:string}
	 */
	private function outcome( Page $page, array $result ): array {
		return array(
			'status'   => $result['status'],
			'errors'   => $result['errors'],
			'values'   => $this->store->values( $page ),
			'revision' => $result['revision'],
		);
	}

	/**
	 * Deletes everything this instance stored on the site: the option of every registered page and Fyldo's own
	 * `{slug}__fyldo`. For the consumer's `uninstall.php`; Fyldo itself never deletes consumer data. Fires no hooks.
	 */
	public function delete_data(): void {
		foreach ( $this->pages() as $page ) {
			$this->store->delete( $page );
		}

		delete_option( Naming::state_option( $this->slug ) );
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
	 * @internal
	 */
	public function notices(): array {
		return Notice::sort( array_values( $this->notices ) );
	}

	/** @internal */
	public function hook_suffix(): string {
		return $this->hook_suffix;
	}

	/** @internal */
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
	 *
	 * @internal
	 */
	public static function doing_it_wrong( string $function_name, string $message ): void {
		if ( function_exists( '_doing_it_wrong' ) ) {
			_doing_it_wrong( esc_html( $function_name ), esc_html( $message ), '1.0.0' );
			return;
		}

		trigger_error( $message, E_USER_NOTICE ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_trigger_error, WordPress.Security.EscapeOutput.OutputNotEscaped -- only without WordPress (unit tests); not HTML output.
	}
}
