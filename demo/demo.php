<?php
/**
 * The demo dashboard: pages of sample settings plus one custom page (demo/announcements.php), shown only when Fyldo is
 * installed as a plugin (`wp-content/plugins/fyldo/`), never as a drop-in folder or a Composer package. `fyldo.php` decides that; this
 * file only declares the pages with the public API, exactly as a consumer plugin would (PHP, plus three tiny SVGs for the Choice Card demo).
 *
 * Strings use Fyldo's own text domain, so the demo follows the site (or profile) language: English or فارسی.
 * Turn it off with the `fyldo/fyldo-demo/enabled` filter.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Demo;

use Fyldo\V1\Bootstrap\Loader;
use Fyldo\V1\Fyldo;
use Fyldo\V1\Support\Naming;

/**
 * Registers the demo instance.
 */
final class Demo {

	const SLUG = 'fyldo-demo';

	/**
	 * A sample theme (docs/theming.md): the "Pelk" mode of the Theme collection in Fyldo's Figma file, a coral brand on
	 * warm neutrals. The demo uses Fyldo's own colours; to see it in this theme instead:
	 * `add_filter( 'fyldo/fyldo-demo/theme', fn() => \Fyldo\V1\Demo\Demo::SAMPLE_THEME );`
	 */
	const SAMPLE_THEME = array(
		'brand'   => array(
			'50'  => '#fff7f4',
			'100' => '#fff1ec',
			'200' => '#ffdcd2',
			'300' => '#ffc0b0',
			'400' => '#ffa18a',
			'500' => '#ff8566',
			'600' => '#ff6b4a',
			'700' => '#c8401f',
			'800' => '#a33317',
			'900' => '#82290f',
			'950' => '#4a170a',
		),
		'neutral' => array(
			'background-100' => '#ffffff',
			'background-200' => '#faf7f5',
			'100'            => '#f4f1ef',
			'200'            => '#ede8e5',
			'300'            => '#e8e2de',
			'400'            => '#d9d4d0',
			'500'            => '#bdb6bb',
			'600'            => '#a39dae',
			'700'            => '#8a8494',
			'800'            => '#7a7484',
			'850'            => '#6b6675',
			'900'            => '#4a4557',
			'1000'           => '#1c1a2b',
			'1000-hover'     => '#2a2738',
			'overlay'        => '#15131f73',
		),
	);

	/** @var string Main plugin file (for the "Open demo" link on the Plugins screen). */
	private static $main_file = '';

	/**
	 * Hooks the demo. Called once, from fyldo.php, when Fyldo is installed as a plugin.
	 *
	 * @param string $main_file Absolute path of fyldo.php.
	 */
	public static function boot( string $main_file ): void {
		self::$main_file = $main_file;

		require_once __DIR__ . '/announcements.php';
		Announcements::boot();

		add_action( 'init', array( self::class, 'register' ) );
		add_filter( 'plugin_action_links', array( self::class, 'action_links' ), 10, 2 );
	}

	/**
	 * Adds "Open demo" to the plugin's row on the Plugins screen.
	 *
	 * @param mixed  $actions     Existing action links.
	 * @param string $plugin_file Plugin basename of the row.
	 * @return mixed
	 */
	public static function action_links( $actions, $plugin_file = '' ) {
		if ( ! is_array( $actions ) || plugin_basename( self::$main_file ) !== $plugin_file || ! current_user_can( 'manage_options' ) || ! self::enabled() ) {
			return $actions;
		}

		$url = add_query_arg( 'page', self::SLUG, admin_url( 'options-general.php' ) );

		return array_merge( array( 'demo' => '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Open demo', 'fyldo' ) . '</a>' ), $actions );
	}

	/** Whether the demo is on (filter `fyldo/fyldo-demo/enabled`, default true). */
	public static function enabled(): bool {
		return (bool) apply_filters( Naming::hook( self::SLUG, 'enabled' ), true );
	}

	/** Creates the instance and its pages. Runs on `init`, like any consumer plugin. */
	public static function register(): void {
		if ( ! self::enabled() ) {
			return;
		}

		$fyldo = Fyldo::create(
			self::SLUG,
			array(
				'title'   => __( 'Fyldo demo', 'fyldo' ),
				'version' => (string) Loader::loaded_version(),
				// Fyldo's own colours unless a theme is set through the filter (see SAMPLE_THEME).
				'theme'   => apply_filters( Naming::hook( self::SLUG, 'theme' ), array() ),
				'links'   => array(
					array(
						'label'    => __( 'Documentation', 'fyldo' ),
						'url'      => 'https://github.com/SaeedCodez/fyldo#readme',
						'icon'     => 'book-1',
						'external' => true,
					),
					array(
						'label'    => __( 'Report an issue', 'fyldo' ),
						'url'      => 'https://github.com/SaeedCodez/fyldo/issues',
						'icon'     => 'message-question',
						'external' => true,
					),
				),
			)
		);

		$fyldo->add_group( 'settings', __( 'Settings', 'fyldo' ) );
		$fyldo->add_group( 'tools', __( 'Tools', 'fyldo' ) );
		$fyldo->add_group( 'manage', __( 'Content', 'fyldo' ) );

		$fyldo->add_page( 'overview', self::overview() );
		$fyldo->add_page( 'general', self::general() );
		$fyldo->add_page( 'content', self::content() );
		$fyldo->add_page( 'header', self::header() );
		$fyldo->add_page( 'links', self::links() );
		$fyldo->add_page( 'dates', self::dates() );
		$fyldo->add_page( 'security', self::security() );
		$fyldo->add_page( 'hours', self::hours() );

		// A custom page (the plugin draws it) with a form whose records live in the demo's own table.
		Announcements::register( $fyldo, self::$main_file );

		$fyldo->admin_notice(
			__( 'This demo is only added when Fyldo is installed as a plugin. Return false from the fyldo/fyldo-demo/enabled filter to hide it.', 'fyldo' ),
			array(
				'id'   => 'demo-hint',
				'page' => 'overview',
			)
		);
	}

	/** A welcome page: display-only notices, nothing to save. */
	private static function overview(): array {
		return array(
			'title'       => __( 'Overview', 'fyldo' ),
			'description' => __( 'A live tour of what a settings screen built with Fyldo looks like.', 'fyldo' ),
			'icon'        => 'home-2',
			'sections'    => array(
				array(
					'id'     => 'welcome',
					'title'  => __( 'Welcome', 'fyldo' ),
					'fields' => array(
						array(
							'id'          => 'welcome_note',
							'type'        => 'notice',
							'tone'        => 'blue',
							'label'       => __( 'Everything here is declared in PHP', 'fyldo' ),
							'description' => __( 'Pages, sections and fields come from one array. Change a value, save it and reload: it is stored in a normal WordPress option.', 'fyldo' ),
						),
						array(
							'id'          => 'language_note',
							'type'        => 'notice',
							'label'       => __( 'English and فارسی', 'fyldo' ),
							'description' => __( 'The screen follows your language. Set your profile language to فارسی to see the right-to-left layout.', 'fyldo' ),
						),
					),
				),
				array(
					'id'          => 'tour',
					'title'       => __( 'Take the tour', 'fyldo' ),
					'description' => __( 'Each page shows different building blocks.', 'fyldo' ),
					'fields'      => array(
						array(
							'id'          => 'tour_general',
							'type'        => 'notice',
							'tone'        => 'green',
							'label'       => __( 'General', 'fyldo' ),
							'description' => __( 'Text, URL, email, textarea, toggle, select and radio fields with one Save Bar for the whole page.', 'fyldo' ),
						),
						array(
							'id'          => 'tour_content',
							'type'        => 'notice',
							'tone'        => 'green',
							'label'       => __( 'Content', 'fyldo' ),
							'description' => __( 'Tabs, checkbox groups, multi select and number fields, saved card by card.', 'fyldo' ),
						),
						array(
							'id'          => 'tour_header',
							'type'        => 'notice',
							'tone'        => 'green',
							'label'       => __( 'Header', 'fyldo' ),
							'description' => __( 'Groups of fields: fixed header buttons, ones you can reorder, add and remove, and a group that starts empty.', 'fyldo' ),
						),
						array(
							'id'          => 'tour_links',
							'type'        => 'notice',
							'tone'        => 'green',
							'label'       => __( 'Links', 'fyldo' ),
							'description' => __( 'Post, term and user fields: search the site’s pages, posts, categories, tags and users, and pick one or several.', 'fyldo' ),
						),
						array(
							'id'          => 'tour_security',
							'type'        => 'notice',
							'tone'        => 'amber',
							'label'       => __( 'Security', 'fyldo' ),
							'description' => __( 'A write-only password, a disabled field, a server-side rule and a Danger card that resets the page.', 'fyldo' ),
						),
						array(
							'id'          => 'tour_hours',
							'type'        => 'notice',
							'label'       => __( 'Custom field', 'fyldo' ),
							'description' => __( 'A field Fyldo does not ship: two selects drawn by a small JavaScript module and saved as one value.', 'fyldo' ),
						),
					),
				),
			),
		);
	}

	/** One Save Bar for the whole page. */
	private static function general(): array {
		return array(
			'title'       => __( 'General', 'fyldo' ),
			'description' => __( 'Your site’s identity and how search engines see it.', 'fyldo' ),
			'icon'        => 'setting-2',
			'group'       => 'settings',
			'save'        => 'global',
			'sections'    => array(
				array(
					'id'          => 'identity',
					'title'       => __( 'Site identity', 'fyldo' ),
					'description' => __( 'How your site introduces itself.', 'fyldo' ),
					'fields'      => array(
						array(
							'id'          => 'site_title',
							'type'        => 'text',
							'label'       => __( 'Site title', 'fyldo' ),
							'description' => __( 'Shown in the browser tab and in search results.', 'fyldo' ),
							'default'     => __( 'My WordPress site', 'fyldo' ),
							'validate'    => array(
								'required'   => true,
								'max_length' => 60,
							),
						),
						array(
							'id'          => 'home_url',
							'type'        => 'url',
							'label'       => __( 'Home address', 'fyldo' ),
							'description' => __( 'Only https addresses are accepted.', 'fyldo' ),
							'placeholder' => 'https://example.com',
							'validate'    => array( 'schemes' => array( 'https' ) ),
						),
						array(
							'id'          => 'contact_email',
							'type'        => 'email',
							'label'       => __( 'Contact email', 'fyldo' ),
							'placeholder' => 'name@example.com',
						),
						array(
							'id'          => 'tagline',
							'type'        => 'textarea',
							'label'       => __( 'Tagline', 'fyldo' ),
							'description' => __( 'A short sentence, up to 160 characters.', 'fyldo' ),
							'rows'        => 3,
							'validate'    => array( 'max_length' => 160 ),
						),
						array(
							'id'          => 'maintenance',
							'type'        => 'toggle',
							'label'       => __( 'Maintenance mode', 'fyldo' ),
							'description' => __( 'Show a coming-soon page to visitors. Administrators still see the site.', 'fyldo' ),
							'default'     => false,
						),
					),
				),
				array(
					'id'     => 'reading',
					'title'  => __( 'Language and indexing', 'fyldo' ),
					'fields' => array(
						array(
							'id'         => 'language',
							'type'       => 'select',
							'label'      => __( 'Site language', 'fyldo' ),
							'icon'       => 'global',
							'searchable' => true,
							'default'    => 'en_US',
							'options'    => array(
								array(
									'value' => 'en_US',
									'label' => 'English (United States)',
								),
								array(
									'value' => 'fa_IR',
									'label' => 'فارسی',
								),
								array(
									'value' => 'de_DE',
									'label' => 'Deutsch',
								),
								array(
									'value' => 'fr_FR',
									'label' => 'Français',
								),
								array(
									'value' => 'es_ES',
									'label' => 'Español',
								),
								array(
									'value' => 'tr_TR',
									'label' => 'Türkçe',
								),
							),
						),
						array(
							'id'      => 'robots',
							'type'    => 'radio',
							'label'   => __( 'Search engine visibility', 'fyldo' ),
							'default' => 'index',
							'options' => array(
								array(
									'value'       => 'index',
									'label'       => __( 'Index', 'fyldo' ),
									'description' => __( 'Let search engines list this site.', 'fyldo' ),
								),
								array(
									'value'       => 'noindex',
									'label'       => __( 'Discourage indexing', 'fyldo' ),
									'description' => __( 'Ask search engines to skip this site.', 'fyldo' ),
								),
							),
						),
					),
				),
			),
		);
	}

	/** Tabs, and a Save button on every card. */
	private static function content(): array {
		return array(
			'title'       => __( 'Content', 'fyldo' ),
			'description' => __( 'What is shown, where, and how much of it.', 'fyldo' ),
			'icon'        => 'document-text',
			'group'       => 'settings',
			'save'        => 'section',
			'tabs'        => array(
				'display' => __( 'Display', 'fyldo' ),
				'limits'  => array(
					'label' => __( 'Limits', 'fyldo' ),
					'badge' => 2,
				),
			),
			'sections'    => array(
				array(
					'id'          => 'where',
					'tab'         => 'display',
					'title'       => __( 'Where to show it', 'fyldo' ),
					'description' => __( 'Each card saves on its own.', 'fyldo' ),
					'fields'      => array(
						array(
							'id'       => 'post_types',
							'type'     => 'checkbox_group',
							'label'    => __( 'Show on', 'fyldo' ),
							'parent'   => __( 'All post types', 'fyldo' ),
							'default'  => array( 'post', 'page' ),
							'validate' => array( 'min' => 1 ),
							'options'  => array(
								array(
									'value' => 'post',
									'label' => __( 'Posts', 'fyldo' ),
								),
								array(
									'value' => 'page',
									'label' => __( 'Pages', 'fyldo' ),
								),
								array(
									'value'       => 'product',
									'label'       => __( 'Products', 'fyldo' ),
									'description' => __( 'Not available in the demo.', 'fyldo' ),
									'disabled'    => true,
								),
							),
						),
						array(
							'id'          => 'sitemap_types',
							'type'        => 'multi_select',
							'label'       => __( 'Include in the sitemap', 'fyldo' ),
							'placeholder' => __( 'Select content types…', 'fyldo' ),
							'clearable'   => true,
							'default'     => array( 'post', 'page' ),
							'validate'    => array( 'max' => 4 ),
							'options'     => array(
								array(
									'value' => 'post',
									'label' => __( 'Posts', 'fyldo' ),
								),
								array(
									'value' => 'page',
									'label' => __( 'Pages', 'fyldo' ),
								),
								array(
									'value' => 'category',
									'label' => __( 'Categories', 'fyldo' ),
								),
								array(
									'value' => 'tag',
									'label' => __( 'Tags', 'fyldo' ),
								),
								array(
									'value' => 'author',
									'label' => __( 'Authors', 'fyldo' ),
								),
							),
						),
					),
				),
				array(
					'id'     => 'style',
					'tab'    => 'display',
					'title'  => __( 'Layout', 'fyldo' ),
					'fields' => array(
						array(
							'id'      => 'layout',
							'type'    => 'radio',
							'label'   => __( 'Page layout', 'fyldo' ),
							'default' => 'full',
							'options' => array(
								array(
									'value' => 'full',
									'label' => __( 'Full width', 'fyldo' ),
								),
								array(
									'value' => 'boxed',
									'label' => __( 'Boxed', 'fyldo' ),
								),
							),
						),
						array(
							'id'          => 'color_scheme',
							'type'        => 'choice',
							'label'       => __( 'Theme', 'fyldo' ),
							'description' => __( 'Choose how the settings panel looks.', 'fyldo' ),
							'default'     => 'light',
							'columns'     => 3,
							'options'     => array(
								array(
									'value'       => 'light',
									'label'       => __( 'Light', 'fyldo' ),
									'description' => __( 'Bright surfaces', 'fyldo' ),
									'image'       => plugins_url( 'demo/choice-light.svg', self::$main_file ),
								),
								array(
									'value'       => 'dark',
									'label'       => __( 'Dark', 'fyldo' ),
									'description' => __( 'Low-light ready', 'fyldo' ),
									'image'       => plugins_url( 'demo/choice-dark.svg', self::$main_file ),
								),
								array(
									'value'       => 'system',
									'label'       => __( 'System', 'fyldo' ),
									'description' => __( 'Match device', 'fyldo' ),
									'image'       => plugins_url( 'demo/choice-system.svg', self::$main_file ),
								),
							),
						),
						array(
							'id'          => 'sort_by',
							'type'        => 'segmented',
							'label'       => __( 'Sort products', 'fyldo' ),
							'description' => __( 'Choose how the list is grouped.', 'fyldo' ),
							'default'     => 'product',
							'options'     => array(
								'order'   => __( 'By order', 'fyldo' ),
								'product' => __( 'By product', 'fyldo' ),
								'simple'  => __( 'Simple', 'fyldo' ),
							),
						),
						array(
							'id'      => 'show_dates',
							'type'    => 'checkbox',
							'label'   => __( 'Show publish dates', 'fyldo' ),
							'default' => true,
						),
						array(
							'id'          => 'accent_color',
							'type'        => 'color',
							'label'       => __( 'Accent color', 'fyldo' ),
							'description' => __( 'Used for links and buttons on your settings page.', 'fyldo' ),
							'default'     => '#2271b1',
						),
						array(
							'id'          => 'menu_icon',
							'type'        => 'icon',
							'label'       => __( 'Menu icon', 'fyldo' ),
							'description' => __( 'Shown next to the menu item.', 'fyldo' ),
							'default'     => 'home-2',
						),
						array(
							'id'          => 'site_logo',
							'type'        => 'image',
							'label'       => __( 'Site logo', 'fyldo' ),
							'description' => __( 'Shown in the sidebar and on the login screen.', 'fyldo' ),
							'max_size'    => '2MB',
						),
						array(
							'id'          => 'brand_guidelines',
							'type'        => 'file',
							'label'       => __( 'Brand guidelines', 'fyldo' ),
							'description' => __( 'Offered as a download on the About tab.', 'fyldo' ),
							'types'       => array( 'document', 'archive', 'image' ),
						),
					),
				),
				array(
					'id'          => 'amounts',
					'tab'         => 'limits',
					'title'       => __( 'Amounts', 'fyldo' ),
					'description' => __( 'Numbers are checked in the browser and again on the server.', 'fyldo' ),
					'fields'      => array(
						array(
							'id'          => 'per_page',
							'type'        => 'number',
							'label'       => __( 'Items per page', 'fyldo' ),
							'description' => __( 'Between 5 and 100, in steps of 5.', 'fyldo' ),
							'default'     => 10,
							'validate'    => array(
								'min'  => 5,
								'max'  => 100,
								'step' => 5,
							),
						),
						array(
							'id'          => 'excerpt_words',
							'type'        => 'number',
							'label'       => __( 'Excerpt length', 'fyldo' ),
							'description' => __( 'In words, between 10 and 200.', 'fyldo' ),
							'default'     => 55,
							'validate'    => array(
								'min' => 10,
								'max' => 200,
							),
						),
						array(
							'id'          => 'image_quality',
							'type'        => 'slider',
							'label'       => __( 'Image quality', 'fyldo' ),
							'description' => __( 'Higher quality creates larger files.', 'fyldo' ),
							'default'     => 75,
							'min'         => 0,
							'max'         => 100,
							'step'        => 5,
						),
					),
				),
			),
		);
	}

	/**
	 * The Group field, as in the Figma "Group · Usage" frame: a fixed group, an editable one (reorder, add, duplicate,
	 * remove, 1 to 5 items), one that can only be reordered, and one that starts empty.
	 */
	private static function header(): array {
		$buttons = array(
			array(
				'label' => __( 'Pricing', 'fyldo' ),
				'icon'  => 'dollar-circle',
				'link'  => 'https://example.com/pricing',
			),
			array(
				'label' => __( 'Docs', 'fyldo' ),
				'icon'  => 'book',
				'link'  => 'https://example.com/docs',
			),
			array(
				'label' => __( 'Get started', 'fyldo' ),
				'icon'  => 'flash',
				'link'  => 'https://example.com/signup',
			),
		);
		$button  = array(
			'type'        => 'group',
			'label'       => __( 'Header buttons', 'fyldo' ),
			'description' => __( 'Buttons shown in the site header, in this order.', 'fyldo' ),
			'item_title'  => 'label',
			'item_icon'   => 'icon',
			'fields'      => array(
				array(
					'id'       => 'label',
					'type'     => 'text',
					'label'    => __( 'Label', 'fyldo' ),
					'validate' => array( 'required' => true ),
				),
				array(
					'id'      => 'icon',
					'type'    => 'icon',
					'label'   => __( 'Icon', 'fyldo' ),
					'default' => 'star',
				),
				array(
					'id'          => 'link',
					'type'        => 'url',
					'label'       => __( 'Link', 'fyldo' ),
					'description' => __( 'A full URL, like https://example.com/pricing.', 'fyldo' ),
					'validate'    => array( 'required' => true ),
				),
			),
			'default'     => $buttons,
		);

		return array(
			'title'       => __( 'Header', 'fyldo' ),
			'description' => __( 'Buttons and links of the site header, set up as groups of fields.', 'fyldo' ),
			'icon'        => 'element-3',
			'group'       => 'settings',
			'save'        => 'global',
			'sections'    => array(
				array(
					'id'          => 'fixed',
					'title'       => __( 'Fixed group', 'fyldo' ),
					'description' => __( 'The plugin sets the three buttons. You can change what is inside each one, but not how many there are or their order.', 'fyldo' ),
					'fields'      => array(
						array_merge( $button, array( 'id' => 'fixed_buttons' ) ),
					),
				),
				array(
					'id'          => 'editable',
					'title'       => __( 'Editable group', 'fyldo' ),
					'description' => __( 'Reorder the buttons with their handles, add up to five, duplicate or remove them. At least one has to stay.', 'fyldo' ),
					'fields'      => array(
						array_merge(
							$button,
							array(
								'id'        => 'header_buttons',
								'sortable'  => true,
								'addable'   => true,
								'min'       => 1,
								'max'       => 5,
								'add_label' => __( 'Add button', 'fyldo' ),
							)
						),
					),
				),
				array(
					'id'          => 'reorder',
					'title'       => __( 'Reorder only', 'fyldo' ),
					'description' => __( 'The same three buttons in the mobile menu: you can change their order, but not add or remove any.', 'fyldo' ),
					'fields'      => array(
						array_merge(
							$button,
							array(
								'id'          => 'mobile_buttons',
								'label'       => __( 'Mobile menu buttons', 'fyldo' ),
								'description' => __( 'Shown in this order in the mobile menu.', 'fyldo' ),
								'sortable'    => true,
							)
						),
					),
				),
				array(
					'id'          => 'empty',
					'title'       => __( 'Starts empty', 'fyldo' ),
					'description' => __( 'A group without default items shows an empty state with the Add button.', 'fyldo' ),
					'fields'      => array(
						array(
							'id'          => 'social_links',
							'type'        => 'group',
							'label'       => __( 'Social links', 'fyldo' ),
							'description' => __( 'Shown as icons in the site footer.', 'fyldo' ),
							'item_title'  => 'label',
							'item_icon'   => 'icon',
							'sortable'    => true,
							'addable'     => true,
							'max'         => 4,
							'add_label'   => __( 'Add link', 'fyldo' ),
							'fields'      => array(
								array(
									'id'       => 'label',
									'type'     => 'text',
									'label'    => __( 'Label', 'fyldo' ),
									'validate' => array( 'required' => true ),
								),
								array(
									'id'      => 'icon',
									'type'    => 'icon',
									'label'   => __( 'Icon', 'fyldo' ),
									'icons'   => array( 'instagram', 'youtube', 'whatsapp', 'global' ),
									'default' => 'global',
								),
								array(
									'id'       => 'link',
									'type'     => 'url',
									'label'    => __( 'Link', 'fyldo' ),
									'validate' => array( 'required' => true ),
								),
							),
						),
					),
				),
			),
		);
	}

	/**
	 * Date, time and datetime fields: Jalali and Gregorian, `today` / `now` bounds, minute steps, and the fields inside a group.
	 * Stored Gregorian (`Y-m-d`, `H:i`) and a datetime in UTC, whatever the calendar on screen.
	 */
	private static function dates(): array {
		return array(
			'title'       => __( 'Dates and times', 'fyldo' ),
			'description' => __( 'Dates show in the Jalali or the Gregorian calendar; what is saved is always Gregorian, a datetime in UTC.', 'fyldo' ),
			'icon'        => 'calendar',
			'group'       => 'settings',
			'save'        => 'global',
			'sections'    => array(
				array(
					'id'          => 'sale',
					'title'       => __( 'Sale', 'fyldo' ),
					'description' => __( 'When the next sale starts and ends, in the site’s time zone.', 'fyldo' ),
					'fields'      => array(
						array(
							'id'          => 'launch_date',
							'type'        => 'date',
							'label'       => __( 'Launch date', 'fyldo' ),
							'description' => __( 'Today or later.', 'fyldo' ),
							'min'         => 'today',
						),
						array(
							'id'          => 'sale_starts',
							'type'        => 'datetime',
							'label'       => __( 'Sale starts', 'fyldo' ),
							'description' => __( 'In steps of 5 minutes. Saved in UTC.', 'fyldo' ),
							'step'        => 5,
							'validate'    => array( 'required' => true ),
						),
						array(
							'id'          => 'sale_ends',
							'type'        => 'datetime',
							'label'       => __( 'Sale ends', 'fyldo' ),
							'description' => __( 'Leave empty to keep the sale running.', 'fyldo' ),
						),
					),
				),
				array(
					'id'          => 'calendars',
					'title'       => __( 'Calendars', 'fyldo' ),
					'description' => __( 'A field can follow the site language (with a switch) or be locked to one calendar.', 'fyldo' ),
					'fields'      => array(
						array(
							'id'          => 'birthday',
							'type'        => 'date',
							'label'       => __( 'Birthday', 'fyldo' ),
							'description' => __( 'Always in the Jalali calendar.', 'fyldo' ),
							'calendar'    => 'jalali',
						),
						array(
							'id'          => 'invoice_date',
							'type'        => 'date',
							'label'       => __( 'Invoice date', 'fyldo' ),
							'description' => __( 'Always in the Gregorian calendar.', 'fyldo' ),
							'calendar'    => 'gregorian',
						),
						array(
							'id'          => 'holiday',
							'type'        => 'date',
							'label'       => __( 'Next holiday', 'fyldo' ),
							'description' => __( 'Follows the site language; switch the calendar in the panel.', 'fyldo' ),
							'calendar'    => 'auto',
						),
					),
				),
				array(
					'id'          => 'times',
					'title'       => __( 'Times', 'fyldo' ),
					'description' => __( 'Type a time (24-hour) or pick it from the hour and minute columns.', 'fyldo' ),
					'fields'      => array(
						array(
							'id'          => 'report_time',
							'type'        => 'time',
							'label'       => __( 'Send the daily report at', 'fyldo' ),
							'description' => __( 'In steps of 15 minutes.', 'fyldo' ),
							'step'        => 15,
							'default'     => '09:00',
						),
						array(
							'id'          => 'quiet_from',
							'type'        => 'time',
							'label'       => __( 'Quiet hours start at', 'fyldo' ),
							'description' => __( 'No notifications are sent after this time.', 'fyldo' ),
							'default'     => '22:00',
						),
					),
				),
				array(
					'id'          => 'events',
					'title'       => __( 'Events', 'fyldo' ),
					'description' => __( 'Date and time fields work inside a group too.', 'fyldo' ),
					'fields'      => array(
						array(
							'id'          => 'events',
							'type'        => 'group',
							'label'       => __( 'Events', 'fyldo' ),
							'description' => __( 'Shown on the events page, in this order.', 'fyldo' ),
							'item_title'  => 'title',
							'sortable'    => true,
							'addable'     => true,
							'add_label'   => __( 'Add event', 'fyldo' ),
							'fields'      => array(
								array(
									'id'       => 'title',
									'type'     => 'text',
									'label'    => __( 'Title', 'fyldo' ),
									'validate' => array( 'required' => true ),
								),
								array(
									'id'       => 'day',
									'type'     => 'date',
									'label'    => __( 'Day', 'fyldo' ),
									'validate' => array( 'required' => true ),
								),
								array(
									'id'    => 'at',
									'type'  => 'time',
									'label' => __( 'Time', 'fyldo' ),
								),
								array(
									'id'    => 'booking',
									'type'  => 'date_range',
									'label' => __( 'Booking open', 'fyldo' ),
								),
							),
						),
					),
				),
				array(
					'id'          => 'ranges',
					'title'       => __( 'Ranges', 'fyldo' ),
					'description' => __( 'Two inputs, start and end; each opens the same picker as a single field.', 'fyldo' ),
					'fields'      => array(
						array(
							'id'          => 'sale_period',
							'type'        => 'date_range',
							'label'       => __( 'Sale period', 'fyldo' ),
							'description' => __( 'Both days are counted. Today or later.', 'fyldo' ),
							'min'         => 'today',
						),
						array(
							'id'          => 'opening_hours',
							'type'        => 'time_range',
							'label'       => __( 'Opening hours', 'fyldo' ),
							'description' => __( 'In steps of 15 minutes.', 'fyldo' ),
							'step'        => 15,
						),
						array(
							'id'          => 'quiet_hours',
							'type'        => 'time_range',
							'label'       => __( 'Quiet hours', 'fyldo' ),
							'description' => __( 'May cross midnight: an end before the start is the next day.', 'fyldo' ),
							'default'     => array(
								'start' => '22:00',
								'end'   => '07:00',
							),
						),
						array(
							'id'          => 'campaign',
							'type'        => 'datetime_range',
							'label'       => __( 'Campaign', 'fyldo' ),
							'description' => __( 'In steps of 5 minutes. Saved in UTC.', 'fyldo' ),
							'step'        => 5,
						),
					),
				),
			),
		);
	}

	/** Write-only secrets, server-only rules and the Danger card. */
	private static function security(): array {
		return array(
			'title'       => __( 'Security', 'fyldo' ),
			'description' => __( 'Keys, accounts and a way back to the defaults.', 'fyldo' ),
			'icon'        => 'shield-tick',
			'group'       => 'tools',
			'save'        => 'global',
			'sections'    => array(
				array(
					'id'          => 'access',
					'title'       => __( 'Access', 'fyldo' ),
					'description' => __( 'Nothing you type here leaves this site.', 'fyldo' ),
					'fields'      => array(
						array(
							'id'          => 'api_key',
							'type'        => 'password',
							'label'       => __( 'API key', 'fyldo' ),
							'description' => __( 'Write-only: once saved, the key is never sent back to the browser.', 'fyldo' ),
							'validate'    => array( 'min_length' => 8 ),
						),
						array(
							'id'          => 'account_name',
							'type'        => 'text',
							'layout'      => 'stacked',
							'label'       => __( 'Account name', 'fyldo' ),
							'description' => __( 'Checked by a rule that only runs on the server. Try “admin”.', 'fyldo' ),
							'validate_cb' => static function ( $value ) {
								return 'admin' === strtolower( (string) $value ) ? __( '“admin” is reserved. Choose another name.', 'fyldo' ) : true;
							},
						),
						array(
							'id'       => 'license_key',
							'type'     => 'text',
							'label'    => __( 'License key', 'fyldo' ),
							'default'  => 'FYLDO-DEMO',
							'disabled' => __( 'Managed by your hosting provider.', 'fyldo' ),
						),
					),
				),
				array(
					'id'          => 'reset',
					'title'       => __( 'Reset settings', 'fyldo' ),
					'description' => __( 'Restore every option on this page to its default value.', 'fyldo' ),
					'tone'        => 'danger',
					'action'      => array(
						'id'      => 'reset',
						'label'   => __( 'Reset settings', 'fyldo' ),
						'confirm' => array( 'keyword' => 'RESET' ),
					),
				),
			),
		);
	}

	/** A `custom` field: demo/custom/working-hours.js draws it, on its own and inside a group. */
	private static function hours(): array {
		return array(
			'title'       => __( 'Opening hours', 'fyldo' ),
			'description' => __( 'A custom field: its control comes from a JavaScript module, not from Fyldo.', 'fyldo' ),
			'icon'        => 'clock',
			'group'       => 'tools',
			'save'        => 'global',
			'sections'    => array(
				array(
					'id'          => 'regular',
					'title'       => __( 'Regular hours', 'fyldo' ),
					'description' => __( 'Two selects, saved as one value such as 09:00-17:00 and split again when the page loads.', 'fyldo' ),
					'fields'      => array(
						self::hours_field(
							array(
								'id'          => 'working_hours',
								'label'       => __( 'Working hours', 'fyldo' ),
								'description' => __( 'When you open and close on a normal day.', 'fyldo' ),
								'validate'    => array( 'required' => true ),
							)
						),
					),
				),
				array(
					'id'          => 'special',
					'title'       => __( 'Special days', 'fyldo' ),
					'description' => __( 'The same custom field inside a group.', 'fyldo' ),
					'fields'      => array(
						array(
							'id'         => 'special_days',
							'type'       => 'group',
							'label'      => __( 'Days', 'fyldo' ),
							'item_title' => 'day',
							'sortable'   => true,
							'addable'    => true,
							'add_label'  => __( 'Add day', 'fyldo' ),
							'fields'     => array(
								array(
									'id'       => 'day',
									'type'     => 'text',
									'label'    => __( 'Day', 'fyldo' ),
									'validate' => array( 'required' => true ),
								),
								self::hours_field(
									array(
										'id'    => 'hours',
										'label' => __( 'Hours', 'fyldo' ),
									)
								),
							),
							'default'    => array(
								array(
									'day'   => __( 'New Year’s Eve', 'fyldo' ),
									'hours' => '10:00-14:00',
								),
							),
						),
					),
				),
			),
		);
	}

	/** Post, term and user fields: options found by searching the site, one value or several. */
	private static function links(): array {
		return array(
			'title'       => __( 'Links', 'fyldo' ),
			'description' => __( 'Point to the site’s own pages, posts, categories and people.', 'fyldo' ),
			'icon'        => 'link-21',
			'group'       => 'settings',
			'sections'    => array(
				array(
					'id'          => 'pages',
					'title'       => __( 'Pages and posts', 'fyldo' ),
					'description' => __( 'Open a field and type to search; before you type it lists the most recent items.', 'fyldo' ),
					'fields'      => array(
						array(
							'id'          => 'homepage_link',
							'type'        => 'post',
							'label'       => __( 'Homepage link', 'fyldo' ),
							'description' => __( 'The page the logo links to.', 'fyldo' ),
							'placeholder' => __( 'Select a page…', 'fyldo' ),
							'post_type'   => 'page',
						),
						array(
							'id'          => 'featured_posts',
							'type'        => 'post',
							'label'       => __( 'Featured content', 'fyldo' ),
							'description' => __( 'Posts and pages shown at the top of the blog, up to four. Each result names its type.', 'fyldo' ),
							'placeholder' => __( 'Select posts or pages…', 'fyldo' ),
							'post_type'   => array( 'post', 'page' ),
							'multiple'    => true,
							'validate'    => array( 'max' => 4 ),
						),
					),
				),
				array(
					'id'          => 'people',
					'title'       => __( 'Categories, tags and people', 'fyldo' ),
					'description' => __( 'The same field for terms of any taxonomy and for users.', 'fyldo' ),
					'fields'      => array(
						array(
							'id'          => 'featured_category',
							'type'        => 'term',
							'label'       => __( 'Featured category', 'fyldo' ),
							'placeholder' => __( 'Select a category…', 'fyldo' ),
							'taxonomy'    => 'category',
						),
						array(
							'id'          => 'highlight_tags',
							'type'        => 'term',
							'label'       => __( 'Tags to highlight', 'fyldo' ),
							'placeholder' => __( 'Select tags…', 'fyldo' ),
							'taxonomy'    => 'post_tag',
							'multiple'    => true,
						),
						array(
							'id'          => 'support_contact',
							'type'        => 'user',
							'label'       => __( 'Support contact', 'fyldo' ),
							'description' => __( 'Only administrators and editors are listed.', 'fyldo' ),
							'placeholder' => __( 'Select a user…', 'fyldo' ),
							'role'        => array( 'administrator', 'editor' ),
							'validate'    => array( 'required' => true ),
						),
					),
				),
				array(
					'id'          => 'promos',
					'title'       => __( 'In a group', 'fyldo' ),
					'description' => __( 'A post field works inside a group too, and can name its items: pick a page and the item takes its title.', 'fyldo' ),
					'fields'      => array(
						array(
							'id'         => 'promo_links',
							'type'       => 'group',
							'label'      => __( 'Promotions', 'fyldo' ),
							'item_title' => 'target',
							'addable'    => true,
							'sortable'   => true,
							'max'        => 5,
							'add_label'  => __( 'Add promotion', 'fyldo' ),
							'fields'     => array(
								array(
									'id'          => 'target',
									'type'        => 'post',
									'label'       => __( 'Links to', 'fyldo' ),
									'placeholder' => __( 'Select a page…', 'fyldo' ),
									'post_type'   => 'page',
									'validate'    => array( 'required' => true ),
								),
								array(
									'id'    => 'button',
									'type'  => 'text',
									'label' => __( 'Button text', 'fyldo' ),
								),
							),
						),
					),
				),
			),
		);
	}

	/**
	 * The working-hours custom field: the module and its stylesheet, translated texts for it, and the server's check.
	 *
	 * @param array<string,mixed> $config Id, label and the rest of the field.
	 * @return array<string,mixed>
	 */
	private static function hours_field( array $config ): array {
		$times = array();
		for ( $hour = 6; $hour <= 23; $hour++ ) {
			$times[] = sprintf( '%02d:00', $hour );
		}
		$messages = array(
			'incomplete' => __( 'Choose both times.', 'fyldo' ),
			'order'      => __( 'The closing time must be after the opening time.', 'fyldo' ),
		);

		return array_merge(
			array(
				'type'        => 'custom',
				'module'      => plugins_url( 'demo/custom/working-hours.js', self::$main_file ),
				'style'       => plugins_url( 'demo/custom/working-hours.css', self::$main_file ),
				'default'     => '09:00-17:00',
				'props'       => array_merge(
					array(
						'times'  => $times,
						'opens'  => __( 'Opens', 'fyldo' ),
						'closes' => __( 'Closes', 'fyldo' ),
					),
					$messages
				),
				// The module checks the same in the browser; this is the check that counts.
				'validate_cb' => static function ( $value ) use ( $times, $messages ) {
					if ( '' === $value || null === $value ) {
						return true;
					}
					if ( ! is_string( $value ) ) {
						return false;
					}
					$parts = explode( '-', $value );
					if ( 2 !== count( $parts ) || '' === $parts[0] || '' === $parts[1] ) {
						return $messages['incomplete'];
					}
					if ( ! in_array( $parts[0], $times, true ) || ! in_array( $parts[1], $times, true ) ) {
						return false;
					}

					return $parts[1] > $parts[0] ? true : $messages['order'];
				},
			),
			$config
		);
	}
}
