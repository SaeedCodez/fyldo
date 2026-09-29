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
	function esc_url_raw( $url ) {
		$url = trim( (string) $url );
		return preg_match( '#^(https?|mailto|tel)(:|://)#i', $url ) ? $url : '';
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
if ( ! function_exists( 'update_option' ) ) {
	function update_option( $name, $value, $autoload = null ) {
		$GLOBALS['__fyldo_test_options'][ $name ] = $value;
		return true;
	}
}
