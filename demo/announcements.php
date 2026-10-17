<?php
/**
 * The demo's custom page: "Announcements", a list and an editor that a plugin draws itself (docs/custom-pages.md).
 *
 * The records live in the demo's own table, not in an option. Fyldo validates them (the `announcement` form) and draws
 * the components; the table, the list route and the delete and duplicate routes belong to the demo, as they would to any
 * plugin. demo/custom/announcements.js draws the page.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Demo;

use Fyldo\V1\Instance;

/**
 * Registers the custom page, its form, its table and its REST routes.
 */
final class Announcements {

	/** Bump when the table changes: the next admin request runs dbDelta again. */
	const DB_VERSION = '1';

	/** Option that records which DB_VERSION is installed. */
	const DB_OPTION = 'fyldo_demo_announcements_db';

	/** The demo's own REST namespace (Fyldo's is `fyldo-fyldo-demo/v1`). */
	const REST_NAMESPACE = 'fyldo-demo/v1';

	const STATUSES = array( 'published', 'draft', 'archived' );

	/** Cards per page; with the Add card, two rows of three. */
	const PER_PAGE = 5;

	/** Hooks the REST routes. Called from Demo::boot(). */
	public static function boot(): void {
		add_action( 'rest_api_init', array( self::class, 'routes' ) );
	}

	/**
	 * Adds the page and the form to the demo instance.
	 *
	 * @param Instance $fyldo     The demo instance.
	 * @param string   $main_file Absolute path of fyldo.php (for asset URLs).
	 */
	public static function register( Instance $fyldo, string $main_file ): void {
		$fyldo->add_page(
			'announcements',
			array(
				'type'        => 'custom',
				'title'       => __( 'Announcements', 'fyldo' ),
				'description' => __( 'Short messages shown at the top of your site. A custom page: the plugin draws the list and stores the records in its own table.', 'fyldo' ),
				'icon'        => 'notification-bing',
				'group'       => 'manage',
				'module'      => plugins_url( 'demo/custom/announcements.js', $main_file ),
				'style'       => plugins_url( 'demo/custom/announcements.css', $main_file ),
				'props'       => array(
					'rest'    => self::REST_NAMESPACE . '/announcements',
					'perPage' => self::PER_PAGE,
					'text'    => self::texts(),
				),
			)
		);

		$fyldo->add_form(
			'announcement',
			array(
				'sections' => self::sections(),
				'load'     => array( self::class, 'load' ),
				'save'     => array( self::class, 'save' ),
			)
		);
	}

	/** The table's name, with the site's prefix. */
	public static function table(): string {
		global $wpdb;

		return $wpdb->prefix . 'fyldo_demo_announcements';
	}

	/**
	 * Creates (or upgrades) the table once per DB_VERSION and adds a few sample announcements the first time. Every route
	 * and callback calls it before touching the table, so nothing runs on requests that never show the page.
	 */
	public static function install(): void {
		if ( self::DB_VERSION === get_option( self::DB_OPTION ) ) {
			return;
		}

		global $wpdb;
		$table   = self::table();
		$charset = $wpdb->get_charset_collate();

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta(
			"CREATE TABLE {$table} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				title varchar(200) NOT NULL DEFAULT '',
				status varchar(20) NOT NULL DEFAULT 'draft',
				pinned tinyint(1) NOT NULL DEFAULT 0,
				ends_at datetime NULL DEFAULT NULL,
				views bigint(20) unsigned NOT NULL DEFAULT 0,
				data longtext NOT NULL,
				created_at datetime NOT NULL,
				updated_at datetime NOT NULL,
				PRIMARY KEY  (id),
				KEY status (status)
			) {$charset};"
		);

		$fresh = false === get_option( self::DB_OPTION );
		update_option( self::DB_OPTION, self::DB_VERSION, false );

		if ( $fresh && 0 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table}" ) ) { // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery -- the demo's own table, no input.
			self::seed();
		}
	}

	/** A few announcements, so the list has something to show. */
	private static function seed(): void {
		$day = DAY_IN_SECONDS;
		// On a whole hour: the `ends_at` field steps by 5 minutes, and a stored value off its step reads as empty.
		$now     = (int) ( floor( time() / HOUR_IN_SECONDS ) * HOUR_IN_SECONDS );
		$samples = array(
			array( __( 'Free shipping this week', 'fyldo' ), 'published', 1, gmdate( 'Y-m-d H:i:s', $now + 5 * $day ), 1240, __( 'Every order ships free until Sunday.', 'fyldo' ) ),
			array( __( 'New opening hours', 'fyldo' ), 'published', 0, null, 860, __( 'From November we open at 9 and close at 18.', 'fyldo' ) ),
			array( __( 'Autumn sale', 'fyldo' ), 'draft', 0, null, 0, __( 'A third off coats and boots, this month only.', 'fyldo' ) ),
			array( __( 'Summer workshop', 'fyldo' ), 'archived', 0, gmdate( 'Y-m-d H:i:s', $now - 30 * $day ), 2105, __( 'Thanks to everyone who joined us in July.', 'fyldo' ) ),
		);

		foreach ( $samples as $sample ) {
			self::write(
				'',
				array(
					'title'   => $sample[0],
					'status'  => $sample[1],
					'pinned'  => (bool) $sample[2],
					'ends_at' => (string) $sample[3],
					'message' => $sample[5],
					'image'   => 0,
					'link'    => '',
				),
				(int) $sample[4]
			);
		}
	}

	/**
	 * The `announcement` form: its fields are validated by Fyldo exactly like a settings page's.
	 *
	 * @return array<int,array<string,mixed>>
	 */
	private static function sections(): array {
		return array(
			array(
				'id'          => 'message',
				'title'       => __( 'Announcement', 'fyldo' ),
				'description' => __( 'What visitors see at the top of the site.', 'fyldo' ),
				'fields'      => array(
					array(
						'id'       => 'title',
						'type'     => 'text',
						'label'    => __( 'Title', 'fyldo' ),
						'validate' => array(
							'required'   => true,
							'max_length' => 80,
						),
					),
					array(
						'id'          => 'message',
						'type'        => 'textarea',
						'label'       => __( 'Message', 'fyldo' ),
						'description' => __( 'One or two sentences, up to 200 characters.', 'fyldo' ),
						'rows'        => 3,
						'validate'    => array( 'max_length' => 200 ),
					),
					array(
						'id'          => 'image',
						'type'        => 'image',
						'label'       => __( 'Image', 'fyldo' ),
						'description' => __( 'Shown on the card in this list and next to the message.', 'fyldo' ),
						'max_size'    => '2MB',
					),
					array(
						'id'          => 'link',
						'type'        => 'url',
						'label'       => __( 'Link', 'fyldo' ),
						'description' => __( 'Where “Read more” leads. Leave empty for none.', 'fyldo' ),
						'placeholder' => 'https://example.com/sale',
					),
				),
			),
			array(
				'id'          => 'publishing',
				'title'       => __( 'Publishing', 'fyldo' ),
				'description' => __( 'Whether the announcement shows, and until when.', 'fyldo' ),
				'fields'      => array(
					array(
						'id'      => 'status',
						'type'    => 'segmented',
						'label'   => __( 'Status', 'fyldo' ),
						'default' => 'draft',
						'options' => array(
							'published' => __( 'Published', 'fyldo' ),
							'draft'     => __( 'Draft', 'fyldo' ),
							'archived'  => __( 'Archived', 'fyldo' ),
						),
					),
					array(
						'id'          => 'pinned',
						'type'        => 'toggle',
						'label'       => __( 'Pin to the top', 'fyldo' ),
						'description' => __( 'Pinned announcements come first, whatever the sort order.', 'fyldo' ),
						'default'     => false,
					),
					array(
						'id'          => 'ends_at',
						'type'        => 'datetime',
						'label'       => __( 'Show until', 'fyldo' ),
						'description' => __( 'Leave empty to keep it up until you archive it.', 'fyldo' ),
						'step'        => 5,
					),
				),
			),
		);
	}

	/**
	 * Fyldo's `load` callback: the stored values of one announcement, or null when there is none.
	 *
	 * @param string $key Record key (the row id).
	 * @return array<string,mixed>|null
	 */
	public static function load( string $key ): ?array {
		$row = self::row( $key );

		return null === $row ? null : self::values( $row );
	}

	/**
	 * Fyldo's `save` callback: `$values` are sanitized and valid, every field present. Returns the record key.
	 *
	 * @param array<string,mixed> $values Field values.
	 * @param string              $key    Record key, '' for a new announcement.
	 * @return string|\WP_Error
	 */
	public static function save( array $values, string $key ) {
		$id = self::write( $key, $values );

		return null === $id ? new \WP_Error( 'fyldo_demo_db', __( 'Couldn’t save the announcement. Try again in a moment.', 'fyldo' ), array( 'status' => 500 ) ) : (string) $id;
	}

	/**
	 * Inserts (`$key` '') or updates one row. Returns its id, or null when the database refused.
	 *
	 * @param string              $key    Row id, or '' for a new one.
	 * @param array<string,mixed> $values Field values.
	 * @param int                 $views  Starting view count of a new row.
	 */
	private static function write( string $key, array $values, int $views = 0 ): ?int {
		global $wpdb;
		if ( '' === $key ) {
			self::install();
		}
		$now = gmdate( 'Y-m-d H:i:s' );
		$row = array(
			'title'      => (string) $values['title'],
			'status'     => in_array( $values['status'], self::STATUSES, true ) ? (string) $values['status'] : 'draft',
			'pinned'     => empty( $values['pinned'] ) ? 0 : 1,
			'ends_at'    => '' === (string) $values['ends_at'] ? null : (string) $values['ends_at'],
			'data'       => (string) wp_json_encode(
				array(
					'message' => (string) $values['message'],
					'image'   => (int) $values['image'],
					'link'    => (string) $values['link'],
				)
			),
			'updated_at' => $now,
		);

		if ( '' === $key ) {
			$row['created_at'] = $now;
			$row['views']      = $views;
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- the demo's own table.
			return false === $wpdb->insert( self::table(), $row ) ? null : (int) $wpdb->insert_id;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- the demo's own table.
		return false === $wpdb->update( self::table(), $row, array( 'id' => (int) $key ) ) ? null : (int) $key;
	}

	/**
	 * One row by id, or null.
	 *
	 * @param string $key Row id.
	 * @return array<string,mixed>|null
	 */
	private static function row( string $key ): ?array {
		if ( 1 !== preg_match( '/^[1-9]\d*$/', $key ) ) {
			return null;
		}

		self::install();
		global $wpdb;
		$table = self::table();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- the demo's own table; the id is prepared.
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", (int) $key ), ARRAY_A );

		return is_array( $row ) ? $row : null;
	}

	/**
	 * A row as the form's values.
	 *
	 * @param array<string,mixed> $row Database row.
	 * @return array<string,mixed>
	 */
	private static function values( array $row ): array {
		$data = json_decode( (string) $row['data'], true );
		$data = is_array( $data ) ? $data : array();

		return array(
			'title'   => (string) $row['title'],
			'status'  => (string) $row['status'],
			'pinned'  => '1' === (string) $row['pinned'],
			'ends_at' => null === $row['ends_at'] ? '' : (string) $row['ends_at'],
			'message' => (string) ( $data['message'] ?? '' ),
			'image'   => (int) ( $data['image'] ?? 0 ),
			'link'    => (string) ( $data['link'] ?? '' ),
		);
	}

	/** Registers the list, delete and duplicate routes (on `rest_api_init`). */
	public static function routes(): void {
		$can = static function (): bool {
			return current_user_can( 'manage_options' );
		};

		register_rest_route(
			self::REST_NAMESPACE,
			'/announcements',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( self::class, 'index' ),
				'permission_callback' => $can,
				'args'                => array(
					'status'  => array(
						'type'    => 'string',
						'enum'    => array_merge( array( 'all' ), self::STATUSES ),
						'default' => 'all',
					),
					'search'  => array(
						'type'    => 'string',
						'default' => '',
					),
					'orderby' => array(
						'type'    => 'string',
						'enum'    => array( 'newest', 'oldest', 'title' ),
						'default' => 'newest',
					),
					'paged'   => array(
						'type'    => 'integer',
						'minimum' => 1,
						'default' => 1,
					),
				),
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/announcements/(?P<id>[1-9]\d*)',
			array(
				'methods'             => \WP_REST_Server::DELETABLE,
				'callback'            => array( self::class, 'delete' ),
				'permission_callback' => $can,
				'args'                => array(
					'delete_image' => array(
						'type'    => 'boolean',
						'default' => false,
					),
				),
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/announcements/(?P<id>[1-9]\d*)/duplicate',
			array(
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => array( self::class, 'duplicate' ),
				'permission_callback' => $can,
			)
		);
	}

	/**
	 * One page of announcements (pinned first), the count per status and the total of views.
	 */
	public static function index( \WP_REST_Request $request ): \WP_REST_Response {
		global $wpdb;
		self::install();
		$table = self::table();

		// Each condition is prepared on its own; the order is one of three fixed strings.
		$where  = '1=1';
		$search = trim( (string) $request['search'] );
		if ( 'all' !== $request['status'] ) {
			$where .= $wpdb->prepare( ' AND status = %s', (string) $request['status'] );
		}
		if ( '' !== $search ) {
			$where .= $wpdb->prepare( ' AND title LIKE %s', '%' . $wpdb->esc_like( $search ) . '%' );
		}
		$order  = array(
			'newest' => 'created_at DESC, id DESC',
			'oldest' => 'created_at ASC, id ASC',
			'title'  => 'title ASC, id ASC',
		)[ (string) $request['orderby'] ];
		$offset = ( max( 1, (int) $request['paged'] ) - 1 ) * self::PER_PAGE;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared -- the demo's own table; $where is prepared above.
		$total  = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE {$where}" );
		$rows   = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table} WHERE {$where} ORDER BY pinned DESC, {$order} LIMIT %d OFFSET %d", self::PER_PAGE, $offset ), ARRAY_A );
		$counts = $wpdb->get_results( "SELECT status, COUNT(*) AS n, SUM(views) AS v FROM {$table} GROUP BY status", ARRAY_A );
		// phpcs:enable

		$by_status = array_fill_keys( self::STATUSES, 0 );
		$views     = 0;
		foreach ( (array) $counts as $count ) {
			$by_status[ (string) $count['status'] ] = (int) $count['n'];
			$views                                 += (int) $count['v'];
		}

		return new \WP_REST_Response(
			array(
				'items'  => array_map( array( self::class, 'item' ), (array) $rows ),
				'total'  => $total,
				'pages'  => max( 1, (int) ceil( $total / self::PER_PAGE ) ),
				'counts' => array_merge( array( 'all' => array_sum( $by_status ) ), $by_status ),
				'views'  => $views,
			)
		);
	}

	/**
	 * A row as the list shows it.
	 *
	 * @param array<string,mixed> $row Database row.
	 * @return array<string,mixed>
	 */
	private static function item( array $row ): array {
		$values = self::values( $row );
		$image  = $values['image'] > 0 ? wp_get_attachment_image_url( $values['image'], 'medium' ) : false;

		return array(
			'id'      => (string) $row['id'],
			'title'   => $values['title'],
			'message' => $values['message'],
			'status'  => $values['status'],
			'pinned'  => $values['pinned'],
			// ISO 8601 in UTC: the browser formats it in the page's language and calendar.
			'endsAt'  => '' === $values['ends_at'] ? null : str_replace( ' ', 'T', $values['ends_at'] ) . 'Z',
			'views'   => (int) $row['views'],
			'image'   => false === $image ? null : $image,
		);
	}

	/**
	 * Deletes one announcement; with `delete_image`, its image goes from the Media Library too.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function delete( \WP_REST_Request $request ) {
		global $wpdb;
		$row = self::row( (string) $request['id'] );
		if ( null === $row ) {
			return new \WP_Error( 'fyldo_demo_not_found', __( 'This announcement no longer exists.', 'fyldo' ), array( 'status' => 404 ) );
		}

		$image = self::values( $row )['image'];
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- the demo's own table.
		$wpdb->delete( self::table(), array( 'id' => (int) $row['id'] ) );
		if ( $request['delete_image'] && $image > 0 && current_user_can( 'delete_post', $image ) ) {
			wp_delete_attachment( $image, true );
		}

		return new \WP_REST_Response( array( 'deleted' => true ) );
	}

	/**
	 * Copies one announcement as a draft (not pinned, no views) and returns the new id.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function duplicate( \WP_REST_Request $request ) {
		$row = self::row( (string) $request['id'] );
		if ( null === $row ) {
			return new \WP_Error( 'fyldo_demo_not_found', __( 'This announcement no longer exists.', 'fyldo' ), array( 'status' => 404 ) );
		}

		$values = self::values( $row );
		/* translators: %s: title of the announcement that was copied. */
		$values['title']  = sprintf( __( '%s (copy)', 'fyldo' ), $values['title'] );
		$values['status'] = 'draft';
		$values['pinned'] = false;
		$id               = self::write( '', $values );

		return null === $id
			? new \WP_Error( 'fyldo_demo_db', __( 'Couldn’t copy the announcement. Try again in a moment.', 'fyldo' ), array( 'status' => 500 ) )
			: new \WP_REST_Response( array( 'id' => (string) $id ) );
	}

	/**
	 * Every string the page's module shows, translated here (the module itself has no text domain).
	 *
	 * @return array<string,string>
	 */
	private static function texts(): array {
		return array(
			'add'               => __( 'Add announcement', 'fyldo' ),
			'addDescription'    => __( 'Write a short message for the top of your site.', 'fyldo' ),
			'newTitle'          => __( 'New announcement', 'fyldo' ),
			'editTitle'         => __( 'Edit announcement', 'fyldo' ),
			'editDescription'   => __( 'Changes show on the site as soon as you save.', 'fyldo' ),
			'back'              => __( 'All announcements', 'fyldo' ),
			'search'            => __( 'Search announcements…', 'fyldo' ),
			'sortLabel'         => __( 'Sort', 'fyldo' ),
			'newest'            => __( 'Newest first', 'fyldo' ),
			'oldest'            => __( 'Oldest first', 'fyldo' ),
			'byTitle'           => __( 'By title', 'fyldo' ),
			'tabsLabel'         => __( 'Status', 'fyldo' ),
			'all'               => __( 'All', 'fyldo' ),
			'published'         => __( 'Published', 'fyldo' ),
			'draft'             => __( 'Draft', 'fyldo' ),
			'archived'          => __( 'Archived', 'fyldo' ),
			'pinned'            => __( 'Pinned', 'fyldo' ),
			'always'            => __( 'No end date', 'fyldo' ),
			/* translators: %s: a date, e.g. "Oct 25". */
			'until'             => __( 'Until %s', 'fyldo' ),
			'ended'             => __( 'Ended', 'fyldo' ),
			/* translators: %s: number of views. */
			'views'             => __( '%s views', 'fyldo' ),
			'edit'              => __( 'Edit', 'fyldo' ),
			'duplicate'         => __( 'Duplicate', 'fyldo' ),
			'delete'            => __( 'Delete', 'fyldo' ),
			'emptyTitle'        => __( 'No announcements yet', 'fyldo' ),
			'emptyDescription'  => __( 'Write your first one and publish it to show it at the top of the site.', 'fyldo' ),
			'noResults'         => __( 'No announcements found', 'fyldo' ),
			'noResultsHint'     => __( 'Try another word, or clear the search.', 'fyldo' ),
			'clearSearch'       => __( 'Clear search', 'fyldo' ),
			'loadError'         => __( 'Couldn’t load the announcements. Check your connection and try again.', 'fyldo' ),
			'retry'             => __( 'Retry', 'fyldo' ),
			'loading'           => __( 'Loading announcements…', 'fyldo' ),
			/* translators: %s: title of the announcement. */
			'deleteTitle'       => __( 'Delete “%s”?', 'fyldo' ),
			'deleteDescription' => __( 'It disappears from the site and from this list. This can’t be undone; to only hide it, archive it.', 'fyldo' ),
			'deleteImage'       => __( 'Also delete its image', 'fyldo' ),
			'deleteImageHint'   => __( 'Otherwise the image stays in the Media Library.', 'fyldo' ),
			'cancel'            => __( 'Cancel', 'fyldo' ),
			'deleted'           => __( 'Announcement deleted', 'fyldo' ),
			'duplicated'        => __( 'Copy saved as a draft', 'fyldo' ),
			'created'           => __( 'Announcement created', 'fyldo' ),
			'actionFailed'      => __( 'Couldn’t do that. Try again in a moment.', 'fyldo' ),
			/* translators: 1: first item shown, 2: last item shown, 3: total number of items. */
			'showing'           => __( 'Showing %1$s–%2$s of %3$s', 'fyldo' ),
			'statTotal'         => __( 'Announcements', 'fyldo' ),
			'statPublished'     => __( 'Published', 'fyldo' ),
			'statDrafts'        => __( 'Drafts', 'fyldo' ),
			'statViews'         => __( 'Views', 'fyldo' ),
			'statViewsHint'     => __( 'all time', 'fyldo' ),
		);
	}
}
