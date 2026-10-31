# Acme Example: Strauss

Fyldo is copied into your plugin under your own namespace (`Acme\Vendor\Fyldo\V1`), so it never shares code with another
plugin's Fyldo. Choose this when you need a version of your own, pinned. The `extra.strauss` block of `composer.json` is the one
tested in [docs/ARCHITECTURE.md §7](../../docs/ARCHITECTURE.md).

```bash
composer install     # the post-install script runs Strauss and writes vendor-prefixed/
```

Then copy the folder into `wp-content/plugins/` and activate it. Ship `vendor-prefixed/`; `vendor/` is only needed to build it.
The slug must still be unique on the site: option names, the REST namespace and the menu live in shared WordPress tables.
