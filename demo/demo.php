<?php
/**
 * The demo dashboard: four pages of sample settings, shown only when Fyldo is installed as a plugin
 * (`wp-content/plugins/fyldo/`), never as a drop-in folder or a Composer package. `fyldo.php` decides that; this
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

	/** @var string Main plugin file (for the "Open demo" link on the Plugins screen). */
	private static $main_file = '';

	/**
	 * Hooks the demo. Called once, from fyldo.php, when Fyldo is installed as a plugin.
	 *
	 * @param string $main_file Absolute path of fyldo.php.
	 */
	public static function boot( string $main_file ): void {
		self::$main_file = $main_file;

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

		$fyldo->add_page( 'overview', self::overview() );
		$fyldo->add_page( 'general', self::general() );
		$fyldo->add_page( 'content', self::content() );
		$fyldo->add_page( 'security', self::security() );

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
							'id'          => 'tour_security',
							'type'        => 'notice',
							'tone'        => 'amber',
							'label'       => __( 'Security', 'fyldo' ),
							'description' => __( 'A write-only password, a disabled field, a server-side rule and a Danger card that resets the page.', 'fyldo' ),
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
							'types'       => array( 'pdf', 'zip' ),
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
}
