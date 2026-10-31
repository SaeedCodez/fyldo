<?php
/**
 * Plugin Name: Acme Example (Strauss)
 * Description: A Fyldo settings screen with Fyldo prefixed by Strauss (see README.md).
 * Version:     1.0.0
 */

defined( 'ABSPATH' ) || exit;

use Acme\Vendor\Fyldo\V1\Fyldo;

// 1. Fyldo's own copy, prefixed into Acme\Vendor\: it never negotiates with another Fyldo.
require_once __DIR__ . '/vendor-prefixed/autoload.php';

// 2. Register the screen on `init`: by then Fyldo has chosen the winning copy.
add_action(
	'init',
	static function () {
		$fyldo = Fyldo::create(
			'acme-example-strauss',
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
