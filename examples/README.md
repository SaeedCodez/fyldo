# Examples

Four small plugins with the same screen (one page, one section, a text field, a toggle and a select). Only the way Fyldo is
loaded differs. Copy the one you need. CI builds each one against the current tree and tests it on a real WordPress
(`e2e/wp/examples.spec.ts`), so they keep working.

| Mode | Folder | Choose it when |
|---|---|---|
| Drop-in | [`acme-example-dropin`](acme-example-dropin) | You want one self-contained plugin and no build step. You unzip `fyldo.zip` into it. |
| Composer | [`acme-example-composer`](acme-example-composer) | Your plugin already uses Composer. Fyldo is a dependency; several plugins with Fyldo share the newest copy. |
| Strauss | [`acme-example-strauss`](acme-example-strauss) | You want a private, pinned copy that never meets another plugin's Fyldo. Costs a build step. |
| Requires Plugins | [`acme-example-requires`](acme-example-requires) | Your users install Fyldo as a plugin themselves. Nothing is bundled; WordPress only checks it is active. |

Two bundled copies are fine: the highest version wins site-wide (README, "Coexistence and Strauss"). The examples never ship in
`fyldo.zip` or the Composer package.
