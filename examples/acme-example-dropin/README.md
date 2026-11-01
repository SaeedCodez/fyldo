# Acme Example: drop-in

Fyldo lives inside your plugin, in `fyldo/`. Nothing else to install.

1. Download `fyldo.zip` from the [GitHub Releases](https://github.com/SaeedCodez/fyldo/releases) page.
2. Unzip it into this folder, so that `fyldo/fyldo.php` exists. The `fyldo/` folder is not committed here.
3. Copy the folder into `wp-content/plugins/` and activate it. The screen is under **Settings → Acme Example**.

`uninstall.php` registers the same screen and calls `delete_data()`, which removes the pages' options when the plugin is deleted
(see the README's "Uninstall").
