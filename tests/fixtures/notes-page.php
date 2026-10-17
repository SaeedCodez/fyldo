<?php
/**
 * E2E fixture (copied into every generated demo plugin as notes.php): a custom page, "Notes", with a list and an editor
 * (tests/fixtures/notes-page.js), and the `note` form whose records live in ONE option of the plugin's own,
 * `{slug}_e2e_notes` (id => values). It exercises custom pages, `request` and forms on a real WordPress without a
 * database table. e2e/wp/custom-page.spec.ts drives it.
 *
 * @package Fyldo
 */

/**
 * Registers the page, the form and the list route.
 *
 * @param object $fyldo The fixture's Fyldo instance.
 * @param string $slug  Instance slug (acme-beta…).
 * @param string $url   URL of the plugin's folder.
 */
return static function ( $fyldo, string $slug, string $url ): void {
	$option = $slug . '_e2e_notes';
	$read   = static function () use ( $option ): array {
		return (array) get_option( $option, array() );
	};

	$fyldo->add_page(
		'notes',
		array(
			'type'        => 'custom',
			'title'       => 'Notes',
			'description' => 'A custom page: the list and the editor come from the plugin.',
			'icon'        => 'document-text',
			'group'       => 'tools',
			'module'      => $url . '/notes.js',
			'props'       => array( 'rest' => $slug . '/v1/notes' ),
		)
	);

	$fyldo->add_form(
		'note',
		array(
			'sections' => array(
				array(
					'id'     => 'note',
					'title'  => 'Note',
					'fields' => array(
						array(
							'id'       => 'title',
							'type'     => 'text',
							'label'    => 'Title',
							'validate' => array(
								'required'   => true,
								'max_length' => 40,
							),
						),
						array(
							'id'      => 'done',
							'type'    => 'toggle',
							'label'   => 'Done',
							'default' => false,
						),
					),
				),
			),
			'load'     => static function ( string $key ) use ( $read ): ?array {
				$notes = $read();

				return isset( $notes[ $key ] ) && is_array( $notes[ $key ] ) ? $notes[ $key ] : null;
			},
			'save'     => static function ( array $values, string $key ) use ( $read, $option ): string {
				$notes = $read();
				if ( '' === $key ) {
					$key = (string) ( array() === $notes ? 1 : max( array_map( 'intval', array_keys( $notes ) ) ) + 1 );
				}
				$notes[ $key ] = $values;
				update_option( $option, $notes, false );

				return $key;
			},
		)
	);

	add_action(
		'rest_api_init',
		static function () use ( $slug, $read ): void {
			register_rest_route(
				$slug . '/v1',
				'/notes',
				array(
					'methods'             => 'GET',
					'permission_callback' => static function (): bool {
						return current_user_can( 'manage_options' );
					},
					'callback'            => static function () use ( $read ): array {
						$items = array();
						foreach ( $read() as $id => $note ) {
							$items[] = array(
								'id'    => (string) $id,
								'title' => (string) ( $note['title'] ?? '' ),
								'done'  => ! empty( $note['done'] ),
							);
						}

						return array( 'items' => $items );
					},
				)
			);
		}
	);
};
