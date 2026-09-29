<?php
/**
 * Unit-test bootstrap: no WordPress. ABSPATH and the few WordPress functions Fyldo calls are stubbed, in memory.
 * Real WordPress behaviour is covered by the Playwright suite on wp-env (e2e/wp).
 *
 * @package Fyldo
 */

define( 'ABSPATH', dirname( __DIR__, 2 ) . '/' );

require_once __DIR__ . '/stubs.php';
require_once dirname( __DIR__, 2 ) . '/vendor/autoload.php';
