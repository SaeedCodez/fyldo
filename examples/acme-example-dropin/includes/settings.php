<?php
/**
 * The screen, in a function so uninstall.php can register it too.
 */

defined( 'ABSPATH' ) || exit;

use Fyldo\V1\Fyldo;

function acme_example_dropin_register_settings() {
	$fyldo = Fyldo::create(
		'acme-example-dropin',
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
						array(
							'id'      => 'layout',
							'type'    => 'select',
							'label'   => 'Layout',
							'default' => 'grid',
							'options' => array(
								'grid' => 'Grid',
								'list' => 'List',
							),
						),
					),
				),
			),
		)
	);
}
