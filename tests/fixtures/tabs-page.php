<?php
/**
 * The M3 page with tabs (sub-pages at `#/advanced/<tab>`), in the "Tools" group. Used by the PHPUnit contract test,
 * tools/dev/dump-slice.php (→ tabs-page.client.json for the static harness) and every e2e demo plugin.
 *
 * @package Fyldo
 */

return array(
	'title'       => 'Advanced',
	'description' => 'Caching and troubleshooting options for developers.',
	'icon'        => 'code-1',
	'group'       => 'tools',
	'save'        => 'global',
	'tabs'        => array(
		'cache' => 'Cache',
		'debug' => array(
			'label' => 'Debugging',
			'badge' => 2,
		),
	),
	'sections'    => array(
		array(
			'id'          => 'cache',
			'tab'         => 'cache',
			'title'       => 'Page cache',
			'description' => 'Serve stored copies of pages to visitors.',
			'fields'      => array(
				array(
					'id'          => 'page_cache',
					'type'        => 'toggle',
					'label'       => 'Enable page cache',
					'description' => 'Logged-in users always see fresh pages.',
					'default'     => true,
				),
				array(
					'id'          => 'cache_ttl',
					'type'        => 'number',
					'label'       => 'Cache lifetime',
					'description' => 'In minutes, between 5 and 1440.',
					'default'     => 60,
					'validate'    => array(
						'min' => 5,
						'max' => 1440,
					),
				),
			),
		),
		array(
			'id'          => 'debug',
			'tab'         => 'debug',
			'title'       => 'Debugging',
			'description' => 'Extra information for troubleshooting.',
			'fields'      => array(
				array(
					'id'          => 'debug_log',
					'type'        => 'toggle',
					'label'       => 'Write a debug log',
					'description' => 'Stored in the uploads folder; remove it when you are done.',
					'default'     => false,
				),
				array(
					'id'          => 'log_prefix',
					'type'        => 'text',
					'label'       => 'Log file prefix',
					'description' => 'Letters, digits and dashes only.',
					'default'     => 'acme',
					'validate'    => array(
						'required' => true,
						'pattern'  => '^[a-z0-9-]+$',
					),
				),
			),
		),
		array(
			'id'          => 'about',
			'title'       => 'About these settings',
			'description' => 'Shown on every tab: a section without a tab belongs to the whole page.',
			'fields'      => array(
				array(
					'id'          => 'advanced_notice',
					'type'        => 'notice',
					'tone'        => 'blue',
					'description' => 'These options are meant for developers.',
				),
			),
		),
	),
);
