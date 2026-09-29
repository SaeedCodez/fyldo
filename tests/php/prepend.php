<?php
/**
 * Prepended (php -d auto_prepend_file) to every PHPUnit run of the unit suite.
 *
 * Composer's `files` autoload executes fyldo.php as soon as vendor/autoload.php is required — including by
 * the phpunit binary itself — and fyldo.php exits when ABSPATH is not defined (WordPress direct-access guard).
 * So ABSPATH and the WordPress stubs must exist BEFORE Composer's autoloader. Use `composer test`.
 *
 * @package Fyldo
 */

define( 'ABSPATH', dirname( __DIR__, 2 ) . '/' );

require_once __DIR__ . '/stubs.php';
