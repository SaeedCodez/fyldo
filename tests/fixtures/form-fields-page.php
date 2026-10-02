<?php
/**
 * The Milestone-2 page: Textarea (with counter), Checkbox, Checkbox group (with a parent), Radio group, Multi Select,
 * and the input fields (URL, email, password, number, a notice and a disabled field with its reason).
 * Used by: the PHPUnit contract test, tools/dev/dump-slice.php (→ form-fields-page.client.json for the Vitest save
 * flow) and every e2e demo plugin (page id `fields`).
 *
 * @package Fyldo
 */

return array(
	'title'       => 'Content',
	'description' => 'How your content is described, shown and indexed.',
	'icon'        => 'document-text',
	'save'        => 'global',
	'sections'    => array(
		array(
			'id'          => 'seo',
			'title'       => 'SEO',
			'description' => 'How your content appears in search results.',
			'fields'      => array(
				array(
					'id'          => 'meta_description',
					'type'        => 'textarea',
					'label'       => 'Default meta description',
					'description' => 'Used as the default meta description.',
					'placeholder' => 'Describe your site in a sentence or two…',
					'default'     => 'Fyldo is a lightweight settings framework.',
					'validate'    => array( 'max_length' => 160 ),
				),
				array(
					'id'          => 'post_types',
					'type'        => 'checkbox_group',
					'label'       => 'Show on',
					'description' => 'Post types where this block is displayed.',
					'parent'      => 'All post types',
					'default'     => array( 'post', 'page' ),
					'validate'    => array( 'min' => 1 ),
					'options'     => array(
						array( 'value' => 'post', 'label' => 'Posts' ),
						array( 'value' => 'page', 'label' => 'Pages' ),
						array( 'value' => 'product', 'label' => 'Products', 'description' => 'Available in Pro.', 'disabled' => true ),
					),
				),
				array(
					'id'          => 'sitemap_types',
					'type'        => 'multi_select',
					'label'       => 'Include in sitemap',
					'description' => 'Content types listed in the XML sitemap.',
					'placeholder' => 'Select content types…',
					'clearable'   => true,
					'default'     => array( 'post', 'page' ),
					'validate'    => array( 'min' => 1, 'max' => 5 ),
					'options'     => array(
						array( 'value' => 'post', 'label' => 'Posts' ),
						array( 'value' => 'page', 'label' => 'Pages' ),
						array( 'value' => 'product', 'label' => 'Products' ),
						array( 'value' => 'author', 'label' => 'Authors' ),
						array( 'value' => 'category', 'label' => 'Categories' ),
						array( 'value' => 'tag', 'label' => 'Tags' ),
						array( 'value' => 'media', 'label' => 'Media' ),
						array( 'value' => 'comment', 'label' => 'Comments', 'disabled' => true ),
					),
				),
				array(
					'id'          => 'layout',
					'type'        => 'radio',
					'label'       => 'Layout',
					'description' => 'How content is laid out on the page.',
					'default'     => 'full',
					'options'     => array(
						array( 'value' => 'full', 'label' => 'Full width', 'description' => 'Content spans the entire screen.' ),
						array( 'value' => 'boxed', 'label' => 'Boxed', 'description' => 'Content sits in a centered 1200px column.' ),
					),
				),
				array(
					'id'          => 'agree',
					'type'        => 'checkbox',
					'label'       => 'I agree to the terms',
					'description' => 'You must accept the terms to continue.',
					'default'     => false,
				),
			),
		),
		array(
			'id'          => 'connection',
			'title'       => 'Connection',
			'description' => 'How this site talks to the outside world.',
			'fields'      => array(
				array(
					'id'          => 'connection_note',
					'type'        => 'notice',
					'tone'        => 'blue',
					'label'       => 'Before you connect',
					'description' => 'Keys are stored in the database and are never shown again.',
				),
				array(
					'id'          => 'canonical_base',
					'type'        => 'url',
					'label'       => 'Canonical URL',
					'description' => 'The address search engines should use.',
					'placeholder' => 'https://example.com',
					'validate'    => array( 'schemes' => array( 'https' ) ),
				),
				array(
					'id'          => 'contact_email',
					'type'        => 'email',
					'label'       => 'Contact email',
					'placeholder' => 'name@example.com',
				),
				array(
					'id'          => 'api_key',
					'type'        => 'password',
					'label'       => 'API key',
					'description' => 'Paste the key from your provider.',
					'validate'    => array( 'min_length' => 8 ),
				),
				array(
					'id'          => 'per_page',
					'type'        => 'number',
					'label'       => 'Items per page',
					'description' => 'Between 5 and 100, in steps of 5.',
					'default'     => 10,
					'validate'    => array( 'min' => 5, 'max' => 100, 'step' => 5 ),
				),
				array(
					'id'          => 'sort_by',
					'type'        => 'segmented',
					'label'       => 'Sort products',
					'description' => 'Choose how the list is grouped.',
					'default'     => 'product',
					'options'     => array(
						'order'   => 'By order',
						'product' => 'By product',
						'simple'  => 'Simple',
					),
				),
				array(
					'id'          => 'density',
					'type'        => 'choice',
					'label'       => 'Dashboard density',
					'description' => 'How much fits on one screen.',
					'default'     => 'comfortable',
					'columns'     => 3,
					'options'     => array(
						array( 'value' => 'compact', 'label' => 'Compact', 'description' => 'Tighter rows.' ),
						array( 'value' => 'comfortable', 'label' => 'Comfortable', 'description' => 'Balanced spacing.' ),
						array( 'value' => 'spacious', 'label' => 'Spacious', 'description' => 'Room to breathe.' ),
					),
				),
				array(
					'id'          => 'image_quality',
					'type'        => 'slider',
					'label'       => 'Image quality',
					'description' => 'Higher quality creates larger files.',
					'default'     => 75,
					'min'         => 0,
					'max'         => 100,
					'step'        => 5,
				),
				array(
					'id'          => 'accent_color',
					'type'        => 'color',
					'label'       => 'Accent color',
					'description' => 'Used for links and buttons on your settings page.',
					'default'     => '#2271b1',
				),
				array(
					'id'          => 'menu_icon',
					'type'        => 'icon',
					'label'       => 'Menu icon',
					'description' => 'Shown next to the menu item.',
					'icons'       => array( 'home-2', 'setting-2', 'star', 'user' ),
					'default'     => 'home-2',
				),
				array(
					'id'          => 'site_logo',
					'type'        => 'image',
					'label'       => 'Site logo',
					'description' => 'Shown in the sidebar and on the login screen.',
					'max_size'    => '2MB',
				),
				array(
					'id'          => 'brand_guidelines',
					'type'        => 'file',
					'label'       => 'Brand guidelines',
					'description' => 'Offered as a download on the About tab.',
					'types'       => array( 'pdf', 'zip' ),
				),
				array(
					'id'          => 'license_key',
					'type'        => 'text',
					'label'       => 'License key',
					'default'     => 'FYLDO-FREE',
					'disabled'    => 'Managed by your hosting provider.',
				),
			),
		),
		// M4: the Danger Section Card — always last, its action asks for the typed keyword.
		array(
			'id'          => 'reset',
			'title'       => 'Reset settings',
			'description' => 'Restore every option on this page to its default value.',
			'tone'        => 'danger',
			'action'      => array(
				'id'      => 'reset',
				'label'   => 'Reset settings',
				'confirm' => array( 'keyword' => 'RESET' ),
			),
		),
	),
);
