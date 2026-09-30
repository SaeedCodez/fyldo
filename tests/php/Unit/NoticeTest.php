<?php
/**
 * `Instance::admin_notice()`: notices for the Fyldo screen, never in core's `.notice` markup.
 *
 * @package Fyldo
 */

namespace Fyldo\Tests\Unit;

use Fyldo\V1\Instance;
use PHPUnit\Framework\TestCase;

final class NoticeTest extends TestCase {

	/** @var Instance */
	private $instance;

	protected function setUp(): void {
		$GLOBALS['__fyldo_test_wrong'] = array();
		$this->instance                = new Instance( 'acme-seo', array( 'title' => 'Acme SEO' ) );
	}

	public function test_a_notice_is_normalised_with_the_designs_defaults(): void {
		$this->instance->admin_notice( '  Your changes are live.  ' );

		$this->assertSame(
			array(
				array(
					'id'          => md5( "gray\nYour changes are live." ),
					'tone'        => 'gray',
					'title'       => '',
					'message'     => 'Your changes are live.',
					'dismissible' => true,
					'page'        => '',
					'action'      => null,
				),
			),
			$this->instance->notices()
		);
	}

	public function test_wordpress_words_map_to_the_designs_tones(): void {
		foreach ( array( 'info' => 'blue', 'success' => 'green', 'warning' => 'amber', 'error' => 'red', 'gray' => 'gray' ) as $given => $tone ) {
			$this->instance->admin_notice( "Message $given", array( 'tone' => $given ) );
		}

		$this->assertSame( array( 'red', 'amber', 'green', 'blue', 'gray' ), array_column( $this->instance->notices(), 'tone' ), 'Most severe first.' );
	}

	public function test_errors_and_warnings_stay_until_resolved_unless_the_developer_says_otherwise(): void {
		$this->instance->admin_notice( 'Failed', array( 'tone' => 'error' ) );
		$this->instance->admin_notice( 'Expires', array( 'tone' => 'warning' ) );
		$this->instance->admin_notice( 'Saved', array( 'tone' => 'success' ) );
		$this->instance->admin_notice( 'Forced', array( 'tone' => 'error', 'dismissible' => true ) );

		$this->assertSame( array( false, true, false, true ), array_column( $this->instance->notices(), 'dismissible' ) );
	}

	public function test_notices_of_one_tone_keep_the_order_they_were_added_in(): void {
		$this->instance->admin_notice( 'First', array( 'tone' => 'blue' ) );
		$this->instance->admin_notice( 'Second', array( 'tone' => 'blue' ) );
		$this->instance->admin_notice( 'Urgent', array( 'tone' => 'red' ) );

		$this->assertSame( array( 'Urgent', 'First', 'Second' ), array_column( $this->instance->notices(), 'message' ) );
	}

	public function test_title_page_id_and_an_action_link_are_carried(): void {
		$this->instance->admin_notice(
			'Check your API key and try again.',
			array(
				'tone'   => 'error',
				'title'  => 'Couldn’t connect to the API',
				'page'   => 'integrations',
				'id'     => 'api-down',
				'action' => array( 'label' => 'View logs', 'url' => 'https://acme.test/logs', 'external' => true ),
			)
		);

		$notice = $this->instance->notices()[0];
		$this->assertSame( 'api-down', $notice['id'] );
		$this->assertSame( 'Couldn’t connect to the API', $notice['title'] );
		$this->assertSame( 'integrations', $notice['page'] );
		$this->assertSame( array( 'label' => 'View logs', 'url' => 'https://acme.test/logs', 'external' => true ), $notice['action'] );
	}

	public function test_the_same_notice_added_twice_is_shown_once(): void {
		$this->instance->admin_notice( 'Same', array( 'tone' => 'blue' ) );
		$this->instance->admin_notice( 'Same', array( 'tone' => 'blue' ) );

		$this->assertCount( 1, $this->instance->notices() );
	}

	/**
	 * @dataProvider invalid
	 */
	public function test_an_invalid_notice_is_reported_and_not_shown( string $message, array $args, string $needle ): void {
		$this->instance->admin_notice( $message, $args );

		$this->assertSame( array(), $this->instance->notices() );
		$this->assertCount( 1, $GLOBALS['__fyldo_test_wrong'] );
		$this->assertStringContainsString( $needle, $GLOBALS['__fyldo_test_wrong'][0] );
	}

	public function invalid(): array {
		return array(
			'empty message'   => array( '   ', array(), 'needs a message' ),
			'unknown key'     => array( 'Hi', array( 'colour' => 'red' ), 'unknown key' ),
			'unknown tone'    => array( 'Hi', array( 'tone' => 'purple' ), 'tone must be' ),
			'action no url'   => array( 'Hi', array( 'action' => array( 'label' => 'Go' ) ), '`label` and a `url`' ),
			'action bad url'  => array( 'Hi', array( 'action' => array( 'label' => 'Go', 'url' => 'javascript:alert(1)' ) ), 'is not valid' ),
		);
	}

	public function test_more_than_three_notices_is_reported_but_still_shown(): void {
		foreach ( array( 'a', 'b', 'c', 'd' ) as $message ) {
			$this->instance->admin_notice( $message );
		}

		$this->assertCount( 4, $this->instance->notices() );
		$this->assertCount( 1, $GLOBALS['__fyldo_test_wrong'] );
	}

	/**
	 * WordPress core JS relocates every `.notice` under the first heading of `.wrap`: Fyldo must never emit that markup.
	 * One exception, by design: the frozen Loader's "no compatible copy" message is a real `admin_notices` notice on
	 * ordinary admin screens — there is no Fyldo screen at all when it is shown.
	 */
	public function test_fyldo_never_emits_the_core_notice_markup(): void {
		$offenders = array();
		foreach ( new \RecursiveIteratorIterator( new \RecursiveDirectoryIterator( dirname( __DIR__, 3 ) . '/src' ) ) as $file ) {
			if ( 'php' !== $file->getExtension() || 'Loader.php' === $file->getFilename() ) {
				continue;
			}
			$code = (string) file_get_contents( $file->getPathname() );
			if ( 1 === preg_match( '/class=["\'][^"\']*\bnotice\b|notice-(?:success|error|warning|info|alt)\b|\bis-dismissible\b/', $code ) ) {
				$offenders[] = $file->getFilename();
			}
		}

		$this->assertSame( array(), $offenders );
	}
}
