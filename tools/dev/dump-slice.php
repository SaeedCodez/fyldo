<?php
/**
 * Prints the client-side (JSON) description of the M1 slice page (or, with `form-fields`, the M2 fields page; with `tabs`, the M3 page with tabs), exactly as PHP builds it, using the unit-test stubs.
 * `npm run harness:data` writes it to tests/fixtures/slice-page.client.json (a PHPUnit test keeps it fresh).
 */

define( 'ABSPATH', dirname( __DIR__, 2 ) . '/' );

require_once dirname( __DIR__, 2 ) . '/tests/php/stubs.php';
require_once dirname( __DIR__, 2 ) . '/vendor/autoload.php';

// php tools/dev/dump-slice.php [slice|form-fields|tabs]
$which = $argv[1] ?? 'slice';
$pages = array(
	'slice'       => array( 'slice-page.php', 'general' ),
	'form-fields' => array( 'form-fields-page.php', 'fields' ),
	'tabs'        => array( 'tabs-page.php', 'advanced' ),
);
list( $file, $id ) = $pages[ $which ] ?? $pages['slice'];

$instance = \Fyldo\V1\Fyldo::create( 'acme-slice', array( 'title' => 'Acme Slice' ) );
$instance->add_page( $id, require dirname( __DIR__, 2 ) . '/tests/fixtures/' . $file );

$page = $instance->page( $id );
echo wp_json_encode( $page->to_client( $instance->store()->client_values( $page ), 'rev-1' ), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) . "\n";
