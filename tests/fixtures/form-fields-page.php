<?php
/**
 * The Milestone-2 page: Textarea (with counter), Checkbox, Checkbox group (with a parent) and Radio group.
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
	),
);
