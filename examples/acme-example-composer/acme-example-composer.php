<?php
/**
 * Plugin Name: Acme Example (Composer)
 * Description: A Fyldo settings screen with Fyldo installed by Composer (see README.md).
 * Version:     1.0.0
 */

defined( 'ABSPATH' ) || exit;

use Fyldo\V1\Fyldo;

// 1. Composer only loads fyldo.php; there is no PSR-4 map on purpose.
require_once __DIR__ . '/vendor/autoload.php';

// 2. Register the screen on `init`: by then Fyldo has chosen the winning copy.
add_action(
	'init',
	static function () {
		$fyldo = Fyldo::create(
			'acme-example-composer',
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
