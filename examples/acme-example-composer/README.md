# Acme Example: Composer

Fyldo is a Composer dependency of your plugin.

```bash
composer install
```

Then copy the folder (with `vendor/`) into `wp-content/plugins/` and activate it. The screen is under **Settings → Acme Example**.

`composer.json` points at the GitHub repository because Fyldo is not on Packagist yet; once it is, delete the `repositories`
block. Release tags carry the prebuilt assets (`main` does not), and `@beta` lets Composer take a beta tag until 1.0.0.
