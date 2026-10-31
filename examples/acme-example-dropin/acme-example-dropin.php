<?php
/**
 * Plugin Name: Acme Example (drop-in)
 * Description: A Fyldo settings screen with Fyldo bundled in ./fyldo (see README.md).
 * Version:     1.0.0
 */

defined( 'ABSPATH' ) || exit;

// 1. Load Fyldo from the folder you unzipped into this plugin.
require_once __DIR__ . '/fyldo/fyldo.php';
require_once __DIR__ . '/includes/settings.php';

// 2. Register the screen on `init`: by then Fyldo has chosen the winning copy.
add_action( 'init', 'acme_example_dropin_register_settings' );
