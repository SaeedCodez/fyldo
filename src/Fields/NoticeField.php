<?php
/**
 * Static notice between fields.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Fields;

use Fyldo\V1\Schema\ConfigException;

/**
 * Display only: renders the Notice component. It has no value: it is not in the option, not in the REST payload,
 * and cannot be disabled or validated. `label` is the (optional) title, `description` the message.
 */
final class NoticeField extends AbstractField {

	/** Notice tones (Figma `Notice`, Tone). */
	const TONES = array( 'gray', 'blue', 'green', 'amber', 'red' );

	public static function types(): array {
		return array( 'notice' );
	}

	protected function default_layout(): string {
		return 'stacked';
	}

	protected function accepted_keys(): array {
		return array( 'id', 'type', 'label', 'description', 'tone' );
	}

	protected function requires_label(): bool {
		return false;
	}

	public function is_stored(): bool {
		return false;
	}

	protected function normalize_type( array $config ): array {
		if ( '' === trim( (string) $config['description'] ) ) {
			throw new ConfigException( sprintf( 'Notice "%s" needs a `description` (the message).', $config['id'] ) );
		}

		$tone = isset( $config['tone'] ) ? (string) $config['tone'] : 'gray';
		if ( ! in_array( $tone, self::TONES, true ) ) {
			throw new ConfigException( sprintf( 'Notice "%1$s": tone must be one of %2$s.', $config['id'], implode( ', ', self::TONES ) ) );
		}

		$config['tone'] = $tone;

		return $config;
	}

	protected function sanitize_value( $raw ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found -- nothing is stored.
		return null;
	}

	public function to_client(): array {
		return array(
			'id'          => $this->id(),
			'type'        => $this->type(),
			'label'       => $this->label(),
			'description' => (string) $this->config['description'],
			'tone'        => (string) $this->config['tone'],
		);
	}
}
