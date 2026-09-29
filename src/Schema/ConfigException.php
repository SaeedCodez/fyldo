<?php
/**
 * A developer-facing configuration mistake, found at registration time.
 *
 * @package Fyldo
 */

namespace Fyldo\V1\Schema;

/**
 * Thrown by the schema normalisers; the public API catches it and reports through _doing_it_wrong().
 */
class ConfigException extends \InvalidArgumentException {
}
