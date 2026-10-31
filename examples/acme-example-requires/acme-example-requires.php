<?php
/**
 * Plugin Name:      Acme Example (Requires Plugins)
 * Description:      A Fyldo settings screen that uses the Fyldo plugin (see README.md).
 * Version:          1.0.0
 * Requires Plugins: fyldo
 */

defined( 'ABSPATH' ) || exit;

use Fyldo\V1\Fyldo;

// No bundled copy: the Fyldo plugin is loaded by WordPress, and `Requires Plugins` keeps this one inactive without it.
// Register the screen on `init`, when every plugin is loaded.
add_action(
	'init',
	static function () {
		$fyldo = Fyldo::create(
			'acme-example-requires',
			array(
				'title' => 'Acme Example',
				'menu'  => array(
					'type'   => 'submenu',
					'parent' => 'options-general.php',
					'title'  => 'Acme Example',
				),
			)
		);
		$fyldo->add_page(
			'general',
			array(
				'title'    => 'General',
				'sections' => array(
					array(
						'id'     => 'main',
						'title'  => 'Main',
						'fields' => array(
							array( 'id' => 'site_title', 'type' => 'text', 'label' => 'Site title', 'default' => 'My site' ),
							array( 'id' => 'enabled', 'type' => 'toggle', 'label' => 'Enabled', 'default' => true ),
							array( 'id' => 'layout', 'type' => 'select', 'label' => 'Layout', 'default' => 'grid', 'options' => array( 'grid' => 'Grid', 'list' => 'List' ) ),
						),
					),
				),
			)
		);
	}
);
