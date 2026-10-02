<?php
/**
 * Minimal in-memory WordPress stubs for the unit suite.
 *
 * @package Fyldo
 */

// phpcs:disable

if ( ! function_exists( 'add_action' ) ) {
	function add_action( $hook, $callback, $priority = 10, $args = 1 ) {
		$GLOBALS['__fyldo_test_actions'][ $hook ][] = array( $callback, $priority );
		return true;
	}
}

if ( ! function_exists( 'add_filter' ) ) {
	function add_filter( $hook, $callback, $priority = 10, $args = 1 ) {
		return add_action( $hook, $callback, $priority, $args );
	}
}

if ( ! function_exists( 'did_action' ) ) {
	function did_action( $hook ) {
		return $GLOBALS['__fyldo_test_did'][ $hook ] ?? 0;
	}
}

if ( ! function_exists( 'apply_filters' ) ) {
	function apply_filters( $hook, $value, ...$args ) {
		return $value;
	}
}

if ( ! function_exists( 'do_action' ) ) {
	function do_action( $hook, ...$args ) {
		$GLOBALS['__fyldo_test_fired'][] = array_merge( array( $hook ), $args );
	}
}

if ( ! function_exists( '_doing_it_wrong' ) ) {
	function _doing_it_wrong( $function, $message, $version ) {
		$GLOBALS['__fyldo_test_wrong'][] = $message;
	}
}

if ( ! function_exists( 'get_file_data' ) ) {
	function get_file_data( $file, $headers ) {
		$contents = (string) file_get_contents( $file, false, null, 0, 8192 );
		$out      = array();
		foreach ( $headers as $key => $header ) {
			$out[ $key ] = preg_match( '/^[ \t\/*#@]*' . preg_quote( $header, '/' ) . ':(.*)$/mi', $contents, $m ) ? trim( $m[1] ) : '';
		}
		return $out;
	}
}

if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = 'default' ) {
		return $text;
	}
}

if ( ! function_exists( '_n' ) ) {
	function _n( $single, $plural, $number, $domain = 'default' ) {
		return 1 === (int) $number ? $single : $plural;
	}
}

if ( ! function_exists( 'esc_html' ) ) {
	function esc_html( $text ) {
		return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
	}
}

if ( ! function_exists( 'sanitize_text_field' ) ) {
	function sanitize_text_field( $str ) {
		$str = strip_tags( (string) $str );
		$str = preg_replace( '/[\r\n\t ]+/', ' ', $str );
		return trim( $str );
	}
}

if ( ! function_exists( 'sanitize_textarea_field' ) ) {
	function sanitize_textarea_field( $str ) {
		$str = strip_tags( (string) $str );
		$str = str_replace( array( "\r\n", "\r" ), "\n", $str );
		$str = implode( "\n", array_map( 'trim', explode( "\n", $str ) ) );
		return trim( $str );
	}
}

if ( ! function_exists( 'esc_url_raw' ) ) {
	function esc_url_raw( $url, $protocols = null ) {
		$url = trim( (string) $url );
		if ( null !== $protocols ) {
			// Like WordPress: only the listed schemes, and a path or fragment without a scheme stays as it is.
			if ( preg_match( '#^[/\\#?]#', $url ) ) {
				return $url;
			}
			return preg_match( '#^(' . implode( '|', array_map( 'preg_quote', $protocols ) ) . ')://#i', $url ) ? $url : '';
		}
		return preg_match( '#^(https?|mailto|tel)(:|://)#i', $url ) ? $url : '';
	}
}

if ( ! function_exists( 'plugins_url' ) ) {
	function plugins_url( $path = '', $plugin = '' ) {
		return 'https://example.com/wp-content/plugins/fyldo/' . ltrim( (string) $path, '/' );
	}
}

if ( ! function_exists( 'sanitize_email' ) ) {
	function sanitize_email( $email ) {
		return false !== filter_var( $email, FILTER_VALIDATE_EMAIL ) ? $email : '';
	}
}

if ( ! function_exists( 'rest_sanitize_boolean' ) ) {
	function rest_sanitize_boolean( $value ) {
		if ( is_string( $value ) ) {
			return ! in_array( strtolower( $value ), array( 'false', '0', '' ), true );
		}
		return (bool) $value;
	}
}

if ( ! function_exists( 'wp_json_encode' ) ) {
	function wp_json_encode( $data, $flags = 0, $depth = 512 ) {
		return json_encode( $data, $flags, $depth );
	}
}

// In-memory options.
if ( ! function_exists( 'get_option' ) ) {
	function get_option( $name, $default = false ) {
		return array_key_exists( $name, $GLOBALS['__fyldo_test_options'] ?? array() ) ? $GLOBALS['__fyldo_test_options'][ $name ] : $default;
	}
}
if ( ! function_exists( 'add_option' ) ) {
	function add_option( $name, $value = '', $deprecated = '', $autoload = 'yes' ) {
		$GLOBALS['__fyldo_test_options'][ $name ]  = $value;
		$GLOBALS['__fyldo_test_autoload'][ $name ] = $autoload;
		return true;
	}
}
if ( ! function_exists( 'delete_option' ) ) {
	function delete_option( $name ) {
		unset( $GLOBALS['__fyldo_test_options'][ $name ] );
		return true;
	}
}
if ( ! function_exists( 'update_option' ) ) {
	function update_option( $name, $value, $autoload = null ) {
		$GLOBALS['__fyldo_test_options'][ $name ] = $value;
		return true;
	}
}

// REST classes, just enough to run Controller callbacks directly.
if ( ! class_exists( 'WP_Error' ) ) {
	class WP_Error {
		private $code;
		private $data;
		public function __construct( $code = '', $message = '', $data = '' ) {
			$this->code = $code;
			$this->data = $data;
		}
		public function get_error_code() {
			return $this->code;
		}
		public function get_error_data() {
			return $this->data;
		}
	}
}

if ( ! class_exists( 'WP_REST_Server' ) ) {
	class WP_REST_Server {
		const READABLE  = 'GET';
		const CREATABLE = 'POST';
		const EDITABLE  = 'POST, PUT, PATCH';
	}
}

if ( ! class_exists( 'WP_REST_Response' ) ) {
	class WP_REST_Response {
		public $data;
		public function __construct( $data = null ) {
			$this->data = $data;
		}
		public function get_data() {
			return $this->data;
		}
	}
}

if ( ! class_exists( 'WP_REST_Request' ) ) {
	class WP_REST_Request implements ArrayAccess {
		private $params;
		private $headers;
		private $method;
		private $body;
		public function __construct( array $params = array(), array $headers = array(), string $method = 'POST', string $body = '' ) {
			$this->params  = $params;
			$this->headers = $headers;
			$this->method  = $method;
			$this->body    = $body;
		}
		public function get_header( $key ) {
			return $this->headers[ $key ] ?? null;
		}
		public function get_method() {
			return $this->method;
		}
		public function get_body() {
			return $this->body;
		}
		#[\ReturnTypeWillChange]
		public function offsetExists( $offset ) {
			return isset( $this->params[ $offset ] );
		}
		#[\ReturnTypeWillChange]
		public function offsetGet( $offset ) {
			return $this->params[ $offset ] ?? null;
		}
		#[\ReturnTypeWillChange]
		public function offsetSet( $offset, $value ) {
			$this->params[ $offset ] = $value;
		}
		#[\ReturnTypeWillChange]
		public function offsetUnset( $offset ) {
			unset( $this->params[ $offset ] );
		}
	}
}

// Route registration and the three permission checks, driven by globals so a test can play each outcome.
if ( ! function_exists( 'register_rest_route' ) ) {
	function register_rest_route( $namespace, $route, $args = array() ) {
		$GLOBALS['__fyldo_test_routes'][] = array( $namespace, $route, $args );
		return true;
	}
}
if ( ! function_exists( 'is_user_logged_in' ) ) {
	function is_user_logged_in() {
		return $GLOBALS['__fyldo_test_logged_in'] ?? true;
	}
}
if ( ! function_exists( 'wp_verify_nonce' ) ) {
	function wp_verify_nonce( $nonce, $action ) {
		return ( $GLOBALS['__fyldo_test_nonces'][ $action ] ?? null ) === $nonce ? 1 : false;
	}
}
// Media fields: the file types WordPress allows (a few of them) and the size text of the "too large" message.
if ( ! function_exists( 'wp_get_mime_types' ) ) {
	function wp_get_mime_types() {
		return array(
			'jpg|jpeg|jpe' => 'image/jpeg',
			'png'          => 'image/png',
			'gif'          => 'image/gif',
			'webp'         => 'image/webp',
			'pdf'          => 'application/pdf',
			'zip'          => 'application/zip',
			'docx'         => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'mp3|m4a|m4b'  => 'audio/mpeg',
		);
	}
}
if ( ! function_exists( 'size_format' ) ) {
	function size_format( $bytes, $decimals = 0 ) {
		$units = array( 'GB' => 1073741824, 'MB' => 1048576, 'KB' => 1024, 'B' => 1 );
		foreach ( $units as $unit => $size ) {
			if ( $bytes >= $size ) {
				return number_format( $bytes / $size, $decimals ) . ' ' . $unit;
			}
		}
		return '0 B';
	}
}
if ( ! function_exists( 'current_user_can' ) ) {
	function current_user_can( $capability ) {
		return in_array( $capability, $GLOBALS['__fyldo_test_caps'] ?? array( 'manage_options' ), true );
	}
}
