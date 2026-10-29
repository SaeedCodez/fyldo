<?php
/**
 * Loader contract against every released 1.x tag (docs/ARCHITECTURE.md §6.2 and §12).
 *
 * The first Fyldo copy a site loads defines `Bootstrap\Loader`; every other copy, newer ones included, only calls it.
 * So the Loader of every released 1.x copy must still negotiate correctly with the current tree. For each `v1.*` tag:
 *
 *   - `git archive` the tag into a temp dir (release tags point at release commits: a complete runtime tree);
 *   - run scenario.php in a FRESH PHP process per registration order (the class can only be defined once):
 *       old-first      the tag's Loader defines the class and registers the tag, then the current tree registers;
 *       current-first  the current Loader defines the class, then the tag registers;
 *       tie A-B, B-A   the tag's tree twice (two directories, one version): a deterministic winner, no double load.
 *
 * The expected winner is worked out here, independently of any Loader: the highest version (version_compare()), and
 * on a tie the smaller real path. A tag whose version is higher than the current tree's is skipped with a note. The run
 * fails when a scenario fails or when no tag was tested (CI must fetch the tags: `fetch-depth: 0`).
 *
 * Usage, from anywhere: php tests/contract/run.php   (needs git and tar)
 *
 * @package Fyldo
 */

error_reporting( E_ALL );

$fyldo_root = dirname( __DIR__, 2 );

/**
 * The `Version:` header of a fyldo.php, as get_file_data() reads it.
 *
 * @param string $source The file's contents.
 */
function fyldo_contract_version( string $source ): string {
	return 1 === preg_match( '/^[ \t\/*#@]*Version:[ \t]*(\S+)/mi', $source, $match ) ? $match[1] : '';
}

/**
 * Runs a shell command; returns its exit status and fills $output.
 *
 * @param string   $command Command line (arguments already escaped).
 * @param string[] $output  Lines printed (stdout and stderr).
 */
function fyldo_contract_exec( string $command, ?array &$output = null ): int {
	$output = array();
	exec( $command . ' 2>&1', $output, $status );

	return $status;
}

/** Deletes a directory tree. */
function fyldo_contract_rmdir( string $dir ): void {
	if ( ! is_dir( $dir ) ) {
		return;
	}
	$items = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $dir, FilesystemIterator::SKIP_DOTS ), RecursiveIteratorIterator::CHILD_FIRST );
	foreach ( $items as $item ) {
		$item->isDir() && ! $item->isLink() ? rmdir( $item->getPathname() ) : unlink( $item->getPathname() );
	}
	rmdir( $dir );
}

/**
 * The copy that must win: the highest version, then the smaller real path (the documented rule of §6.2).
 *
 * @param array<int,array{dir:string,version:string}> $copies Copies in registration order.
 * @return array{dir:string,version:string}
 */
function fyldo_contract_expected( array $copies ): array {
	usort(
		$copies,
		static function ( array $a, array $b ): int {
			$by_version = version_compare( $b['version'], $a['version'] );
			return 0 !== $by_version ? $by_version : strcmp( (string) realpath( $a['dir'] ), (string) realpath( $b['dir'] ) );
		}
	);

	return $copies[0];
}

/**
 * One scenario in a fresh PHP process. Returns the failure text, or '' when it passed.
 *
 * @param array<int,array{dir:string,version:string}> $copies Copies in registration order.
 */
function fyldo_contract_scenario( array $copies ): string {
	$spec    = array(
		'copies' => $copies,
		'winner' => fyldo_contract_expected( $copies ),
	);
	$command = escapeshellarg( PHP_BINARY ) . ' ' . escapeshellarg( __DIR__ . '/scenario.php' ) . ' ' . escapeshellarg( (string) json_encode( $spec, JSON_UNESCAPED_SLASHES ) );
	$status  = fyldo_contract_exec( $command, $output );
	$text    = trim( implode( "\n", $output ) );

	return 0 === $status && 'ok' === $text ? '' : ( '' !== $text ? $text : "exit status $status" );
}

$fyldo_current = array(
	'dir'     => (string) realpath( $fyldo_root ),
	'version' => fyldo_contract_version( (string) file_get_contents( $fyldo_root . '/fyldo.php' ) ),
);
if ( '' === $fyldo_current['version'] ) {
	fwrite( STDERR, "No Version header in fyldo.php.\n" );
	exit( 1 );
}

if ( 0 !== fyldo_contract_exec( 'git -C ' . escapeshellarg( $fyldo_root ) . ' tag -l ' . escapeshellarg( 'v1.*' ), $fyldo_tags ) ) {
	fwrite( STDERR, "git tag failed:\n" . implode( "\n", $fyldo_tags ) . "\n" );
	exit( 1 );
}
usort( $fyldo_tags, 'version_compare' );

$fyldo_tmp = sys_get_temp_dir() . '/fyldo-contract-' . getmypid();
fyldo_contract_rmdir( $fyldo_tmp );
mkdir( $fyldo_tmp, 0777, true );
register_shutdown_function( 'fyldo_contract_rmdir', $fyldo_tmp );

printf( "Current tree: %s (%s)\n", $fyldo_current['version'], $fyldo_root );

$fyldo_tested = 0;
$fyldo_failed = 0;
foreach ( $fyldo_tags as $fyldo_tag ) {
	if ( 1 !== preg_match( '/^v1\.[0-9A-Za-z.+-]+$/', $fyldo_tag ) ) {
		continue;
	}

	fyldo_contract_exec( 'git -C ' . escapeshellarg( $fyldo_root ) . ' show ' . escapeshellarg( $fyldo_tag . ':fyldo.php' ), $fyldo_lines );
	$fyldo_version = fyldo_contract_version( implode( "\n", $fyldo_lines ) );
	if ( '' === $fyldo_version ) {
		printf( "FAIL %s: no Version header in the tag's fyldo.php\n", $fyldo_tag );
		++$fyldo_failed;
		continue;
	}
	if ( version_compare( $fyldo_version, $fyldo_current['version'], '>' ) ) {
		printf( "skip %s: %s is newer than the current tree (%s); nothing to test against.\n", $fyldo_tag, $fyldo_version, $fyldo_current['version'] );
		continue;
	}

	// Two extractions of the tag: the second one is the "same version twice" copy.
	$fyldo_copies = array();
	foreach ( array( 'a', 'b' ) as $fyldo_side ) {
		$fyldo_dir = $fyldo_tmp . '/' . $fyldo_tag . '/' . $fyldo_side . '/fyldo';
		mkdir( $fyldo_dir, 0777, true );
		$fyldo_status = fyldo_contract_exec( 'git -C ' . escapeshellarg( $fyldo_root ) . ' archive --format=tar ' . escapeshellarg( $fyldo_tag ) . ' | tar -x -C ' . escapeshellarg( $fyldo_dir ), $fyldo_lines );
		if ( 0 !== $fyldo_status || ! is_file( $fyldo_dir . '/src/Bootstrap/Loader.php' ) ) {
			printf( "FAIL %s: git archive did not give a tree with src/Bootstrap/Loader.php\n%s\n", $fyldo_tag, implode( "\n", $fyldo_lines ) );
			++$fyldo_failed;
			continue 2;
		}
		$fyldo_copies[ $fyldo_side ] = array(
			'dir'     => (string) realpath( $fyldo_dir ),
			'version' => $fyldo_version,
		);
	}

	$fyldo_note      = 0 === version_compare( $fyldo_version, $fyldo_current['version'] ) ? ' (same version as the current tree: a tie)' : '';
	$fyldo_scenarios = array(
		'old-first'     => array( $fyldo_copies['a'], $fyldo_current ),
		'current-first' => array( $fyldo_current, $fyldo_copies['a'] ),
		'tie A-B'       => array( $fyldo_copies['a'], $fyldo_copies['b'] ),
		'tie B-A'       => array( $fyldo_copies['b'], $fyldo_copies['a'] ),
	);

	$fyldo_results = array();
	foreach ( $fyldo_scenarios as $fyldo_name => $fyldo_order ) {
		$fyldo_error = fyldo_contract_scenario( $fyldo_order );
		if ( '' === $fyldo_error ) {
			$fyldo_results[] = "$fyldo_name ok";
			continue;
		}
		$fyldo_results[] = "$fyldo_name FAILED";
		printf( "FAIL %s %s:\n  %s\n", $fyldo_tag, $fyldo_name, str_replace( "\n", "\n  ", $fyldo_error ) );
		++$fyldo_failed;
	}

	printf( "%s (%s)%s: %s\n", $fyldo_tag, $fyldo_version, $fyldo_note, implode( ' · ', $fyldo_results ) );
	++$fyldo_tested;
}

if ( 0 === $fyldo_tested ) {
	fwrite( STDERR, "No v1.* tag was tested. Fetch the tags (actions/checkout with fetch-depth: 0, or `git fetch --tags`).\n" );
	exit( 1 );
}

printf( "%d tag(s) tested, %d failure(s).\n", $fyldo_tested, $fyldo_failed );
exit( 0 === $fyldo_failed ? 0 : 1 );
