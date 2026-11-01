<?php
/**
 * Fyldo never deletes your data. Register the same instance and pages, then ask it to.
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

require_once __DIR__ . '/fyldo/fyldo.php';
require_once __DIR__ . '/includes/settings.php';

acme_example_dropin_register_settings();
\Fyldo\V1\Fyldo::instance( 'acme-example-dropin' )->delete_data();
