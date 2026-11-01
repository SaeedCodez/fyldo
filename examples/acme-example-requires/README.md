# Acme Example: Requires Plugins

The plugin bundles nothing and depends on the Fyldo plugin (`fyldo.zip`, installed as `wp-content/plugins/fyldo/`).

The header `Requires Plugins: fyldo` makes WordPress refuse to activate this plugin until Fyldo is active, and show a notice.
That is all it does: **WordPress only checks that Fyldo is active; it cannot install it**, because Fyldo is not on
wordpress.org. Tell your users to install `fyldo.zip` from the [GitHub Releases](https://github.com/SaeedCodez/fyldo/releases)
page first (Plugins → Add New → Upload Plugin). The plugin folder must be named exactly `fyldo`, which the ZIP does.

Then activate this plugin. The screen is under **Settings → Acme Example**.
