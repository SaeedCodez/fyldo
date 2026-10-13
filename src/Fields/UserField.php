<?php
/**
 * Pick one or more users of the site by searching for them.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Support\Relations;

/**
 * Config: `role` (a role name or a list; none = every user), plus the keys of every relation field (see
 * AbstractRelationField). Only someone who may list users (`list_users`) can search or save; results show the display
 * name, and the login when it differs. Email addresses are never searched or sent. Not final: the unit tests stub the
 * WordPress queries.
 */
class UserField extends AbstractRelationField {

	public static function types(): array {
		return array( 'user' );
	}

	protected function noun(): string {
		return 'User field';
	}

	protected function source_keys(): array {
		return array( 'role' );
	}

	protected function normalize_source( array $config ): array {
		$config['role'] = $this->names( $config, 'role', array() );

		return $config;
	}

	/** @return array{role:string[],query_args:array<string,mixed>} */
	private function source(): array {
		return array(
			'role'       => $this->config['role'],
			'query_args' => $this->config['query_args'],
		);
	}

	protected function query( string $search, int $page ): array {
		return Relations::search_users( $this->source(), $search, $page );
	}

	protected function lookup( array $ids, bool $check ): array {
		return Relations::find_users( $this->source(), $ids, $check );
	}
}
