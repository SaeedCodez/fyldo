<?php
/**
 * Prints the client-side (JSON) description of the M1 slice page, exactly as PHP builds it, using the unit-test stubs.
 * `npm run harness:data` writes it to tests/fixtures/slice-page.client.json (a PHPUnit test keeps it fresh).
 */

define( 'ABSPATH', dirname( __DIR__, 2 ) . '/' );

require_once dirname( __DIR__, 2 ) . '/tests/php/stubs.php';
require_once dirname( __DIR__, 2 ) . '/vendor/autoload.php';

$instance = \Fyldo\V1\Fyldo::create( 'acme-slice', array( 'title' => 'Acme Slice' ) );
$instance->add_page( 'general', require dirname( __DIR__, 2 ) . '/tests/fixtures/slice-page.php' );

$page = $instance->page( 'general' );
echo wp_json_encode( $page->to_client( $instance->all( 'general' ), 'rev-1' ), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) . "\n";
